---
title: "Building The Guest Spot: Part 2 - Two Refactors"
date: 2025-10-26
description: "Two major refactors: custom model to Topics, then custom feed to plugin outlets. Less code, more features, better maintainability."

taxonomies:
  tags:
    - discourse
    - ruby
    - ember
---

In [Part 1](/blog/2025/building-the-guest-spot-part-1/), I built an Instagram-style showcase using a custom `GuestSpotPost` model. It worked. But it also meant maintaining a parallel data structure instead of leveraging what Discourse already provides.

This post covers two major refactors: first from custom models to Discourse Topics, then from custom feed infrastructure to plugin outlets. Each time, less code gave me more features.

## Why Refactor?

The custom model approach had problems:

- Duplicate logic: Comments, moderation, spam protection already exist for Topics
- Extra maintenance: Every time Discourse updates, potential breakage
- Missing features: No native file upload, no revision history, no trust levels
- More code: Separate serializers, separate permissions, separate everything

Discourse Topics already have everything we need:
- First post holds the caption and images
- Title can be auto-generated
- Categories handle public vs private
- Pinning is built-in
- Commenting works out of the box

The showcase is just a custom view of Topics in the "Public Feed" category.

## The Refactor

### Backend Changes

Deleted the entire `GuestSpotPost` model and migrations. Instead, the controller now works with Topics:

```ruby
# app/controllers/guest_spot/posts_controller.rb
def index
  category_id = CategoryHelper.public_feed_category_id

  topics = Topic
    .where(category_id: category_id)
    .where(deleted_at: nil)
    .includes(:user, posts: :uploads)
    .order(created_at: :desc)
    .limit(50)

  pinned_topics = Topic
    .where(category_id: category_id)
    .where(deleted_at: nil)
    .where.not(pinned_at: nil)
    .includes(:user, posts: :uploads)
    .order(created_at: :desc)

  render json: {
    posts: serialize_data(topics, GuestSpotPostSerializer),
    pinned: serialize_data(pinned_topics, GuestSpotPostSerializer)
  }
end
```

The serializer extracts what we need from Topics:

```ruby
# app/serializers/guest_spot_post_serializer.rb
class GuestSpotPostSerializer < ApplicationSerializer
  attributes :id, :user_id, :username, :caption, :image_urls, :created_at, :pinned

  def caption
    object.first_post&.raw || ""
  end

  def image_urls
    object.first_post.uploads.map { |upload| UrlHelper.absolute(upload.url) }
  end

  def pinned
    object.pinned_at.present?
  end
end
```

Caption is the post content. Images come from uploads. Pinned status is the native `pinned_at` field.

### Creating Posts

Instead of `GuestSpotPost.create`, we use `TopicCreator`:

```ruby
def create
  category_id = CategoryHelper.public_feed_category_id
  title = "@#{current_user.username} - #{Time.now.to_i}"

  topic_creator = TopicCreator.new(
    current_user,
    Guardian.new(current_user),
    category: category_id,
    title: title,
    raw: params[:caption] || ""
  )

  topic = topic_creator.create
  render_serialized(topic, GuestSpotPostSerializer)
end
```

Auto-generated titles keep them unique. The caption goes in the first post's raw content. Image uploads attach automatically through Discourse's existing upload system.

### Frontend Changes

Frontend barely changed. The serializer provides the same JSON structure, so components worked as-is. The only update was changing `@post.id` to reference topic IDs instead of custom model IDs.

### What This Got Us

The refactor from custom models to Topics gave us:
- Comments work natively (no custom implementation)
- Moderation tools work (flags, hiding, deleting)
- File uploads work (native uploader)
- Revision history works (edit tracking)
- Trust levels work (spam protection)
- All for free, by using what Discourse already provides

But I still had a custom feed with its own routes, controllers, and serializers. That was the next problem to solve.

## Going Native: Deleting the Custom Feed

In Part 1, I built a custom `GuestSpotPost` model. Then I realized that was
overkill and refactored to use Discourse Topics. But I kept the custom feed
with its own routes, controllers, and serializers.

After implementing that custom feed, I realized there was an uncomfortable
disconnect. Users would browse an Instagram-style feed, click a post, and
suddenly land in Discourse's standard topic view. The context switch was jarring.

The question became: why maintain a custom feed at all? If the custom model
was unnecessary, maybe the custom feed was too.

Discourse already has everything we need:
- Category pages show topic lists
- Category permissions control who can post and who can view
- Native pinning highlights featured content
- Theme system allows extensive visual customization

Instead of maintaining a parallel feed system, we could just make the Public
Feed category look great using plugin outlets.

### The Deletion

I deleted the entire custom feed infrastructure:

**Removed (1,078 lines)**:
- Custom feed routes and controllers (`guest_spot/feed_controller.rb`,
  `guest_spot/posts_controller.rb`)
- Custom post serializer (`guest_spot_post_serializer.rb`)
- All custom Ember components (`guest-spot-feed.gjs`,
  `guest-spot-post-card.gjs`)
- Custom route definitions and templates
- Multiple initializers for hiding UI elements

**Added (264 lines)**:
- Single plugin outlet connector:
  `assets/javascripts/discourse/connectors/topic-list-item/guest-spot-item.gjs`
- CSS Grid layout for responsive cards

Net result: 814 fewer lines of code.

### Plugin Outlets: The Right Pattern

Discourse provides plugin outlets - extension points where plugins can inject
custom HTML. There are two types:

**Regular outlets** inject content but Discourse still renders the default
elements. **Wrapper outlets** completely replace the template.

I used the `topic-list-item` wrapper outlet to completely replace how topics
display in the Public Feed category:

```javascript
import Component from "@glimmer/component";
import avatar from "discourse/helpers/avatar";
import replaceEmoji from "discourse/helpers/replace-emoji";
import formatDate from "discourse/helpers/format-date";

export default class GuestSpotItem extends Component {
  get isPublicFeed() {
    return this.args.outletArgs?.topic?.category?.slug === "public-feed";
  }

  get truncatedExcerpt() {
    const excerpt = this.args.outletArgs?.topic?.excerpt || "";
    if (excerpt.length <= 50) {
      return excerpt;
    }
    return excerpt.substring(0, 50) + "...";
  }

  <template>
    {{#if this.isPublicFeed}}
      <td class="topic-list-data guest-spot-card">
        <div class="guest-spot-author">
          <a href="/u/{{this.args.outletArgs.topic.creator.username}}">
            {{avatar this.args.outletArgs.topic.creator imageSize="medium"}}
            <span class="username">
              {{this.args.outletArgs.topic.creator.username}}
            </span>
          </a>
        </div>

        <div class="guest-spot-image">
          <a href={{this.args.outletArgs.topic.url}}>
            <img src={{this.args.outletArgs.topic.image_url}} alt="" />
          </a>
        </div>

        <div class="guest-spot-excerpt">
          {{replaceEmoji this.truncatedExcerpt}}
        </div>

        <div class="guest-spot-metadata">
          <div class="meta-item">
            Views: {{this.args.outletArgs.topic.views}}
          </div>
          <div class="meta-item">
            Replies: {{this.args.outletArgs.topic.posts_count}}
          </div>
          <div class="meta-item">
            Posted: {{formatDate this.args.outletArgs.topic.createdAt
            leaveAgo=true}}
          </div>
        </div>
      </td>
    {{else}}
      {{@default}}
    {{/if}}
  </template>
}
```

The component checks if we're in the public-feed category. If yes, render the
custom card layout. If no, render the default (`{{@default}}`).

### CSS Grid for Responsive Layout

Instead of JavaScript handling the layout, CSS Grid does all the work:

```scss
.category-public-feed {
  .topic-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;

    @media (max-width: 480px) {
      grid-template-columns: 1fr;
    }

    tr.topic-list-item {
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      overflow: hidden;
      background: var(--primary-very-low);
      transition: transform 0.2s;

      &:hover {
        transform: translateY(-2px);
      }
    }
  }
}
```

On mobile, it collapses to a single column. On tablet and desktop, it flows
naturally based on available space.

### Discovery Process

Finding the right plugin outlet took some research. I used `rg` to search
Discourse core for available outlets:

```bash
rg "PluginOutlet" app/assets/javascripts/discourse/app/components/ \
  | grep topic-list
```

Found several candidates:
- `topic-list-before-link` - Injects before the title link (still renders
  default content)
- `topic-list-after-title` - Injects after the title (still renders default
  content)
- `topic-list-item` - Wrapper outlet (replaces entire template)

The wrapper outlet was key. Regular outlets would have shown both my custom
card and the default topic row, creating duplicate content.

### What Works Now

The native approach gives us:
- Comments work out of the box (no custom implementation needed)
- All Discourse features work (moderation, flags, bookmarks, etc.)
- 814 fewer lines of code to maintain
- Better mobile support (Grid automatically adapts)
- No custom API (no serializers, controllers, or routes)
- Pin/unpin still works (using Discourse's native pinning)

The showcase is now just "a really nicely styled Discourse category" instead
of "a custom app built on top of Discourse."

## Vibe Coding: Pros and Cons

This project is a perfect example of "vibe coding" - building something by
feel, iterating quickly, and learning what works through trial and error.

I started with a custom model because that felt right. Then I realized Topics
already did everything I needed. I built a custom feed because I wanted full
control. Then I realized plugin outlets gave me that control without the
maintenance burden.

**The downside**: I went too fast and tried too much. Each iteration meant
throwing away code. The custom model, the custom feed infrastructure - all
that work ended up deleted. If I'd researched Discourse patterns first, I
could have gone straight to the plugin outlet approach.

**The upside**: I learned way more by doing it wrong first. I understand why
wrapper outlets exist, because I felt the pain of duplicate content with
regular outlets. I understand why Discourse's native features are powerful,
because I tried to rebuild them and saw how much work that is.

Fast iteration meant I could course-correct. I wasn't six months into building
a custom ORM before realizing Topics existed. I was a few days in, so
refactoring didn't hurt. The velocity of vibe coding let me try ideas, see
them fail, and pivot quickly.

The final result is simple and maintainable. It took three iterations to get
there, but each iteration taught me something. Now I know how to not do things,
which is just as valuable as knowing how to do them.

The code is on GitHub: [discourse-guest-spot](https://github.com/ducks/discourse-guest-spot)
