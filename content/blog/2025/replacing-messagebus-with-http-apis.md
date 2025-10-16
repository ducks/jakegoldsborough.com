---
title: "Replacing MessageBus Pub/Sub with REST APIs: Fixing Production
Outages"
date: 2025-10-15
description: "Converting postgres-manager from fire-and-forget MessageBus to
synchronous HTTP APIs to eliminate message replay issues and gain operational
visibility."
---

We recently converted one of our infrastructure services from MessageBus
pub/sub to a synchronous REST API. This wasn't about choosing HTTP over HTTP -
both architectures use HTTP. This was about replacing fire-and-forget
asynchronous messaging with request/response patterns that provide immediate
feedback.

## The Problem

Our `postgres-manager` service handles PostgreSQL user and database lifecycle
for Discourse hosted sites. It was built using ServiceSkeleton, a Ruby
framework for message-driven services, subscribing to MessageBus channels for
commands.

MessageBus uses HTTP long-polling for pub/sub messaging. Publishers send
messages to channels, subscribers open long-lived HTTP connections and wait for
messages to arrive. It works well for many use cases, but we hit two critical
problems:

**1. No feedback mechanism.** When mothership published a message like "create
database for site X", it had no way to know if the operation succeeded or
failed. The message was sent and forgotten.

**2. Message replay on restarts.** MessageBus keeps a backlog of messages. When
postgres-manager restarted, it would replay unacknowledged messages, causing
duplicate operations. We had multiple production outages from databases being
recreated or users being decommissioned twice.

The second issue was the immediate trigger, but the first was the underlying
architectural problem. We needed synchronous request/response patterns with
immediate success/failure feedback.

## The Solution: REST API with Request/Response

We converted postgres-manager to a Sinatra HTTP service that responds
synchronously to requests. Instead of subscribing to MessageBus channels, it
exposes REST endpoints:

- `POST /databases` - Create database and user
- `DELETE /databases/:username` - Decommission database
- `POST /users` - Create user (triggers sync)
- `DELETE /users/:username` - Decommission user
- `POST /sync` - Sync all databases/users from mothership

Each endpoint returns an immediate response with proper HTTP status codes: 200
for success, 401 for auth failures, 400 for bad parameters, 500 for server
errors.

## Implementation

### Before: ServiceSkeleton with MessageBus

The old implementation used ServiceSkeleton to subscribe to MessageBus:

```ruby
message_bus = MessageBus::HTTPClient.new(
  config.mothership_base_url,
  headers: { "Discourse-Access-Token" => config.mothership_token }
)

message_bus.subscribe(config.message_bus_channel) do |message|
  case message["type"]
  when "create_user", "create_db", "sync"
    sync
  when "decommission_db"
    decommission_db(message["dbname"])
  when "decommission_user"
    decommission_user(message["username"])
  end
end
```

The mothership would publish messages:

```ruby
PostgresManagerPublisher.create_db(owner, cluster_name)
# Fire and forget - no response
```

### After: Sinatra HTTP Service

The new implementation uses Sinatra with proper HTTP patterns:

```ruby
before do
  return if ["/health", "/metrics"].include?(request.path_info)

  auth_header = request.env["HTTP_AUTHORIZATION"]
  if !auth_header || !auth_header.start_with?("Bearer ")
    halt 401, json(error: "Unauthorized", code: "AUTH_REQUIRED")
  end

  token = auth_header.sub("Bearer ", "")
  if token != config[:api_key]
    halt 401, json(error: "Unauthorized", code: "INVALID_TOKEN")
  end
end

post "/databases" do
  body = parse_json_body
  cluster = body["cluster"]
  username = body["username"]

  if cluster != config[:container_name]
    halt 400, json(
      error: "Cluster mismatch",
      code: "CLUSTER_MISMATCH",
      expected: config[:container_name],
      received: cluster
    )
  end

  sync

  json(
    status: "success",
    message: "Database sync completed",
    cluster: cluster
  )
end

delete "/databases/:username" do
  username = params["username"]
  decommission_db(username)

  json(
    status: "success",
    message: "Database decommissioned",
    username: username
  )
end
```

The mothership now makes HTTP requests and gets immediate responses:

```ruby
PostgresManagerHttpClient.create_db(owner, cluster_name)
# Returns { "status" => "success", "message" => "..." }
# Or raises PostgresManagerError on failure
```

## HTTP Client with Proper Error Handling

The new HTTP client provides clear error handling:

```ruby
class PostgresManagerHttpClient
  class PostgresManagerError < StandardError; end
  class PostgresManagerTimeout < PostgresManagerError; end
  class PostgresManagerAuthError < PostgresManagerError; end

  def self.create_db(owner, cluster_name)
    call_postgres_manager(
      cluster_name: cluster_name,
      method: :post,
      path: "/databases",
      body: { cluster: cluster_name, username: owner, action: "create" }
    )
  end

  private

  def self.call_postgres_manager(cluster_name:, method:, path:, body: nil)
    api_key = ENV["POSTGRES_MANAGER_API_KEY"]
    raise "POSTGRES_MANAGER_API_KEY not configured" if !api_key

    base_url = ENV["POSTGRES_MANAGER_BASE_URL"] ||
               "http://postgres-manager-#{cluster_name}:9105"

    uri = URI("#{base_url}#{path}")

    http = Net::HTTP.new(uri.host, uri.port)
    http.open_timeout = 5
    http.read_timeout = 30

    request = case method
    when :post then Net::HTTP::Post.new(uri)
    when :delete then Net::HTTP::Delete.new(uri)
    end

    request["Authorization"] = "Bearer #{api_key}"
    request["Content-Type"] = "application/json"
    request.body = body.to_json if body

    begin
      response = http.request(request)

      case response.code.to_i
      when 200..299
        return nil if response.body.to_s.empty?
        JSON.parse(response.body)
      when 401
        raise PostgresManagerAuthError,
              "Authentication failed: #{response.body}"
      when 400..499
        raise PostgresManagerError,
              "Client error (#{response.code}): #{response.body}"
      when 500..599
        raise PostgresManagerError,
              "Server error (#{response.code}): #{response.body}"
      end
    rescue Net::OpenTimeout, Net::ReadTimeout
      raise PostgresManagerTimeout,
            "Request timed out for #{uri}"
    rescue Errno::ECONNREFUSED
      raise PostgresManagerError,
            "Connection refused to #{uri}"
    end
  end
end
```

## Testing Without Real Infrastructure

One major benefit: we can now test the HTTP service without needing actual
PostgreSQL infrastructure. The old MessageBus setup required a full environment
to test end-to-end.

We created a simple test script using WebMock to stub HTTP requests:

```ruby
it "makes POST request to /databases with correct parameters" do
  stub_request(:post, "#{base_url}/databases")
    .with(
      body: { cluster: "flex001", username: "example",
              action: "create" }.to_json,
      headers: { "Authorization" => "Bearer test-api-key" }
    )
    .to_return(
      status: 200,
      body: { status: "success", message: "Database sync completed" }.to_json
    )

  result = PostgresManagerHttpClient.create_db("example", "flex001")
  expect(result["status"]).to eq("success")
end
```

We also created a local test script that runs the HTTP service without needing
database access, making it easy to verify the service works before deployment.

## Migration Strategy

We can't switch all clusters at once. The migration strategy:

1. **Deploy HTTP version alongside MessageBus** - Run both in separate
   containers
2. **Test HTTP version manually** - Verify endpoints work, check metrics
3. **Switch mothership to HTTP** - Deploy mothership changes, monitor logs
4. **Clean up MessageBus** - Stop old containers, remove environment variables

Both services can run simultaneously during migration, and rollback is just
reverting the mothership code and restarting services.

## Results

- No more duplicate operations from message replay
- Immediate visibility into success/failure
- Proper error handling with retries
- Easy to test with curl or standard HTTP tools
- Can be load balanced via Snorlax proxy
- Standard HTTP monitoring and metrics

## Lessons Learned

1. **Fire-and-forget messaging has hidden costs.** The lack of feedback made
   debugging production issues extremely difficult. We didn't know if operations
   failed until customers complained.

2. **Message replay is a feature until it's a bug.** MessageBus's backlog
   replay is useful for reliable message delivery, but caused havoc when
   operations weren't idempotent.

3. **HTTP isn't just HTTP.** Both MessageBus and our REST API use HTTP as the
   transport layer, but the patterns are completely different. The choice wasn't
   HTTP vs something else - it was pub/sub vs request/response.

4. **Testing gets easier with simpler patterns.** The old MessageBus setup
   required a full environment. The HTTP version can be tested with simple
   request/response stubs.

5. **Synchronous doesn't mean slow.** We were worried about performance, but
   the HTTP version is actually faster because there's no message queue delay.
   Operations complete immediately.

## When to Use Each Pattern

**Use pub/sub (MessageBus, Kafka, RabbitMQ) when:**
- Multiple consumers need the same event
- Order of processing matters
- You need replay capability for recovery
- Operations are idempotent

**Use request/response (REST, gRPC) when:**
- You need immediate feedback
- Operations aren't idempotent
- Failures should stop the workflow
- You want simple debugging and testing

For our postgres-manager use case, request/response was the right choice. The
operations aren't idempotent (creating a database twice is bad), we need
immediate feedback (did it work?), and we want simple debugging (just check the
HTTP response).

## Code

The full implementation is in two repositories:
- **docker-postgres/postgres-manager** - HTTP service (Sinatra)
- **mothership** - HTTP client and integration

Migration guide: `docker-postgres/postgres-manager/MIGRATION.md`
