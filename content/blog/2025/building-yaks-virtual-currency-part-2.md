---
title: "Building Yaks: A Virtual Currency System for Discourse (Part 2:
  Features and Expiration)"
date: 2025-10-17
tags: ["discourse", "ruby", "oss"]
description: "Part 2 covers implementing topic pinning, building a modular service architecture, and creating an expiration system with background jobs."
---

In [Part 1](/blog/2025/building-yaks-virtual-currency-part-1), I covered
the backend architecture for Yaks: wallets, transactions, and the service
layer. The database models were in place, but the system could only apply
one feature (post highlighting) and had no way to clean up expired features.

Part 2 covers:
- Implementing topic pinning (our second feature)
- Refactoring the service layer to be truly modular
- Building an expiration system with background jobs
- Starting the admin configuration UI

![Spend Yaks button on topic footer](/images/spend-yaks.png)

![Spend Yaks modal showing available features](/images/spend-yaks-2.png)

## Topic Pinning

Topic pinning lets users spend Yaks to pin their topic to the top of its
category for a configurable duration. This uses Discourse's native pinning
mechanism, but requires currency to access.

### Why This Feature Matters

Forums prioritize content by recency. Older discussions get buried. Topic
pinning gives users a way to temporarily boost visibility for important
discussions without needing moderator intervention.

The constraint is time. After the configured duration expires, the pin is
removed and the topic returns to normal sorting.

### The Service Architecture Problem

When implementing topic pinning, I hit an architectural issue. The existing
`YakFeatureService.apply_feature` method was post-centric:

```ruby
def self.apply_feature(user, feature_key, related_post, feature_data: {})
  # ... validation logic ...

  feature_use = YakFeatureUse.create!(
    user: user,
    yak_feature: feature,
    related_post: related_post,  # Always requires a post
    feature_data: feature_data
  )
end
```

This design assumed every feature applies to a post. But topic pinning
applies to a topic, not a post. I could hack around it by passing
`related_post.topic`, but that's wrong. The service should support both
contexts.

Looking at the implementation, the issue was clear. The service wasn't
modular at all. It was built for posts and only posts. Adding topic
support meant refactoring the core design.

### Refactoring the Service

The fix was adding support for both posts and topics:

```ruby
# Old (post-centric)
def self.apply_feature(user, feature_key, related_post, feature_data: {})

# New (modular, all keyword)
def self.apply_feature(
  user:,
  feature_key:,
  related_post: nil,
  related_topic: nil,
  feature_data: {}
)
```

Now the service accepts either a post or a topic (or neither, for
user-level features like custom flair). Making all parameters keyword
arguments forces explicit call sites, which prevents mistakes when you have
multiple optional params.

Validation got context-specific methods:

```ruby
def self.can_apply_to_post?(feature_key, post, user)
  return false if post.trashed? || post.deleted_at.present?
  return false if post.user_id != user.id

  # Check for existing active feature
  !YakFeatureUse.exists?(
    user: user,
    yak_feature: YakFeature.find_by(feature_key: feature_key),
    related_post: post,
    expires_at: Time.zone.now..Float::INFINITY
  )
end

def self.can_apply_to_topic?(feature_key, topic, user)
  return false if topic.closed || topic.archived
  return false if topic.user_id != user.id

  # Check for existing active feature
  !YakFeatureUse.exists?(
    user: user,
    yak_feature: YakFeature.find_by(feature_key: feature_key),
    related_topic: topic,
    expires_at: Time.zone.now..Float::INFINITY
  )
end
```

This pattern will scale. When we add user-level features (custom flair),
we'll add `can_apply_to_user?` without touching the core service logic.

### Integrating with Discourse's Topic Pinning

Discourse has built-in topic pinning. The `Topic` model has an
`update_pinned` method:

```ruby
duration = feature.duration_hours.hours
topic.update_pinned(true, false, duration.from_now.to_s)
```

Three parameters:
1. `pinned` - Enable or disable the pin
2. `global` - Pin globally (across all categories) or just in this topic's
   category
3. `pinned_until` - When to automatically unpin (must be a string timestamp)

The third parameter is critical. It must be a string, not a Time object.
This caught me during implementation:

```ruby
# Wrong (creates YakFeatureUse but topic doesn't actually pin)
topic.update_pinned(true, false, feature.duration_hours.hours.from_now)

# Correct
topic.update_pinned(true, false, feature.duration_hours.hours.from_now.to_s)
```

The feature use was being created, the Yaks were being deducted, but the
topic wasn't pinning. The issue was the timestamp format. `update_pinned`
silently fails if you pass a Time object instead of a string.

## Expiration System

Features need to expire. Each feature has a configurable duration stored in
the database. We need a way to clean up expired features and undo their
effects.

### The Architecture

The system has three parts:

1. **Regular Job**: `ExpireYakFeature` - Handles a single expiration
2. **Scheduled Job**: `CleanupExpiredYakFeatures` - Finds expired features
   and queues regular jobs
3. **Service Method**: `YakFeatureService.expire_feature` - Business logic
   for expiration

The primary expiration mechanism runs at creation time. When a feature use
is created, the expiration job is scheduled to run exactly when it expires:

```ruby
def self.apply_feature(...)
  feature_use = YakFeatureUse.create!(...)

  if feature_use.expires_at
    Jobs.enqueue_at(feature_use.expires_at, :expire_yak_feature,
      feature_use_id: feature_use.id)
  end

  # ...
end
```

This is efficient. No polling. The job runs exactly when needed.

### The Scheduled Job

Runs hourly to find expired features:

```ruby
module Jobs
  class CleanupExpiredYakFeatures < ::Jobs::Scheduled
    every 1.hour

    def execute(args)
      expired_features = YakFeatureUse
        .where("expires_at IS NOT NULL AND expires_at <= ?", Time.zone.now)
        .where(expired: false)

      expired_features.find_each do |feature_use|
        Jobs.enqueue(:expire_yak_feature, feature_use_id: feature_use.id)
      end

      { processed: expired_features.count }
    end
  end
end
```

It queries for expired features (where `expires_at` is in the past) and
queues a job for each one.

This hourly cleanup job is a safety net. If the server restarts before a
scheduled job runs, or if something goes wrong with job scheduling, the
cleanup job catches it. It's backup, not the primary mechanism.

Why `find_each` instead of `each`? Performance. `find_each` loads records
in batches (1000 by default) instead of loading everything into memory. If
you have 10,000 expired features, `each` would load all 10,000 at once.
`find_each` loads 1000, processes them, loads the next 1000.

### The Regular Job

Processes one expiration:

```ruby
module Jobs
  class ExpireYakFeature < ::Jobs::Base
    def execute(args)
      feature_use = YakFeatureUse.find_by(id: args[:feature_use_id])
      return unless feature_use

      YakFeatureService.expire_feature(feature_use)
    end
  end
end
```

Why a separate job? Fault tolerance. If one expiration fails (database
error, bug in the expiration logic), it doesn't stop the others from
processing.

### The Service Method

Handles the business logic:

```ruby
def self.expire_feature(feature_use)
  feature_key = feature_use.yak_feature.feature_key

  case feature_key
  when "post_highlight"
    remove_post_highlight(feature_use.related_post)
  when "topic_pin"
    unpin_topic(feature_use.related_topic)
  end

  feature_use.update!(expired: true)
end

private

def self.remove_post_highlight(post)
  return unless post

  features = post.custom_fields["yak_features"] || {}
  features.delete("highlight")

  if features.empty?
    post.custom_fields.delete("yak_features")
  else
    post.custom_fields["yak_features"] = features
  end

  post.save_custom_fields
end

def self.unpin_topic(topic)
  return unless topic
  topic.update_pinned(false, false, nil)
end
```

Expiration removes the visual effects and marks the feature use as expired.

Why mark as expired instead of deleting? Audit trail. Users can see their
feature history. Admins can debug issues. Refunds are easier because you
have the original feature use record.

## Frontend Integration

The frontend needed two things:
1. A "Spend Yaks" button on topics
2. Context-aware modal that shows appropriate features

### Topic Footer Button

Discourse has an API for adding buttons to topic footers:

```javascript
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "yak-topic-actions",
  initialize() {
    withPluginApi((api) => {
      api.registerTopicFooterButton({
        id: "yak-spend",
        icon: "coins",
        label: "yaks.topic_action.spend",
        action() {
          const modal = getOwner(this).lookup("service:modal");
          modal.show(SpendYaksModal, {
            model: {
              topic: this.topic,
            },
          });
        },
        dropdown() {
          return this.site.mobileView;
        },
        classNames: ["yak-spend"],
        dependentKeys: ["topic.closed", "topic.archived"],
        displayed() {
          return (
            this.currentUser &&
            this.topic.user_id === this.currentUser.id &&
            !this.topic.closed &&
            !this.topic.archived
          );
        },
      });
    });
  },
};
```

The `displayed()` function controls visibility. The button only shows if:
- User is logged in
- User owns the topic
- Topic isn't closed or archived

### Context-Aware Modal

The modal needed to work for both posts and topics:

```javascript
export default class SpendYaksModal extends Component {
  get isPostContext() {
    return !!this.args.model.post;
  }

  get isTopicContext() {
    return !!this.args.model.topic && !this.args.model.post;
  }

  get postFeatures() {
    return this.allFeatures.filter((f) => f.category === "post");
  }

  get topicFeatures() {
    return this.allFeatures.filter((f) => f.category === "topic");
  }

  get availableFeatures() {
    if (this.isPostContext) return this.postFeatures;
    if (this.isTopicContext) return this.topicFeatures;
    return [];
  }
}
```

One modal, two contexts. The UI adapts based on whether you clicked "Spend
Yaks" on a post or a topic.

## Admin UI (In Progress)

The final piece is admin configuration. Currently, features and purchase
packages are hardcoded. They need to be editable in the UI.

### Database-Backed Packages

Created a `yak_packages` table:

```ruby
create_table :yak_packages do |t|
  t.string :name, null: false
  t.text :description
  t.integer :price_cents, null: false, default: 0
  t.integer :yaks, null: false, default: 0
  t.integer :bonus_yaks, null: false, default: 0
  t.boolean :enabled, null: false, default: true
  t.integer :position, null: false, default: 0
  t.timestamps
end
```

Price is stored as cents (integers) instead of dollars (floats) to avoid
floating-point precision issues. A $5.00 package is 500 cents.

The model has helper methods:

```ruby
class YakPackage < ActiveRecord::Base
  def total_yaks
    yaks + bonus_yaks
  end

  def price_usd
    price_cents / 100.0
  end

  def price_usd=(usd)
    self.price_cents = (usd.to_f * 100).to_i
  end
end
```

This lets you work in dollars in the UI but store as cents in the database.

### CRUD Endpoints

Added REST endpoints to the admin controller:

```ruby
def packages
  packages = YakPackage.ordered
  render json: { packages: packages.map { |p| serialize_package(p) } }
end

def create_package
  package = YakPackage.new(package_params)
  if package.save
    render json: { package: serialize_package(package) }
  else
    render_json_error(package.errors.full_messages.join(", "))
  end
end

def update_package
  package = YakPackage.find(params[:id])
  if package.update(package_params)
    render json: { package: serialize_package(package) }
  else
    render_json_error(package.errors.full_messages.join(", "))
  end
end

def delete_package
  package = YakPackage.find(params[:id])
  package.destroy!
  render json: success_json
end
```

Standard Rails REST pattern. The admin can create, edit, and delete
packages without touching code.

### Admin UI Structure

The UI follows Discourse's admin plugin pattern (inspired by the Chat
plugin):

```
admin/assets/javascripts/discourse/
├── routes/admin-plugins/show/discourse-yaks-management/
├── controllers/admin-plugins/show/discourse-yaks-management/
├── templates/admin/plugins/show/discourse-yaks-management/
└── initializers/yaks-admin-plugin-configuration-nav.js
```

The structure creates tabs:
1. **Settings** - Site settings (automatic)
2. **Management** - Custom UI for packages, features, stats

The templates use Discourse's admin components:

```hbs
<div class="admin-config-page">
  <div class="admin-plugin-config-page">
    <div class="d-page-header">
      <div class="d-page-header__title-row">
        <h1 class="d-page-header__title">Yak Management</h1>
      </div>
      <p class="d-page-header__description">
        Manage your virtual currency system. Configure purchase packages
        and premium features.
      </p>
    </div>

    <div class="admin-plugin-config-page__content">
      <!-- Tables for stats, packages, features -->
    </div>
  </div>
</div>
```

This matches Discourse's standard admin page structure. Using the
framework's components ensures consistency with the rest of the admin area.

### Current Status

The admin UI backend is complete (CRUD endpoints, modals, tables), but the
tab navigation isn't working yet. The Settings tab appears, but the
Management tab doesn't. This is a routing issue, not a data issue.

The tables work when accessed directly. The functionality is there. The
navigation just needs debugging.

## What's Next

The immediate task is fixing the admin UI tab navigation. Once that's
working, admins will have full control over the system configuration:
- Add/edit/delete purchase packages (price, Yak amounts, bonus structure)
- Configure feature costs and durations (how many Yaks, how long they last)
- View system statistics (total wallets, Yaks in circulation, active
  features)

After that:
- Implement the earning system (reward quality posts based on configurable
  criteria)
- Build the remaining features (post pin, post boost, custom flair)
- Add purchase flow integration (Stripe for buying Yaks with real money)

The plugin is functional. Two features work end-to-end. The expiration
system is running. The architecture is modular enough to add new features
without major refactoring.

Part 3 will cover the earning system and completing the admin UI.

The code is on GitHub: [ducks/discourse-yaks](https://github.com/ducks/discourse-yaks)
