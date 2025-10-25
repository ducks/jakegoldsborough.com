---
title: "Building Yaks: A Virtual Currency System for Discourse (Part 4:
  Custom Titles and Earning System)"
date: 2025-10-19
taxonomies:
  tags: ["discourse", "ruby", "oss"]
description: "Implementing custom user titles and the Yaks earning system.
  This post covers serializer overrides for titles and building a complete
  earning system with rate limiting, trust level requirements, and real-time
  balance updates."
---

[Part 1](/blog/2025/building-yaks-virtual-currency-part-1/) covered the
backend architecture, [Part 2](/blog/2025/building-yaks-virtual-currency-part-2/)
covered topic pinning and expiration, and [Part 3](/blog/2025/building-yaks-virtual-currency-part-3/)
covered topic boosting and custom avatar flair. This post covers two more
major features: custom user titles and the automatic earning system.

## Custom User Titles

Custom titles let users spend Yaks to set a custom title displayed next to
their username throughout the forum. Unlike Discourse's built-in title system
(which is tied to badges and trust levels), Yak titles are purely
cosmetic and time-limited.

![A reply showing a user with the custom user title "The Yaks Man"](/images/yaks-custom-title.png)

### The Challenge: Serializer Discovery

The first attempt seemed straightforward: override the `title` field in the
user serializers. But after implementing it, the title showed in user cards
and profiles but not next to posts. Why?

Discourse uses different serializer methods for different contexts:

- `title`: Used in user cards, profiles, group member lists
- `user_title`: Used specifically in `PostSerializer` for post display

This makes sense from an architecture perspective. Posts need their own
serializer method because they serialize the user as a nested object, not as
the main object.

### The Solution: Override Both

The fix required overriding both serializer methods across multiple
serializers:

```ruby
# For user cards, profiles, groups
[:post, :user_card, :post_action_user, :user_name,
 :group_post_user, :group_user, :hidden_profile].each do |serializer_name|
  add_to_serializer(serializer_name, :title) do
    title_data = object.custom_fields["yak_features"]&.dig("title")
    if title_data && title_data["enabled"]
      title_data["text"]
    else
      object.title
    end
  end
end

# For post display (critical!)
add_to_serializer(:post, :user_title) do
  user = object&.user
  return nil unless user

  title_data = user.custom_fields["yak_features"]&.dig("title")
  if title_data && title_data["enabled"]
    title_data["text"]
  else
    user.title
  end
end
```

In `PostSerializer`, `object` is a Post, so we access the user via
`object.user`. In user-focused serializers, `object` is the User directly.

### The Frontend Modal

![A modal showing user's options for creating a custom user title](/images/yaks-custom-title-modal.png)

The custom title modal is straightforward:

```javascript
@tracked customTitle = "";

get characterCount() {
  return this.customTitle.length;
}

get isOverLimit() {
  return this.characterCount > 50;
}

get canApply() {
  return this.customTitle.trim().length > 0 &&
         !this.isOverLimit &&
         this.currentUser.yak_balance >= this.cost;
}
```

Live preview, character counter, balance check. The modal shows exactly what
the title will look like before spending Yaks.

## The Earning System

This was the most complex feature to implement. Users needed a way to earn
Yaks by contributing to the community, with anti-gaming measures built in.

### Requirements

From the start, the requirements were clear:

1. Be modular (database-driven, not hardcoded)
2. Rate limiting (can't spam posts to farm Yaks)
3. Trust level requirements (new accounts can't abuse it)
4. Content length minimums (beyond Discourse's defaults, prevent low-effort farming)

### Database Schema

Instead of hardcoding earning rules in the service, we made them
database-driven:

```ruby
create_table :yak_earning_rules do |t|
  t.string :action_key, null: false
  t.string :action_name, null: false
  t.text :description
  t.integer :amount, null: false, default: 0
  t.integer :daily_cap, null: false, default: 0
  t.integer :min_trust_level, null: false, default: 0
  t.boolean :enabled, null: false, default: true
  t.jsonb :settings, default: {}
  t.timestamps
end
```

Seeded with four default rules:

1. **Post Created**: 2 Yaks, 20/day cap, TL1+, 20 character minimum
2. **Topic Created**: 5 Yaks, 10/day cap, TL1+, 50 character minimum
3. **Post Liked**: 3 Yaks, 30/day cap, TL1+
4. **Solution Accepted**: 25 Yaks, no cap, TL1+

The `settings` jsonb column allows flexible per-rule configuration like
content length minimums without schema changes.

### Service Layer

`YakEarningService` handles all validation and awarding logic:

```ruby
def self.award(user:, action_key:, related_post: nil, related_topic: nil)
  rule = YakEarningRule.get_rule(action_key)
  return false if !rule

  # Check trust level requirement
  return false if user.trust_level < rule.min_trust_level

  # Check minimum content length if applicable
  if rule.min_length > 0
    content = related_post&.raw || related_topic&.first_post&.raw || ""
    return false if content.length < rule.min_length
  end

  # Check daily cap
  if rule.has_daily_cap?
    earned_today = get_daily_earning_count(user, action_key)
    return false if earned_today >= rule.daily_cap
  end

  # Award the Yaks
  wallet = YakWallet.find_or_create_by(user: user)

  YakTransaction.create!(
    user: user,
    yak_wallet: wallet,
    amount: rule.amount,
    transaction_type: "earn",
    description: "Earned from: #{rule.action_name}",
    related_post: related_post,
    related_topic: related_topic,
  )

  wallet.update!(balance: wallet.balance + rule.amount)

  # Publish balance update to frontend
  MessageBus.publish("/yak-balance/#{user.id}",
                     { balance: wallet.balance },
                     user_ids: [user.id])

  true
end
```

The service returns a boolean so we can track success/failure in logs.

### Rate Limiting Implementation

Daily caps are enforced by counting today's transactions:

```ruby
def self.get_daily_earning_count(user, action_key)
  wallet = YakWallet.find_by(user: user)
  return 0 if !wallet

  rule = YakEarningRule.find_by(action_key: action_key)
  return 0 if !rule

  start_of_day = Time.zone.now.beginning_of_day

  YakTransaction
    .where(yak_wallet: wallet)
    .where(transaction_type: "earn")
    .where("description LIKE ?", "Earned from: #{rule.action_name}")
    .where("created_at >= ?", start_of_day)
    .count
end
```

Single query per award attempt. Could be cached if it becomes a bottleneck,
but the query is fast.

### Event Hooks

Discourse provides events for all the actions we care about:

```ruby
DiscourseEvent.on(:post_created) do |post, opts, user|
  next if post.post_type != Post.types[:regular]
  next if post.deleted_at.present?
  next if post.hidden
  next if !post.user

  YakEarningService.award(
    user: post.user,
    action_key: "post_created",
    related_post: post,
    related_topic: post.topic,
  )
end

DiscourseEvent.on(:like_created) do |post_action|
  post = post_action.post
  next if !post
  next if post.deleted_at.present?
  next if post.hidden
  next if post.user_id == post_action.user_id  # No self-likes

  YakEarningService.award(
    user: post.user,
    action_key: "post_liked",
    related_post: post,
    related_topic: post.topic,
  )
end
```

We also hook `topic_created` and `accepted_solution` (from the
discourse-solved plugin, if installed).

### Real-Time Balance Updates

The original implementation had a problem: after earning Yaks, the user menu
still showed the old balance. Page refresh required.

The fix uses MessageBus, Discourse's real-time messaging system:

**Backend**: Publish when balance changes
```ruby
MessageBus.publish("/yak-balance/#{user.id}",
                   { balance: wallet.balance },
                   user_ids: [user.id])
```

**Frontend**: Subscribe and update
```javascript
const messageBus = container.lookup("service:message-bus");
messageBus.subscribe(`/yak-balance/${currentUser.id}`, (data) => {
  currentUser.set("yak_balance", data.balance);
});
```

Now when you create a post, the balance in your user menu updates instantly.
No polling, no page refresh.

## Bugs Fixed

Some bugs were discovered during manual testing. All three would have been
caught immediately by integration tests.

### Bug 1: Event Hook User Parameter

The Discourse event signature includes a `user` parameter:

```ruby
DiscourseEvent.on(:post_created) do |post, opts, user|
```

The first implementation used that parameter directly:

```ruby
YakEarningService.award(user: user, ...)
```

But that `user` parameter is nil. The actual user must be accessed via
`post.user`. The test would have failed immediately with "User can't be
blank".

### Bug 2: Topic.raw Doesn't Exist

Content length validation tried to access `topic.raw`:

```ruby
content = related_post&.raw || related_topic&.raw || ""
```

But topics don't have a `raw` field. Only posts do. The fix:

```ruby
content = related_post&.raw || related_topic&.first_post&.raw || ""
```

A test creating a topic would have crashed with "undefined method `raw' for
Topic".

### Bug 3: Missing User in Transaction

`YakTransaction` has a `belongs_to :user` association, which validates
presence by default in Rails. But we weren't passing it:

```ruby
YakTransaction.create!(
  yak_wallet: wallet,
  amount: rule.amount,
  ...
)
```

Should be:

```ruby
YakTransaction.create!(
  user: user,
  yak_wallet: wallet,
  amount: rule.amount,
  ...
)
```

Any test attempting to create a transaction would have failed validation.

## A New Basic Test Suite Structure

The test suite covers all validation paths:

```ruby
RSpec.describe YakEarningService do
  describe ".award" do
    it "awards Yaks for valid post by TL1 user" do
      post = Fabricate(:post, user: user, raw: "This is a test post...")

      result = YakEarningService.award(
        user: post.user,
        action_key: "post_created",
        related_post: post,
        related_topic: post.topic,
      )

      expect(result).to eq(true)
      expect(user.reload.yak_balance).to eq(2)
    end

    it "does not award Yaks to TL0 user" do
      post = Fabricate(:post, user: tl0_user, raw: "...")

      result = YakEarningService.award(
        user: post.user,
        action_key: "post_created",
        related_post: post,
      )

      expect(result).to eq(false)
      expect(tl0_user.reload.yak_balance).to eq(0)
    end

    it "respects daily cap" do
      rule = YakEarningRule.find_by(action_key: "post_created")

      # Create posts up to daily cap
      rule.daily_cap.times do
        post = Fabricate(:post, user: user, raw: "...")
        YakEarningService.award(user: post.user, ...)
      end

      # Next post should fail due to cap
      post = Fabricate(:post, user: user, raw: "...")
      result = YakEarningService.award(user: post.user, ...)

      expect(result).to eq(false)
    end
  end
end
```

Tests force you to think about edge cases: trust levels, content length, daily
caps, disabled rules.

## Admin UI

![A table showing Yaks earning rules and caps](/images/yaks-earning-rules-admin.png)

The admin UI shows all earning rules in a table:

- Action name and description
- Amount of Yaks awarded
- Daily cap (or "No limit")
- Minimum trust level
- Enabled status

## Architecture Wins

**Database-Driven Configuration**: No code changes needed to adjust earning
amounts or daily caps. Just update the database.

**Event-Driven**: Loosely coupled. The earning system doesn't need to know
about post creation internals, just subscribes to events.

**Real-Time Updates**: MessageBus makes instant balance updates trivial. Six
lines of code for publish and subscribe.

**Proper Service Layer**: Business logic lives in `YakEarningService`, not
scattered across controllers and models.

**Full Audit Trail**: Every earning action creates a transaction record with
type, amount, description, and related post/topic. Complete history.

## Performance Considerations

**Single Query for Rate Limiting**: The daily count query is simple and fast.
Could be cached if it becomes a bottleneck.

**No N+1 Queries**: Balance updates happen during the transaction creation, no
separate queries.

**MessageBus Efficiency**: Only publishes to the specific user who earned
Yaks. Not broadcasting to everyone.

**Indexed Properly**: Transactions table has indexes on `yak_wallet_id`,
`transaction_type`, and `created_at` for the daily count query.

## What's Left

The plugin is now feature-complete for the MVP:

- Wallet system with transaction logging
- Multiple purchasable features (post highlighting, topic boosting, custom
  flair, custom titles)
- Expiration system (features automatically expire)
- Earning system (users earn Yaks by contributing)
- Admin UI (view stats, packages, features, earning rules)
- Real-time updates (no page refresh needed)

Remaining work:

- Payment integration (Stripe or similar) for purchasing Yak packages
- Guardian authorization checks (ensure users can only spend their own Yaks)
- More earning actions (first reply, helpful flags, etc.)
- Admin edit functionality for earning rules
- Production monitoring and adjustment based on real usage

## Lessons Learned

**Serializers Are Powerful**: Understanding Discourse's serializer
architecture unlocks a lot of customization possibilities.

**MessageBus Is Handy**: Real-time updates are easy with MessageBus, yet some
plugins don't use it.

**Database-Driven Config Is Worth It**: The upfront effort to make earning
rules configurable pays off in flexibility.

**Event Hooks Are Reliable**: Discourse's event system is solid. Events fire
consistently and provide the data you need.

## Conclusion

Building a virtual currency system is teaching me a lot about Discourse's
architecture. Serializers, custom fields, MessageBus, service objects, event
hooks - all pieces that work together to create a cohesive plugin.

The earning system was the most complex feature, but also the most rewarding.
Watching a user create a post and seeing their balance update instantly,
knowing that every piece of the system is working together (event hooks,
service validation, database transactions, MessageBus publishing, frontend
subscription) - that's satisfying.

The full source code is available at
[github.com/ducks/discourse-yaks](https://github.com/ducks/discourse-yaks).
If you're building a Discourse plugin and want to see how all these pieces fit
together, the repo should be a useful reference.

Next up: Payment integration and production deployment. Stay tuned for Part 5.
