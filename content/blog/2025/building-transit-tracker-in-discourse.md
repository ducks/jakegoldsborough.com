---
title: "Building a Live Transit Departure Board with Discourse"
date: 2025-10-08
tags: ["discourse", "ruby", "oss"]
description: "Experimenting with Discourse as a live transit departure board - blending GTFS data, aviation APIs, and forum topics into one real-time display."
---

I've been working at Discourse for a few months now, learning how flexible
the platform is. It's a forum. It's designed for conversations. But what if
we used it for something completely different?

Something like tracking flights and trains?

I wanted to learn more about Discourse by building something that felt real and
that would force me into actual problems. Most importantly though, I wanted to
build something that involves my interests and would be fun. I love transit
infrastructure and open data so why not a transit tracker using free government
feeds? I had this image in my head: those old split-flap airport departure
boards, the ones that click and whir as letters rotate into place.

![Split-flap departure board](/images/transit-tracker-source.jpg)
*Photo by [Amsterdam City Archives](https://unsplash.com/@amsterdamcityarchives) on
[Unsplash](https://unsplash.com/photos/7diobitpahY)*

What if I could recreate that aesthetic, but powered by Discourse topics
instead of actual flights?

You can see the result here: [discourse-transit-tracker on
GitHub](https://github.com/ducks/discourse-transit-tracker)

**Live demo:** [discourse.gnarlyvoid.com/board](https://discourse.gnarlyvoid.com/board)

*(Note: Running on a small demo droplet, so it might be a bit slow. The
plugin runs great on properly-sized servers!)*

## Why This Makes No Sense (And Why I Did It Anyway)

Let's be clear: **Discourse is not a transit tracking system**. It's a
forum platform built for human conversations, not GTFS feeds and real-time
departure data.

But that's exactly what made it interesting.

Discourse topics are incredibly flexible. They have custom fields, tags,
categories, and a robust permission system. If you squint hard enough, a
flight departure is just a "post" with structured data. The departure time?
A custom field. The status (on-time, delayed, departed)? A tag. The
airline? Maybe a category.

It's ridiculous. But it *could work*.

## Learning with Claude Code

I built this entire plugin using Claude Code, Anthropic's CLI tool. Not
because I couldn't write it myself, but because I wanted to learn Discourse
patterns while writing quality code from the start.

"Vibe programming" gets a bad rap. People hear "AI-assisted development"
and think it's about blindly accepting generated code. But that's not how I
used it. Claude Code became a learning tool. I'd describe what I wanted to
build, Claude would suggest an approach using Discourse conventions, and
I'd understand why those patterns exist.

This allowed me to learn the platform faster than reading docs alone would
have taught me. I saw real implementations of custom fields, service
objects, Ember components, and ActiveRecord patterns. And because Claude
follows Discourse's style guide and architecture, the code I wrote actually
fits the codebase.

This is what good AI-assisted development looks like: not replacing
understanding, but accelerating it.

## The Technical Stack

The plugin integrates three data sources, each with its own challenges.

### Amtrak (GTFS)

I built an `AmtrakGtfsService` that downloads Amtrak's GTFS feed (a ZIP
file with CSVs), parses routes, stops, trips, and schedules, and creates
departure topics with detailed stop information. No API key required.

The service:
1. Downloads and extracts `GTFS.zip` from Amtrak's CDN
2. Parses `routes.txt`, `stops.txt`, `trips.txt`, and `stop_times.txt`
3. For each trip in the next 24 hours, creates a topic with:
   - All basic departure info as custom fields
   - A detailed stops array with lat/lon coordinates and times
   - A formatted schedule table as Post #2

Running `bin/rake transit_tracker:import_amtrak` processes ~2,300 trips and
creates ~600 departure topics (many trips share the same departure, so they
get merged).

**The Problem: "Title has already been used"**

The first import run worked fine, processing ~2,300 trips and creating ~600
topics. But when I ran it again to test updates, I hit a wall:

```
Processing 340 trips...
Created 1 topic
Error: Title has already been used (339 times)
```

Only 1 out of 340 trips succeeded on the second run. The rest failed.

Discourse requires unique topic titles. My title format was: `"City of New
Orleans to New Orleans at 19:05"`. Multiple different trains with the same
route, destination, and departure minute produced identical titles.

My lookup strategy was to find topics by `trip_id` + `service_date` stored
in custom fields. That worked fine when topics existed. But on subsequent
runs, when a topic wasn't found by custom field (maybe the `trip_id`
changed), I'd try to create one, and Discourse would reject it because
another train had already claimed that title.

**The Fix: Fallback Lookup by Title**

The solution was to add a fallback lookup by title before trying to create:

```ruby
# First, try to find by trip_id + service_date (the ideal natural key)
topic = Topic.joins(:_custom_fields)
  .where(topic_custom_fields: {
    name: "transit_trip_id",
    value: attributes[:trip_id]
  })
  .where(...)
  .first

# If still no match, try to find by title to avoid duplicates
if !topic
  title = build_title(attributes)
  category_id = determine_category(attributes[:mode])
  topic = Topic.where(title: title, category_id: category_id).first
  if topic
    Rails.logger.info "[TransitTracker] Found existing topic by title,
      will update"
    is_new = false
  end
end
```

This way, if multiple trips share a title, they merge into the same topic
and get updated instead of failing.

Result: **327 departures created, 0 errors**. All trips within the 24-hour
window imported successfully. The duplicate trips just update the same
topic with fresh data.

### NYC MTA Subway (GTFS)

The NYC MTA subway system is massive. Their GTFS feed contains over 500,000
stop times covering weeks of schedules across dozens of routes.

My first approach was simple: import everything, just like I did with
Amtrak. Parse the entire feed, create topics for every departure in the
next 24 hours.

**The Problem: 19GB of RAM**

I ran the import and watched my Rails process climb. 1GB. 5GB. 10GB. It
kept going. By the time it finished parsing, **it had consumed over 19GB of
RAM**.

Loading and processing 500k+ stop times to create 20,000+ Discourse topics
consumed massive amounts of memory. At scale, big data creates big
problems.

**The Fix: Reduce the Time Window**

The fix? Reduce the import window from 24 hours to 6 hours:

```ruby
# Only import departures within the next 6 hours
dep_time = parse_gtfs_time(today, first_stop[:departure_time])
next if dep_time < now || dep_time > (now + 6.hours)
```

Result: ~5,000 topics instead of 20,000+, memory usage stayed under 2GB,
and the board still shows plenty of departures. For a live departure board,
you don't need train schedules from tomorrow anyway.

The final implementation includes official MTA line colors (red 1/2/3,
green 4/5/6, yellow N/Q/R/W, etc.) and creates ~5,000 departure topics with
complete schedules.

### AviationStack API

Tracks flight departures with gate assignments, delays, and code-share
detection. Requires an API key from [aviationstack.com](https://aviationstack.com/).

**The Problem: Duplicate Code-Share Flights**

Multiple airlines sell seats on the same physical flight under different
flight numbers. That's called code-sharing. So you might have `AA123`,
`BA456`, and `IB789` all referring to the exact same plane leaving from
Gate E7 at 07:30.

At first, I tried to build my own detection using departure time + gate +
destination as a natural key. But then I looked closer at the AviationStack
API response and found it: a `codeshared` field that tells you exactly
which flight is the operating carrier.

**The Fix: Use the API's Built-In Field**

```ruby
# Handle code-share flights: use operating carrier as natural key
codeshared = flight_info["codeshared"]
if codeshared.present?
  # This is a marketing carrier selling seats on another airline's flight
  # Use the operating flight as trip_id so all code-shares merge
  operating_flight = codeshared["flight_iata"] || codeshared["flight_icao"]
  trip_id = "#{operating_flight}-#{departure_info['scheduled']}"

  Rails.logger.info "[TransitTracker] Code-share detected:
    #{marketing_flight} operated by #{operating_flight}"
else
  # Regular flight, use its own flight number
  trip_id = "#{flight_info['iata']}-#{departure_info['scheduled']}"
end
```

Why reinvent the wheel? The API already does the hard work of identifying
code-shares. I just use the operating carrier's flight number as the
`trip_id`, and all marketing carriers automatically merge into the same
topic.

Result: `AA 1234 / BA 5678 / IB 789` displayed as one departure.

## The Architecture

### Topics as Transit Legs

Each flight (or train, or bus) is a Discourse topic. I created a
`TransitLeg` model that wraps Topic and handles all the custom fields:

- `transit_dep_sched_at` (scheduled departure time)
- `transit_dep_est_at` (estimated departure time for delays)
- `transit_route_short_name` (flight numbers)
- `transit_headsign` (destination)
- `transit_gate` / `transit_platform` (where to board)
- `transit_dest` (airport code)
- `transit_stops` (JSON array of all stops with coordinates and times)

Tags handle the mode (`flight`, `train`, `bus`) and status
(`status:scheduled`, `status:delayed`, `status:departed`).

### Posts as Schedule Details

Here's where using Discourse as the foundation really paid off.

When you click on a departure row, it expands to show the complete route
schedule with all stops and arrival/departure times. But I didn't build a
custom data structure for this. **I used Discourse posts**.

Each departure topic has:
1. **Post #1** (the OP): Basic departure info (route, times, gate)
2. **Post #2**: A markdown table with the complete schedule
3. **Post #3+**: Any delay notifications or status updates

When you expand a row, you're literally seeing the topic's replies rendered
inline. It slides down with a smooth animation, showing the full schedule
table styled to match the departure board aesthetic.

The schedule post looks like this:

```markdown
## 🚂 Complete Schedule

**Route:** City of New Orleans
**Direction:** Chicago

| Stop                                  | Arrival | Departure |
|---------------------------------------|---------|-----------|
| New Orleans Union Passenger Terminal  | 12:45   | 12:45     |
| Hammond Amtrak Station                | 13:42   | 13:45     |
| McComb                                | 14:30   | 14:32     |
| ...                                   | ...     | ...       |
| Chicago Union Station                 | 08:15   | 08:15     |

_Schedule times are in local timezone. This is the planned schedule and may
be subject to delays._
```

It renders beautifully in the expanded row with the board's dark styling.

### Why This Works Really Well

Using posts instead of a custom schema means:
- **Update history is built-in**. If a train gets delayed, we post an
  update and users see the entire timeline.
- **Moderation tools work**. If there's bad data, moderators can edit posts
  using Discourse's existing tools.
- **Comments could work**. Users could reply to departures (we don't allow
  this now, but the infrastructure is there).
- **No additional database tables**. Posts are just posts, Discourse
  handles all the storage.

## Screenshots

**Flights - Collapsed View**

![Flight departures board showing routes, gates, destinations, and
countdowns](/images/transit-tracker-planes.png)

**Flights - Expanded View**

![Expanded flight showing airline details, gates, terminals, and code-share
information](/images/transit-tracker-planes-expanded.png)

**NYC Subway - Collapsed View**

![MTA subway board with authentic line
colors](/images/transit-tracker-mta.png)

**NYC Subway - Expanded View**

![Expanded subway departure showing complete stop-by-stop
schedule](/images/transit-tracker-mta-expanded.png)

**Amtrak Trains - Collapsed View**

![Amtrak departure board](/images/transit-tracker-trains.png)

**Amtrak Trains - Expanded View**

![Expanded train departure showing full station
schedule](/images/transit-tracker-trains-expanded.png)

## Bonus Tooling: Consistent Screenshots

Getting these screenshots pixel-perfect required some tooling. I wanted to
be able to:
1. Select a region once
2. Click things in the browser to expand/collapse
3. Take multiple screenshots of the exact same region

I built a Nix shell with Wayland screenshot tools (`grim` + `slurp`):

```bash
nix-shell ~/discourse/nix-shells/screenshot.nix

screenshot-region flight-1.png     # Select region once
# Click to expand in browser
screenshot-repeat flight-2.png     # Same exact region
```

The `slurp` tool saves the region geometry, and `screenshot-repeat` reuses
it for perfect alignment across multiple screenshots.

## Takeaways

**I learn best by writing real tools.** Tutorial projects teach syntax, but
they don't force you into the messy, real-world problems that make you
actually understand a framework.

### Discourse Topics Are More Flexible Than You Think

Custom fields, tags, and categories gave me all the structured data I needed.
Topics aren't just "posts". They're flexible containers for any kind of
information.

### Posts Are the Perfect Update Mechanism

Instead of building a custom "updates" system with timestamps and status
changes, I just used Discourse posts. When a delay happens, post an update.
The topic becomes a living history of what happened to that departure.

### Entity Resolution: Check Your Data Before Building Logic

My first implementation created duplicate topics for every code-share
flight. I started building my own deduplication logic using a natural key
(departure time + gate + destination). But then I actually read the API
response and found it: a `codeshared` field that identifies which flights
are the same. I was about to solve a problem the API had already solved for
me.

### GTFS Parsing Has Edge Cases

GTFS times can exceed 24 hours (e.g., "25:30:00" means 1:30 AM the next
day). ZIP files can have encoding issues. Stop sequences aren't always
sequential. Real-world data is messy.

### Performance Matters at Scale

The MTA feed has 500k+ stop times. A 6-hour import window instead of 24
hours keeps memory usage reasonable and topic counts manageable (~5,000
instead of 20,000+).

## Is This Practical?

Probably not for real transit tracking. But it's a great example of pushing
Discourse in unexpected directions to understand the platform deeply.

The same pattern (topics as structured data + posts as updates) could work
for:

- Package tracking (topics = packages, posts = scan events)
- Server status boards (topics = servers, posts = incidents)
- Deployment pipelines (topics = deploys, posts = stage completions)
- Event schedules (topics = sessions, posts = time/room changes)
- Support ticket boards (topics = tickets, expandable = full history)

The split-flap aesthetic is a bonus.

## Try It Yourself

The plugin is open source:
[ducks/discourse-transit-tracker](https://github.com/ducks/discourse-transit-tracker)

Clone it, run the Amtrak import (no API key required), and see what
Discourse topics can become when you push them beyond forum discussions.
