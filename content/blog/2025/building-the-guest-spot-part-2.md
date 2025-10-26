---
title: "Building The Guest Spot: Part 2 - Refactoring and Pin/Unpin"
date: 2025-10-26
description: "Refactoring from custom models to Discourse Topics, implementing pin/unpin functionality, and fixing four bugs along the way."

taxonomies:
  tags:
    - discourse
    - ruby
    - ember
---

In [Part 1](/blog/2025/building-the-guest-spot-part-1/), I built an Instagram-style showcase using a custom `GuestSpotPost` model. It worked. But it also meant maintaining a parallel data structure instead of leveraging what Discourse already provides.

This post covers two major changes: refactoring to use Discourse Topics instead of custom models, and implementing the pin/unpin feature that lets artists feature their best work.

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

## Pin/Unpin Feature

Artists need to feature their best work. The carousel at the top of the feed shows pinned posts. But we needed UI to pin and unpin.

### Backend: The Update Method

The update endpoint needed to handle pinning without breaking when other params are present:

```ruby
def update
  raise Discourse::InvalidAccess if !can_edit?(@topic)

  # Handle caption changes
  if params.key?(:caption)
    first_post = @topic.first_post
    revisor = PostRevisor.new(first_post, @topic)
    changes = { raw: params[:caption] }

    if !revisor.revise!(current_user, changes)
      render_json_error(@topic.errors.full_messages.join(", "))
      return
    end
  end

  # Handle pinning separately
  if params.key?(:pinned)
    should_pin = ActiveModel::Type::Boolean.new.cast(params[:pinned])

    if should_pin
      # Unpin any other posts by this user first
      category_id = CategoryHelper.public_feed_category_id
      Topic
        .where(category_id: category_id, user_id: current_user.id)
        .where.not(id: @topic.id)
        .where.not(pinned_at: nil)
        .each { |topic| topic.update_pinned(false, false) }

      @topic.update_pinned(true, false)
    else
      @topic.update_pinned(false, false)
    end
  end

  render_serialized(@topic, GuestSpotPostSerializer)
end
```

Two key details:

1. **Split logic**: Caption changes and pinning handled separately. Calling `revisor.revise!` with an empty changes hash causes 422 errors.

2. **Boolean conversion**: Rails treats the string `"false"` as truthy. Use `ActiveModel::Type::Boolean.new.cast()` to properly convert params.

3. **1-pin-per-artist**: When pinning a new post, unpin all other posts by that user. Keeps the featured carousel focused.

### Frontend: Reactive UI Updates

The pin/unpin button lives on the post detail page. Only visible to the post author:

```javascript
export default class GuestSpotPost extends Component {
  @service currentUser;
  @tracked isPinned;

  constructor() {
    super(...arguments);
    this.isPinned = this.args.model.guest_spot_post.pinned;
  }

  get canManagePin() {
    return (
      this.currentUser &&
      this.currentUser.id === this.args.model.guest_spot_post.user_id
    );
  }

  @action
  async togglePin() {
    const post = this.args.model.guest_spot_post;
    const newPinnedState = !this.isPinned;

    try {
      const result = await ajax(`/guest-spot/posts/${post.id}`, {
        type: "PUT",
        data: { pinned: newPinnedState },
      });

      // Update tracked property for reactive UI
      this.isPinned = result.guest_spot_post.pinned;
      post.pinned = result.guest_spot_post.pinned;
    } catch (error) {
      popupAjaxError(error);
    }
  }

  <template>
    {{#if this.canManagePin}}
      <DButton
        @action={{this.togglePin}}
        @label={{if this.isPinned "guest_spot.post.unpin" "guest_spot.post.pin"}}
        @icon={{if this.isPinned "unlink" "thumbtack"}}
        class="btn-default pin-toggle-btn"
      />
    {{/if}}
  </template>
}
```

The critical part: `@tracked isPinned`. Without it, changing `post.pinned` directly doesn't trigger Ember's reactivity. The button label and badge wouldn't update until you refreshed the page.

With `@tracked`, everything updates instantly:
- Button label toggles between "Pin to featured" and "Remove from featured"
- Icon switches between thumbtack and unlink
- "Featured" badge appears/disappears
- All without page refresh

### The 404 Bug

Everything worked when clicking through the feed. But refresh the page on `/guest-spot/post/40` and you'd get "No route matches [GET]".

The problem: Rails had no route for that path. Ember's client-side routing handled it when navigating within the app, but direct URL navigation hit Rails first.

The fix: Catch-all routes in `plugin.rb`:

```ruby
Discourse::Application.routes.append do
  scope module: :guest_spot do
    get '/guest-spot' => 'feed#index'
    get '/guest-spot/post/:id' => 'feed#index'  # Ember handles routing
    get '/guest-spot/user/:username' => 'feed#index'  # Ember handles routing
    resources :posts, only: [:index, :show, :create, :update, :destroy],
              path: '/guest-spot/posts'
  end
end
```

Rails serves the Ember app for these paths. Ember's router takes over from there. Now direct URL navigation and page refreshes both work.

## The Result

The showcase works. Artists can create posts using Discourse's native composer, pin their best work to the featured carousel, and navigate smoothly between the feed and individual posts. Everything updates instantly without page refreshes thanks to Ember's reactivity.

The refactor from custom models to Topics gave us commenting, moderation, uploads, and revisions for free. The pin/unpin feature with 1-pin-per-artist enforcement keeps the carousel focused on each artist's best work.

## Update: Simplifying Further

After implementing the custom feed (`/guest-spot`), I realized there was an uncomfortable disconnect. Users would browse an Instagram-style feed, click a post, and suddenly land in Discourse's standard topic view. The context switch was jarring.

The question became: why maintain a custom feed at all?

### The Simpler Approach

Discourse already has everything we need:
- **Category pages** show topic lists
- **Category permissions** control who can post and who can view
- **Native pinning** highlights featured content
- **Theme system** allows extensive visual customization

Instead of building `/guest-spot` with custom routes, controllers, and
templates, we could just make the Public Feed category look great:

1. Style the category's topic list as a visual grid (CSS + plugin outlets)
2. Use native pinned topics for the featured carousel
3. Let Discourse handle everything else (commenting, permissions, search)

### Category-Level Permissions

The key insight: Discourse supports per-category permissions. You can have a
site-wide `login_required = true` (entire forum private), but override it for
one category with `read_restricted = false`.

This means:
- **Public Feed category**: Anyone can browse (`everyone: See`)
- **Create permission**: Only approved users (`trust_level_1` or custom "artists" group)
- **All other categories**: Login required (site default)

No custom authentication code needed. No parallel permission system to
maintain. Just native Discourse category security.

### What This Changes

Instead of maintaining:
- Custom feed route and controller
- Custom serializers
- Custom Ember routes and templates
- Bridge logic between custom feed and native topics

We'd have:
- Native category page with custom styling
- Plugin outlets to enhance the topic list visually
- CSS to transform the layout into a grid
- That's it

The showcase becomes "a really nicely styled Discourse category" instead of "a
custom app built on top of Discourse."

This is the direction I'm taking the plugin. Part 3 will cover ripping out the
custom feed and rebuilding with native Discourse features.

The code is on GitHub: [discourse-guest-spot](https://github.com/ducks/discourse-guest-spot)
