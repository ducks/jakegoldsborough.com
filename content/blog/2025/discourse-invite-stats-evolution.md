---
title: Invite Tree to Invite Stats - How A Simple Tree Flourished Into A Full Moderation Plugin
date: '2025-11-05'
description: How a simple visualization plugin evolved into a moderation tool.
taxonomies:
  tags:
    - discourse
    - ruby
    - oss
---

Recently, I wrote about building a Discourse plugin that visualizes invite
relationships as an ASCII tree. Clean, simple, Lobsters-inspired. I thought
I was done.

Then I kept thinking about it.

Back in 2017, someone on Meta asked about [tracking referrals and
invites](https://meta.discourse.org/t/tracking-referrals-encouraging-users-to-invite-others/75040).
People wanted to know who was inviting quality members and who was creating
moderation work. The Gamification plugin tracks invite counts, but that's
just quantity. What about quality?

If you're running an invite-only community, you care about accountability.
Who's inviting spam accounts? Who's inviting people who get immediately
suspended? Which inviters have consistently good judgment?

The tree visualization was neat, but it wasn't answering those questions.

## What Changed

I added moderation metrics to every user in the tree. Now you see:
- Suspended users (🚫)
- Silenced users (🔇)
- Users with agreed flags (⚠️3)
- Quality scores for people who invited others

Then I built an accountability report that sits above the tree. It shows
inviters who meet certain criteria:
- Invited 3 or more problematic users
- Have less than 70% invite success rate with 5+ invites

The tree is still there, but it's no longer the main feature. It's
supporting evidence for the accountability data.

## The Rename

At this point, the plugin wasn't really about the tree anymore. It was
about invite statistics and quality tracking. The tree was just one way to
display the data.

So I renamed it: `discourse-invite-tree` became `discourse-invite-stats`.

Renaming a plugin mid-development is annoying. You have to update:
- Repository name
- Plugin metadata
- All Ruby class names
- All JavaScript component names
- All CSS classes
- All translation keys
- All site setting names
- The symlink in your Discourse plugins directory
- The remote URL in git

But the name needs to match what the thing actually does. A plugin called
"invite tree" that's primarily focused on moderation accountability is
misleading.

## Making It Configurable

The hardcoded thresholds (3 bad invites, 70% quality score, 5 minimum
invites) worked for my mental model, but different communities have
different standards.

So I added site settings:
- `invite_stats_problematic_threshold`: How many bad invites trigger a flag
- `invite_stats_quality_threshold`: What percentage is acceptable
- `invite_stats_min_invites_for_quality`: Minimum invites before scoring applies
- `invite_stats_flags_threshold`: How many agreed flags mark someone as problematic

I converted the template to a proper Glimmer component class so I could
inject `siteSettings` and compute the threshold description dynamically. Now
when an admin changes the thresholds in settings, the UI updates to match.

![Admin settings panel showing configurable thresholds](/images/invite-stats-settings.png)

No more hardcoded magic numbers. If your community runs strict moderation
and wants to flag anyone with 2 bad invites, you can do that. If you're
more lenient and only care about people with 5+ bad invites, that works
too.

## Things to Remember

Scope creep isn't always bad. I started with "show me who invited whom" and
ended up with "help me identify problematic inviters." The tree
visualization is still there, but it's not the point anymore.

Sometimes you need to keep iterating. The first version was fine. The
second version is actually useful.

Check it out: [discourse-invite-stats on
GitHub](https://github.com/ducks/discourse-invite-stats)
