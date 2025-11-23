---
title: "Building Yaks: A Virtual Currency System for Discourse (Part 3: Advanced Features)"
date: 2025-10-18
description: "Implementing topic-level features and user customization in the Yaks virtual currency plugin. This post covers topic boosting with global pinning and custom avatar flair."
taxonomies:
  tags:
    - discourse
    - ruby
    - oss
---

[Part 1](/blog/2025/building-yaks-virtual-currency-part-1/) covered the
backend architecture and [Part 2](/blog/2025/building-yaks-virtual-currency-part-2/)
covered topic pinning and the expiration system. This post covers two more
complex features: topic boosting (pinning topics globally with visual
highlighting) and custom avatar flair (letting users customize their forum
identity).

## Topic Pin vs Topic Boost

The plugin has two topic pinning features with different scopes:

**Topic Pin**: Pins a topic to the top of its category only. The topic stays
at the top of the category page but doesn't appear across other categories.
No visual highlighting.

**Topic Boost**: Pins a topic globally across all categories AND adds a
colored border to make it stand out in topic lists. Much more visibility,
costs more Yaks.

This post focuses on topic boost, the more powerful and visually striking
feature.

## Topic Boost: Making Threads Stand Out

Topic boost is a premium feature that pins a topic globally (across all
categories) and adds a colored border to make it stand out in topic lists.

![Topic boosting in action - a green-bordered topic stands out at the top of the topic list](/images/yaks-topic-boosting-1.png)

### Backend: Leveraging Discourse APIs

Discourse has native topic pinning built in. The API is straightforward:

```ruby
topic.update_pinned(status, global, pinned_until)
```

Parameters:
- `status`: true to pin, false to unpin
- `global`: true for global pin (all categories), false for category only
- `pinned_until`: timestamp as string (not Time object)

The service implementation for topic boost:

```ruby
when "topic_boost"
  duration = feature.settings["duration_hours"]&.hours || 72.hours
  related_topic.update_pinned(true, true, duration.from_now.to_s)

  current_features = related_topic.custom_fields["yak_features"] || {}
  current_features["boosted"] = {
    enabled: true,
    color: feature_data[:color] || "gold",
    applied_at: Time.zone.now.to_i,
  }
  related_topic.custom_fields["yak_features"] = current_features
  related_topic.save_custom_fields
```

This does two things:
1. Pins the topic globally for 72 hours using Discourse's native pinning
2. Stores visual customization data (color choice) in topic custom fields

### Frontend: Value Transformers

To apply CSS classes to boosted topics in topic lists, we use Discourse's
value transformer API. This is the modern replacement for the deprecated
widget decorators.

```javascript
api.registerValueTransformer("topic-list-item-class", ({ value, context }) => {
  const topic = context?.topic;
  if (topic?.yak_features?.boosted?.enabled) {
    value.push("yak-boosted-topic");
    const color = topic.yak_features.boosted.color || "gold";
    value.push(`yak-color-${color}`);
  }
  return value;
});
```

The transformer receives a `value` array and adds CSS classes based on the
topic's custom fields. Optional chaining (`?.`) prevents errors if the data
is missing.

We also apply styling to the first post in boosted topics:

```javascript
const topic = helper.getModel().topic;
const topicYakFeatures = topic?.yak_features;

const isFirstPostInBoostedTopic =
  post.post_number === 1 && topicYakFeatures?.boosted?.enabled;

if (isFirstPostInBoostedTopic) {
  article.classList.add("yak-boosted-topic-post");
  const color = topicYakFeatures.boosted.color || "gold";
  article.classList.add(`yak-color-${color}`);
}
```

This gives visual consistency. The colored border appears both in topic lists
and on the opening post.

### Avoiding N+1 Queries

When adding custom field serialization, you must tell Discourse to preload
the data to avoid N+1 query warnings:

```ruby
TopicList.preloaded_custom_fields << "yak_features" if TopicList.respond_to?(:preloaded_custom_fields)
```

Without this, accessing `topic.custom_fields["yak_features"]` in serializers
triggers a database query for every topic in the list. With preloading, all
custom fields load in a single query.

### Pin Auto-Dismiss Behavior

Discourse has built-in pin dismissal behavior. When a user visits a pinned
topic, Discourse creates a `TopicUser` record with `cleared_pinned_at`
timestamp. For that user, the topic shows as unpinned.

This is intentional design to prevent banner blindness. The topic stays
pinned for everyone else, but individual users can dismiss it after viewing.
The colored border remains visible to all users regardless of pin state.

### CSS Variables for Theme Customization

Originally, colors were hardcoded:

```scss
.yak-boosted-topic.yak-color-gold {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}
```

This made it difficult for theme authors to customize colors. The fix was CSS
variables:

```scss
:root {
  --yak-color-gold: #ffd700;
  --yak-color-gold-bg: rgba(255, 215, 0, 0.1);
  --yak-color-blue: #4169e1;
  --yak-color-blue-bg: rgba(65, 105, 225, 0.1);
  // ...
}

.yak-boosted-topic.yak-color-gold {
  border-color: var(--yak-color-gold);
  background: var(--yak-color-gold-bg);
}
```

Now theme authors can override colors without modifying plugin code:

```scss
:root {
  --yak-color-gold: #ff9900;
  --yak-color-gold-bg: rgba(255, 153, 0, 0.15);
}
```

## Custom Avatar Flair: User Identity

Avatar flair is the small badge that appears next to a user's avatar.
Normally it's set at the group level (moderators get one badge, admins get
another). The custom flair feature lets individual users choose their own
icon and color scheme for 30 days.

![Custom avatar flair with a purple crown icon next to the user's avatar](/images/yaks-avatar-flair.png)

### The Challenge: Integrating with Existing Components

Discourse has an existing `UserAvatarFlair` component that reads flair data
from serializers. The component expects certain fields (`flair_group_id`,
`flair_url`, `flair_bg_color`, etc.) and renders accordingly.

Initially, I tried using widget decorators to inject custom data. This hit
deprecation warnings. The modern pattern is overriding serializer fields
directly.

### Serializer Override Pattern

Instead of decorating components, we override the serializer methods:

```ruby
[:post, :user_card, :post_action_user].each do |serializer_name|
  add_to_serializer(serializer_name, :flair_url) do
    user = serializer_name == :post ? object.user : object
    flair = user.custom_fields["yak_features"]&.dig("flair")
    if flair && flair["enabled"]
      flair["icon"]  # Return icon name like "rocket" or "crown"
    else
      user.flair_group&.flair_icon || user.flair_group&.flair_upload&.url
    end
  end
end
```

This checks user custom fields first. If yak custom flair is present, return
that data. Otherwise, fall back to group flair.

Similar overrides for `flair_bg_color`, `flair_color`, and `flair_name`.
This pattern works across all serializers (post, user card, action user)
without touching the component.

### The flair_group_id Problem

The `UserAvatarFlair` component has an early return:

```javascript
if (!user || !user.flair_group_id) {
  return; // No flair rendered
}
```

Users with custom flair but no group flair would fail this check. The
component would exit early and never render anything.

The fix was setting a dummy marker value:

```ruby
add_to_serializer(serializer_name, :flair_group_id) do
  user = serializer_name == :post ? object.user : object
  flair = user.custom_fields["yak_features"]&.dig("flair")
  if flair && flair["enabled"]
    -1  # Dummy value to pass existence check
  else
    user.flair_group_id
  end
end
```

With `flair_group_id` set to `-1`, the component passes the existence check.
It then finds `flair_url` is set (to the icon name) and renders the custom
flair.

### Frontend: Icon and Color Picker

![Custom avatar flair picker modal showing red fire being selected](/images/yaks-flair-picker.png)

The flair modal presents three selection grids:

```javascript
const ICONS = ["star", "heart", "fire", "bolt", "gem", "crown", "rocket", "trophy"];
const BG_COLORS = ["#ffd700", "#4169e1", "#dc143c", "#32cd32", "#9370db", "#ff8c00"];
const TEXT_COLORS = ["#ffffff", "#000000", "#ffd700"];
```

Users click icons to select one, then choose background and text colors. A
live preview shows the combination:

```javascript
<div class="flair-preview">
  <span class="user-flair" style={{this.previewStyle}}>
    {{d-icon this.selectedIcon}}
  </span>
</div>
```

The preview updates reactively as selections change. Once the user confirms,
the modal sends the choices to the backend, which stores them in user custom
fields.

### Making Feature Cards Clickable

On the wallet page, custom flair is the only feature that needs a modal
(icon/color picker). Other features just need a color picker, which is
handled inline.

To make the custom flair card clickable, we split the template:

```javascript
{{#if (eq feature.id "custom_flair")}}
  <div class="feature-card clickable" {{on "click" this.openFlairModal}}>
    {{! card content }}
  </div>
{{else}}
  <div class="feature-card">
    {{! card content }}
  </div>
{{/if}}
```

Only the custom flair card gets the click handler. Other cards remain static.
This avoids passing `undefined` callbacks to the `{{on}}` helper.

## What's Next

The plugin now has:
- Post highlighting (colored borders)
- Topic pinning (category-only)
- Topic boosting (global pin + highlight)
- Custom avatar flair (user identity)

Still to implement:
- Post pinning (pin individual post to top of topic)
- Post boosting (increase visibility in feeds)
- Earning system (auto-reward quality posts)
- Guardian authorization (permission checks)
- Admin dashboard improvements

The earning system is the next major piece. Right now, users can only spend
Yaks. They need ways to earn them through quality contributions, not just
purchases.

Code is on GitHub: [ducks/discourse-yaks](https://github.com/ducks/discourse-yaks)
