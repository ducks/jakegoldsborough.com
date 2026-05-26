---
title: "Building a Travel Itinerary Plugin Inside Discourse"
date: 2026-05-25
description: "Turning a Discourse forum into a chronological travel itinerary: trip topics as containers, flight/hotel topics as items, and a bunch of plugin-API trapdoors along the way."

taxonomies:
  tags:
    - discourse
    - ruby
    - ember
    - oss
---

I built a Discourse plugin that turns a category of topics into a chronological
travel itinerary. One topic per trip, then a flight topic, a hotel topic, a
note topic, all linked back to the trip. The plugin renders them on /itinerary
as a clean list and per-trip timeline grouped by day.

You can see the result here:
[discourse-itinerary on GitHub](https://github.com/ducks/discourse-itinerary)

## Why Discourse for This?

Same reason I keep doing this: Discourse topics are extremely flexible, and
seeing how far I can push them keeps teaching me the platform. A trip is just
a topic. A flight is just a topic. The relationship between them is a custom
field pointing at the parent trip. Everything else (permissions, search,
edit history, who posted what, comments) comes for free.

That was the bet anyway. Reality had some opinions.

## The Data Model

After a couple of rewrites, the model settled at:

- **Category** = "Itinerary". One per forum. Auto-created by the plugin on
  first boot, with a configurable site setting if the admin wants to point
  it at a different category.
- **Topic with `itinerary_item_type = trip`** = a trip (the container).
- **Other itinerary topics** = items (flight, train, hotel, event,
  transfer, note) that point at their parent trip via
  `itinerary_parent_trip_id` on the topic's custom_fields.

Earlier versions used a tag (`itinerary`) to mark which topics belonged to
the plugin. That got dropped once `itinerary_item_type` existed. The tag was
load-bearing nostalgia, not real structure.

All metadata lives in `topic_custom_fields`:

| Field                          | Type     | Example                |
| ------------------------------ | -------- | ---------------------- |
| `itinerary_item_type`          | string   | `flight`               |
| `itinerary_parent_trip_id`     | integer  | `123`                  |
| `itinerary_starts_at`          | string   | `2026-09-20T14:30`     |
| `itinerary_ends_at`            | string   | `2026-09-21T09:15`     |
| `itinerary_origin`             | string   | `PDX`                  |
| `itinerary_destination`        | string   | `MAD`                  |
| `itinerary_location`           | string   | `Madrid`               |
| `itinerary_confirmation_code`  | string   | `ABC123`               |
| `itinerary_status`             | string   | `booked`               |

Timestamps are stored as ISO-8601 strings, not DateTime. Lexical sorting
on the raw column does the right thing for `YYYY-MM-DDTHH:MM`, which means
I never have to parse them on the database side.

## The Plugin API Trapdoors

Discourse plugins have a deceptively friendly API. You write a `plugin.rb`,
drop some assets under `assets/javascripts/discourse/`, and things mostly
work. Until they don't, and you have to figure out why.

Here are the ones that actually stopped me cold.

### The route-map filename convention

To register Ember client routes from a plugin, you put a file named
`<plugin-slug>-route-map.js` in `assets/javascripts/discourse/`. Discourse
scans `requirejs.entries` for anything matching `/route-map$/` and invokes
its default export to build out the route tree.

I named the file correctly. The file loaded. The composer connector loaded.
The route map itself never ran.

Turns out Ember resolves the actual route modules by name. With this
route map:

```js
export default function () {
  this.route("itinerary", function () {
    this.route("show", { path: "/:trip_id" });
  });
}
```

Ember will look for `routes/itinerary/index.js` and `routes/itinerary/show.js`.
Not `routes/itinerary-index.js` or `routes/itinerary-show.js`, which is what
I had originally. The dot in the route name becomes a path separator. I had
copied the route map from discourse-cakeday but missed the nested directory
convention for the route files.

You don't get an error for this. The route map just silently doesn't match
anything client-side and the URL falls through to Rails.

### Rails has to serve the HTML for an Ember route

This was the big one. After fixing the route file paths, `/itinerary` still
404'd. The error came from Rails, not Ember. The plugin had JSON routes:

```ruby
Discourse::Application.routes.append do
  get "/itinerary/trips" => "itinerary#index",
      defaults: { format: :json },
      constraints: { format: :json }
  get "/itinerary/trips/:id" => "itinerary#show",
      defaults: { format: :json },
      constraints: { format: :json, id: /\d+/ }
end
```

But none of those match a browser request for `GET /itinerary` (which wants
HTML). Rails 404s, the browser never gets the Discourse app shell, Ember
never loads, the route map never runs.

discourse-cakeday works because it mounts a full Rails Engine at `/cakeday`,
which catches the HTML request and serves the SPA bootstrap. Discourse
plugins like discourse-invite-stats use the simpler pattern:

```ruby
get "/itinerary" => "itinerary#page", constraints: { format: :html }
get "/itinerary/*path" => "itinerary#page", constraints: { format: :html }
```

With an action that just renders the empty layout:

```ruby
def page
  render "default/empty"
end
```

The empty layout is the SPA bootstrap. Ember takes over from there.

I burned a couple of hours on this before searching for it. Sometimes the
fastest way to debug a plugin is to read three other plugins that do the
same thing.

### Composer fields and Glimmer autotracking

The composer panel for itinerary fields shows different inputs depending on
the item type. Flight has origin and destination, hotel has location, note
has neither. The conditional rendering was driven by getters:

```js
get itemType() {
  return this.composer.itinerary_item_type;
}

get showsRoute() {
  return ["flight", "train", "transfer"].includes(this.itemType);
}
```

This silently broke. The user could pick "Flight" from the dropdown, but
the route inputs never appeared. The dropdown's change handler was firing.
The composer model was being updated. But the template never re-rendered.

The reason: `this.composer.set("itinerary_item_type", value)` doesn't go
through a `@tracked` property. Glimmer's autotracking can't follow
`composer.set(...)` on non-tracked composer fields. The getter reads from
the composer correctly the first time, then becomes a dead read.

Fix:

```js
@tracked itemType;

@action
setItemType(e) {
  this.itemType = e.target.value || null;
  this.composer.set("itinerary_item_type", this.itemType);
}
```

Keep a local `@tracked` copy of anything you read from the composer model
in conditional getters. The composer side stays in sync via the
`.set()` call.

### datetime-local silently drops half-filled values

I had separate inputs for "Starts at" and "Ends at" with `type="datetime-local"`.
The user creates a flight, types a date, doesn't bother with the time,
clicks save. The flight saves. The trip page shows "No items in this trip
yet."

The flight was actually saved, just without `itinerary_starts_at`. The
TripItemFinder filters out items without a start time, so the flight
existed in the DB but never reached the timeline.

Why? `<input type="datetime-local">` doesn't fire `input` or `change` until
both the date and time portions are populated. A half-filled value is
"invalid" to the browser, and you get nothing.

I split the field into a `<input type="date">` plus an optional
`<input type="time">`. The composer combines them into the stored format
(`YYYY-MM-DD` if just date, `YYYY-MM-DDTHH:MM` if both). The timeline
component already knew how to render both formats.

Two inputs, one stored field, no silent data loss.

### Topics need a title that Discourse will accept

Once the composer worked, I hit the wall I'd been ignoring: Discourse's
title length validator requires 15 characters minimum, plus a "title seems
unclear" heuristic that rejects titles like "Flight" or "Lisbon". For a
travel itinerary where the "data" is in custom fields, making the user
invent a meaningful 15-char title for every flight is hostile.

Discourse doesn't have per-category overrides for `min_topic_title_length`.
The validator reads the global site setting, full stop. I considered three
options:

1. Lower the global. Affects every topic on the forum.
2. Monkey-patch the validator to skip checks for itinerary topics. Fragile.
3. Synthesize the title from the structured fields the user is already
   filling in.

Option 3 is the move. The composer already collects item type, origin,
destination, location. Build the title from those and the user never has
to type one.

```js
synthesizeTitle() {
  const type = this.itemType;
  if (!type || type === "trip") return;

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const o = this.composer.itinerary_origin;
  const d = this.composer.itinerary_destination;
  const loc = this.composer.itinerary_location;

  let title = cap(type);
  if (["flight", "train", "transfer"].includes(type) && (o || d)) {
    title = `${cap(type)}: ${o || "?"} -> ${d || "?"}`;
  } else if (loc) {
    title = `${cap(type)}: ${loc}`;
  }
  this.composer.set("title", title);
}
```

Trip topics still take the user's title (you name a trip meaningfully;
"European trip 2026" is more useful than "Trip"). Items get derived titles:
"Flight: PDX -> MAD", "Hotel: Madrid Marriott", "Event: Symphony".

I also hide the title input via a body class when the composer is in
itinerary-item mode, so users don't see a phantom input that gets
overwritten on every field change.

## The Other Stuff

A few smaller things that made the plugin feel like a real tool.

### Auto-creating the category

The plugin provisions an "Itinerary" category on first boot. The slug-first
lookup means if an admin already has a category called "itinerary" or
"ITINERARY", we adopt it instead of creating a duplicate (which would fail
uniqueness anyway). The provisioner also adds the category id to
`default_categories_muted` so new users don't see itinerary topics
cluttering /latest.

### Sidebar link

Discourse's `api.addCommunitySectionLink` adds a link to the sidebar's
Community section. With the category muted by default, the sidebar link
becomes the canonical entrypoint. No URL guessing required.

### Add buttons

Two big buttons: "+ Add trip" on /itinerary, "+ Add leg" on
/itinerary/:trip_id. Each opens the standard composer pre-scoped to the
itinerary category, with the right `itinerary_item_type` (for trip) or
`itinerary_parent_trip_id` (for leg) seeded on the composer model after the
modal opens. The composer panel's conditional rendering picks up the
seeded values and shows the right fields.

This pattern is straight from discourse-kanban: rather than build a custom
modal, lean on Discourse's existing composer with sensible defaults. You
get rich text, drafts, file uploads, all the auth machinery, for free.

## Screenshots

Coming once I've populated my own itinerary further. I want the screenshots
to show realistic data rather than the "Flight to madrid for meetup" test
post that's currently in my dev instance.

## Takeaways

**Plugins built on topics keep paying off.** Search, permissions, edit
history, mentions, attachments. None of it is plugin code. It's all
Discourse, and I get it by default by storing data in topics.

**The plugin API has trapdoors.** Most of them aren't documented because
nobody hits them until they hit them. Reading three working plugins
side-by-side is faster than reading docs.

**Glimmer autotracking is invisible until it isn't.** If a getter reads a
non-`@tracked` value and you're surprised it doesn't re-render, that's the
likely cause. Always.

**Synthesize what you can.** The user shouldn't have to type a topic title
when the structured fields already encode it. Hide the title input, derive
it, move on.

**Per-category validation overrides would be great.** Discourse already
has site-wide setting overrides per category for things like default tags
and minimum trust levels. Extending the per-category override surface to
title and post length validators would let plugins like this stop fighting
the global validators. Filed in the back of my brain for a future
contribution.

## Try It

The plugin is open source:
[ducks/discourse-itinerary](https://github.com/ducks/discourse-itinerary).
Symlink it into your `plugins/` directory, restart Rails, visit
/itinerary, and you've got a travel timeline backed entirely by Discourse
topics.

Now I just need to actually go on a trip.
