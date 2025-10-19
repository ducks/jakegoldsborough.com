+++
title = "Building Yaks: A Virtual Currency System for Discourse (Part 1: Backend Architecture)"
date = 2025-10-11
description = "Building a virtual currency plugin for Discourse. Part 1 covers the backend architecture: wallets, transactions, features, and the service layer that ties it together."

[taxonomies]
tags = ["discourse", "ruby", "oss"]
+++

I'm building a virtual currency system for Discourse. Users earn and spend
"Yaks" on premium post features like colored highlighting, pinned posts, and
custom user flair.

![Image showing 1000 Yaks in wallet](/images/yaks-wallet.png)

![Post highlighting with purple border](/images/yaks-highlighted-post-1.png)

This is Part 1 of a series documenting the development. This post focuses on
the backend architecture. Future posts will cover the frontend UI, earning
mechanisms, and feature implementations.

## Why Yaks?

The name works on two levels. First, "yak" as a verb means to talk or chat
persistently. Forums are where people yak.

Second, "yak shaving" is programmer slang for doing a seemingly pointless
series of tasks. Unfortunately, sometimes, talking (arguing) with people online
can feel apparently useless. The name acknowledges that.

## Why Virtual Currency?

Forums have moderation tools and permission systems, but they're binary: you
can do something or you can't. Virtual currency adds a middle layer where users
can temporarily access premium features by spending earned currency.

The use cases:
- Highlight important posts with colored borders
- Pin your post to the top of a topic for 24 hours
- Add custom flair next to your username
- Boost your post in feeds and search results

These aren't permissions. They're temporary, purchasable upgrades.

## The Data Model

The system has four core models:

### YakWallet

Each user has a wallet that tracks their balance and lifetime totals:

```ruby
class YakWallet < ActiveRecord::Base
  belongs_to :user
  has_many :yak_transactions

  validates :balance, numericality: { greater_than_or_equal_to: 0 }
  validates :lifetime_earned, numericality: { greater_than_or_equal_to: 0 }
  validates :lifetime_spent, numericality: { greater_than_or_equal_to: 0 }
end
```

The wallet is the source of truth for a user's currency. Every earn, spend, and
refund goes through it.

### YakTransaction

Every balance change is logged. This creates an immutable audit trail:

```ruby
class YakTransaction < ActiveRecord::Base
  belongs_to :user
  belongs_to :yak_wallet

  enum transaction_type: { earn: 0, spend: 1, refund: 2 }
end
```

Transactions include:
- Amount (positive for earn/refund, negative for spend)
- Type (earn, spend, refund)
- Source (where it came from: `stripe_purchase`, `quality_post`,
  `feature_post_highlight`)
- Description (human-readable explanation)
- Metadata (JSON field for additional context)
- Related post/topic (if applicable)

Why log everything? Transparency. Users can see exactly where their Yaks went.
Admins can debug balance issues. Refunds are straightforward because you have
the original transaction ID.

### YakFeature

Features define what users can spend Yaks on:

```ruby
class YakFeature < ActiveRecord::Base
  has_many :yak_feature_uses

  validates :feature_key, presence: true, uniqueness: true
  validates :cost, numericality: { greater_than: 0 }
  validates :category, inclusion: { in: %w[post user topic] }
end
```

Each feature has:
- A unique key (`post_highlight`, `post_pin`)
- Display name and description
- Cost in Yaks
- Category (post, user, topic)
- Settings (duration, default values, constraints)

Currently implemented:
- **Post Highlighting** (25 Yaks): Colored border and background (gold, blue,
  red, green, purple)

Planned features:
- **Post Pin** (50 Yaks): Pin to top of topic for 24 hours
- **Custom Flair** (100 Yaks): Custom text next to username for 30 days
- **Post Boost** (30 Yaks): Priority in feeds for 72 hours

The cost is per feature, not per variation. Post highlighting costs 25 Yaks
regardless of which color you choose.

### YakFeatureUse

When a user purchases a feature, we create a YakFeatureUse record:

```ruby
class YakFeatureUse < ActiveRecord::Base
  belongs_to :user
  belongs_to :yak_feature
  belongs_to :yak_transaction
  belongs_to :related_post, class_name: "Post", optional: true
  belongs_to :related_topic, class_name: "Topic", optional: true

  scope :active, -> { where("expires_at IS NULL OR expires_at > ?", Time.zone.now) }
end
```

This tracks:
- Who applied the feature
- Which feature was applied
- What post/topic it was applied to
- When it expires (if applicable)
- Feature-specific data (color choice, custom text, etc.)

The `active` scope makes it easy to query currently active features and clean
up expired ones.

## The Service Layer

Business logic lives in services, not controllers. Controllers handle HTTP,
services handle business rules.

### What Are Services?

Discourse has a standardized service pattern using `Service::Base`. Services
define:
- **Contracts**: Input validation using schemas
- **Policies**: Preconditions that must be true
- **Steps**: The actual execution flow

Example structure:
```ruby
class MyService < Service::Base
  contract do
    attribute :user_id, :integer
    validates :user_id, presence: true
  end

  policy :user_exists
  step :do_work

  private

  def user_exists
    User.exists?(id: contract.user_id)
  end

  def do_work
    # actual logic
  end
end
```

This pattern separates validation, authorization, and execution. If the
contract fails, the service returns an error before hitting any business logic.
If a policy fails, execution stops.

### YakFeatureService

The Yaks plugin currently uses a simpler service pattern (a plain Ruby class
with class methods) because the logic is straightforward. It could be
refactored to `Service::Base` if validation becomes more complex.

The service handles:
1. Validating the feature exists and is enabled
2. Checking the user can afford it
3. Checking the feature can be applied (no duplicate active uses)
4. Creating the transaction
5. Creating the feature use record
6. Applying the visual effects

```ruby
def self.apply_feature(user, feature_key, related_post: nil, feature_data: {})
  feature = YakFeature.enabled.find_by(feature_key: feature_key)
  return { success: false, error: "Feature not found" } unless feature

  return { success: false, error: "Insufficient balance" } unless feature.affordable_by?(user)

  wallet = YakWallet.for_user(user)

  transaction = wallet.spend_yaks(
    feature.cost,
    feature_key,
    "Applied #{feature.feature_name}",
    related_post_id: related_post&.id,
    metadata: feature_data
  )

  return { success: false, error: "Insufficient balance" } unless transaction

  feature_use = YakFeatureUse.create!(
    user: user,
    yak_feature: feature,
    yak_transaction: transaction,
    related_post: related_post,
    expires_at: calculate_expiration(feature),
    feature_data: feature_data
  )

  apply_feature_effects(feature_key, related_post, feature_data)

  { success: true, feature_use: feature_use, new_balance: user.yak_balance }
end
```

Why put this in a service instead of the controller? Because controllers should
handle HTTP concerns (params, rendering, status codes). Business logic
(validating affordability, deducting currency, applying effects) belongs in a
service.

This makes testing easier. You can test the business logic without setting up
HTTP requests. You can reuse the service from rake tasks, background jobs, or
the Rails console.

### The Double Balance Check

Notice the service checks affordability twice:

```ruby
# First check
return { success: false, error: "Insufficient balance" } unless feature.affordable_by?(user)

wallet = YakWallet.for_user(user)

# Second check (wallet.spend_yaks returns nil if balance insufficient)
transaction = wallet.spend_yaks(...)
return { success: false, error: "Insufficient balance" } unless transaction
```

Why check twice? Race conditions.

Between the first check and the actual spend, another request could deduct from
the user's balance. Without the second check, you could end up with negative
balances.

The first check is an optimization (fail fast before loading the wallet). The
second check is correctness (verify balance inside the database transaction).

The wallet's `spend_yaks` method uses ActiveRecord transactions:

```ruby
def spend_yaks(amount, feature_key, description, options = {})
  return nil if amount <= 0 || balance < amount

  transaction do
    decrement!(:balance, amount)
    increment!(:lifetime_spent, amount)
    yak_transactions.create!(...)
  end
end
```

If the balance check fails inside the transaction, it returns `nil` and nothing
is deducted. This prevents concurrent requests from causing overdrafts.

## Applying Features

Features modify post custom fields:

```ruby
def self.apply_feature_effects(feature_key, post, feature_data)
  current_features = post.custom_fields["yak_features"] || {}

  case feature_key
  when "post_highlight"
    current_features["highlight"] = {
      enabled: true,
      color: feature_data[:color] || "gold",
      applied_at: Time.zone.now.to_i
    }
  when "post_pin"
    current_features["pinned"] = { enabled: true, applied_at: Time.zone.now.to_i }
  end

  post.custom_fields["yak_features"] = current_features
  post.save_custom_fields
end
```

Custom fields are Discourse's way of extending models without migrations. The
`yak_features` field stores a JSON object with all active features on a post.

This data gets serialized to the frontend:

```ruby
add_to_serializer(
  :post,
  :yak_features,
  include_condition: -> { object.custom_fields["yak_features"].present? }
) do
  object.custom_fields["yak_features"]
end
```

The frontend can then read `post.yak_features.highlight.color` and apply the
appropriate CSS.

## Current State

The backend is complete:
- Wallet management with balance tracking
- Transaction logging with full audit trail
- Feature definitions with costs and durations
- Service layer for applying features
- Custom field serialization for the frontend

What's missing:
- Frontend UI for viewing balance and purchasing features
- Earning mechanisms (quality posts, admin grants, purchases)
- Feature expiration cleanup job
- Admin dashboard for managing features and viewing stats

## Next Steps

Part 2 will cover building the frontend UI: displaying the user's balance,
browsing available features, and adding a "spend Yaks" button to posts.

Part 3 will cover earning mechanisms and the admin dashboard.

The code is on GitHub: [ducks/discourse-yaks](https://github.com/ducks/discourse-yaks)
