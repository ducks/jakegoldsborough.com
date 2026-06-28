---
title: "discourse-manager: A Community Management Sim Inside Discourse"
date: 2026-06-28
description: "I built a forum management sim that runs as a Discourse plugin. You moderate a fake community that looks real. The whole joke is that it runs inside the actual Discourse UI."
taxonomies:
  tags:
    - discourse
    - games
    - plugins
    - oss
---

There's a browser game called [You are the
OS](https://github.com/plbrault/youre-the-os) where you play as a computer's
operating system. Processes request memory, users get impatient, the machine
dies if you can't keep up. It's a sim about a thing most people interact with
every day but never think about.

I wanted to make that, but for community moderation.

The result is [discourse-manager](https://github.com/ducks/discourse-manager),
a Discourse plugin that turns your forum into the game. You play as the
moderator. Fake users, fake posts, and fake drama are generated inside your
actual Discourse instance and rendered with real Discourse components. The flag
queue looks like the real flag queue. The user cards look like real user cards.
The avatars, the trust level badges, the category labels - all real.

The whole joke is that it runs inside Discourse itself.

![discourse-manager
screenshot](https://raw.githubusercontent.com/ducks/discourse-manager/main/docs/screenshot.png)

## The game

You manage four meters: community health, mod response time, spam rate, and
user retention. Let any of them hit zero and the community collapses.

Flags come in continuously. Each one is a decision:

- **Approve** - the post stands, move on
- **Remove** - gone
- **Warn** - the user gets a PM, post stays
- **Suspend** - off the forum for a while
- **Ban** - gone for good, but take retention damage if you're wrong

Speed matters. A flag that sits unresolved too long costs health. Clearing them
fast restores response time. The tension is between acting fast and acting
correctly.

On top of the queue, random events fire. Each has two or three resolution
options with different tradeoffs across the meters.

Community events: a spicy topic goes viral and generates 30 flags in 60
seconds, a wave of sockpuppets registers, two trusted users start fighting in a
thread, a great newcomer shows up worth recognizing.

Technical incidents too: a plugin update ships and breaks something, the server
goes down and users are posting about it on Twitter, a database migration fails
in production, a CDN failure makes images disappear sitewide, a cleanup script
runs with the wrong scope and takes out several categories. Each incident hits
different meters - an outage tanks response time and health, a CDN failure
hammers retention. The resolutions have real tradeoffs: push a hotfix live and
risk making it worse, or roll back and eat the downtime.

Each day has a timer. When it ends you get a summary - flags resolved, bans
issued, incidents handled - before starting the next one. Survive 30 days to
win.

## The fake community

The forum is populated at game start with 40 generated users across five
behavioral profiles: lurkers, contributors, trolls, spammers, and newbies. Each
profile generates realistic-looking posts and a realistic probability of
getting flagged.

The posts are the best part. A troll posts "anyone who disagrees with me is
just wrong, full stop." A spammer posts "I make $4000/week working from home.
DM me for details." A newbie asks "HOW DO I CHANGE MY USERNAME?? I've been
trying for 20 minutes!!" A contributor posts something thoughtful about why the
community has been so toxic lately.

None of it is real. All of it feels real. That's the thing Discourse's design
language does so well - the UI is so recognizable that fake content in it reads
as plausible immediately.

Occasionally a legitimate post gets flagged incorrectly. You have to read the
content and make a judgment call, not just pattern-match on the flag type.

## Why inside Discourse

I could have built this as a standalone web app. It would have been faster and
simpler.

But the whole premise of the game is that you're moderating a forum that looks
real. If I build a custom UI, it looks like a game. If I build it as a
Discourse plugin, it looks like Discourse. The cognitive effect only works when
you can't tell at a glance whether you're looking at a real post or a fake one.

The plugin renders with actual Discourse components: the same avatars, the same
button styles, the same layout. The HUD - four meters with green/yellow/red
color coding - sits above the review queue the way a real dashboard might.
Events pop in as styled cards. It all fits the host environment.

Building inside Discourse also gave me MessageBus for free. Real-time state
updates from the server to the client - flags disappearing as you clear them,
meters ticking down - all through the same pub/sub system Discourse uses for
live notifications. No WebSocket setup. No extra infrastructure.

## What's next

The one thing I still want to add: LLM-generated content. Right now the post
pool is handwritten strings - good enough to feel real, but every playthrough
is the same drama. Running an LLM at game init to generate a full set of forum
posts tuned to the behavioral profiles would make each run different. The
structure is already there; it just needs something to fill it with varied text.

The most interesting idea that came up while building it: this could double as
a spam detection training tool. Every flagged post has a profile type and a
human moderation decision attached. Play enough sessions and you have a labeled
dataset of spam, trolling, and legitimate posts. The game generates it as a
side effect.

## The code

It's a Discourse plugin, so the setup is what you'd expect:

```bash
cd /var/www/discourse/plugins
git clone https://github.com/ducks/discourse-manager
bundle exec rake db:migrate
```

Then go to `/play`.

Source at
[github.com/ducks/discourse-manager](https://github.com/ducks/discourse-manager).
