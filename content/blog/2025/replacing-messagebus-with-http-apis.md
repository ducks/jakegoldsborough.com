---
title: "Replacing MessageBus Pub/Sub with REST APIs: Fixing Production
Outages"
date: 2025-10-27
description: "Converting postgres-manager from fire-and-forget MessageBus to
synchronous HTTP APIs to eliminate message replay issues and gain operational
visibility."
---

We're converting one of our infrastructure services from MessageBus pub/sub to
a synchronous REST API. This isn't a protocol change or upgrade - both
architectures use HTTP. This is about replacing fire-and-forget asynchronous
messaging with request/response patterns that provide immediate feedback.

The control plane manages hundreds of Discourse forums across multiple data
centers. It needs to orchestrate PostgreSQL user and database creation across
these distributed clusters.

## The Problem

Our `postgres-manager` service handles PostgreSQL user and database lifecycle
for Discourse hosted sites. It was built using `ServiceSkeleton`, a Ruby
framework for message-driven services, subscribing to MessageBus channels for
commands.

MessageBus uses HTTP long-polling for pub/sub messaging. Publishers send
messages to channels, subscribers open long-lived HTTP connections and wait for
messages to arrive. It works well for many use cases, but we've hit two
critical problems:

1. No feedback mechanism. When the control plane published a message like
"create database for site X", it had no way to know if the operation succeeded
or failed. The message was sent and forgotten.

2. Message replay on restarts. MessageBus keeps a backlog of messages. When
postgres-manager restarts, it replays unacknowledged messages, causing duplicate
operations. We've had multiple production outages from databases being recreated
or users being decommissioned twice.

The message replay issue is the immediate trigger, but the lack of feedback is
the underlying architectural problem. We need synchronous request/response
patterns with immediate success/failure feedback.

## The Solution: REST API with Request/Response

We're converting postgres-manager to a Sinatra HTTP service that responds
synchronously to requests. Instead of subscribing to MessageBus channels, it
will expose REST endpoints:

- `POST /databases` - Create database and user
- `DELETE /databases/:username` - Decommission database
- `POST /users` - Create user (triggers sync)
- `DELETE /users/:username` - Decommission user
- `POST /sync` - Sync all databases/users from control plane

Each endpoint will return an immediate response with proper HTTP status codes:
200 for success, 401 for auth failures, 400 for bad parameters, 500 for server
errors.

## Implementation

### Before: ServiceSkeleton with MessageBus

The old implementation used ServiceSkeleton to subscribe to MessageBus:

```ruby
message_bus = MessageBus::HTTPClient.new(
  config.control_plane_base_url,
  headers: { "Discourse-Access-Token" => config.control_plane_token }
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

The control plane would publish messages:

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

The control plane will make HTTP requests and get immediate responses:

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

## Testing Strategy: Unit and Integration Tests

The HTTP service has a test suite with 54 tests covering both unit and
integration testing:

### Unit Tests (16 tests, no PostgreSQL required)

Unit tests use WebMock to stub external dependencies:

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

These tests run fast (under 1 second) and validate HTTP client logic, metrics
tracking, and configuration handling without requiring PostgreSQL.

### Integration Tests (38 tests, with real PostgreSQL)

Integration tests use Docker to automatically start/stop PostgreSQL and test
real database operations:

```ruby
it 'creates database and user' do
  multisite_config = {
    "example" => {
      "username" => "example",
      "password" => "test123",
      "database" => "example_discourse"
    }
  }

  stub_request(:get, "http://mothership.test/api/multisite_config?container_name=test-cluster")
    .to_return(status: 200, body: JSON.dump(multisite_config))

  result = sync.perform

  # Verify in actual PostgreSQL
  sync.database.with_db('postgres') do |db|
    user_result = db.exec_params('SELECT usename FROM pg_user WHERE usename = $1', ['example'])
    expect(user_result.ntuples).to eq(1)

    db_result = db.exec_params('SELECT datname FROM pg_database WHERE datname = $1', ['example_discourse'])
    expect(db_result.ntuples).to eq(1)
  end
end
```

### Idempotency Tests

Critical tests verify the service handles message replay scenarios that caused
production outages:

```ruby
it 'handles rapid duplicate creates (race condition simulation)' do
  threads = 2.times.map do
    Thread.new do
      begin
        database.create(test_db, test_user)
      rescue PG::DuplicateDatabase
        # Expected - one thread wins, other gets duplicate error
      end
    end
  end
  threads.each(&:join)

  # Verify only one database created
  database.with_db('postgres') do |db|
    result = db.exec_params('SELECT datname FROM pg_database WHERE datname = $1', [test_db])
    expect(result.ntuples).to eq(1)
  end
end
```

These tests validate that calling create operations multiple times (as happens
during message replay) doesn't cause crashes or duplicate resources.

## Migration Strategy

We can't switch all clusters at once. The migration strategy:

1. Deploy HTTP version alongside MessageBus - Run both in separate
   containers
2. Test HTTP version manually - Verify endpoints work, check metrics
3. Switch control plane to HTTP - Deploy control plane changes, monitor logs
4. Clean up MessageBus - Stop old containers, remove environment variables

Both services can run simultaneously during migration, and rollback is just
reverting the control plane code and restarting services.

## Expected Results

- No more duplicate operations from message replay
- Immediate visibility into success/failure
- Proper error handling with retries
- Easy to test with curl or standard HTTP tools
- Can be load balanced through standard proxies
- Standard HTTP monitoring and metrics

## Outcomes

1. Fire-and-forget messaging has hidden costs. The lack of feedback makes
debugging production issues extremely difficult. We don't know if operations
fail until customers complain.

2. Message replay is a feature until it's a bug. MessageBus's backlog replay is
useful for reliable message delivery, but causes havoc when operations aren't
idempotent.

3. Different HTTP patterns, same protocol. Both MessageBus (HTTP long-polling)
and our REST API use HTTP for transport, but serve fundamentally different
communication patterns. MessageBus uses HTTP to implement pub/sub messaging
(asynchronous, one-to-many), while REST implements request/response
(synchronous, one-to-one). The choice isn't HTTP vs something else - it's
choosing the right messaging pattern for your use case.

4. Testing gets easier with simpler patterns. The old MessageBus setup requires
a full environment. The HTTP version can be tested with simple request/response
stubs.

## Summary

This migration will take our infrastructure service from fire-and-forget
messaging to synchronous request/response patterns. The expected result: no more
duplicate operations, immediate feedback on success/failure, and much simpler
debugging. Sometimes the solution isn't choosing new technology - it's choosing
the right pattern for your use case.

## Current Status

The HTTP service implementation is complete and tested:

- Modular architecture with 6 separated modules (Config, Database, User,
  Client, Sync, Metrics)
- Test suite (16 unit tests, 38 integration, all passing)
- RuboCop clean (zero offenses)
- Security fixes (parameterized queries, retry limits)
- GitHub Actions CI configured and passing

The service is production-ready and awaiting deployment to test clusters. Once
validated with real PostgreSQL operations and monitored for stability, we'll
proceed with gradual rollout to production infrastructure.
