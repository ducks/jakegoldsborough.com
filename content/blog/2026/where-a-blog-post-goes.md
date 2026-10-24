---
title: "Where a Blog Post Goes"
date: 2026-10-24
description: "A post reached TLDR, Hacker News, curated reading lists, search engines, and work chats. The interesting part of the analytics was the variety of ways people found it."
taxonomies:
  tags:
    - blog
    - writing
    - dev
---

On September 26, I published [Goodbye to the Hard Parts That Never
Mattered](/blog/2026/goodbye-to-the-hard-parts-that-never-mattered/). It was a
response to another post about what AI is changing in software engineering.

By October 24, GoatCounter had recorded 4,818 visits to it. On September 28
alone, it recorded 3,229.

Those are big numbers for this blog. But the part that surprised me most was
the list of places people came from.

TLDR. Hacker News. Labnotes. Brutalist Report. LinkedIn. Google. Kagi. Slack.
Microsoft Teams.

A newsletter, a discussion site, curated reading lists, search engines, and
work chats. All leading to the same Markdown file on my VPS.

## The large sources and the small ones

I queried the SQLite database behind my self-hosted GoatCounter instance. These
are some of the referral counts from publication through October 24:

| Source | Visits |
| --- | ---: |
| TLDR Newsletter | 2,277 |
| Hacker News | 978 |
| Labnotes | 67 |
| Brutalist Report | 52 |
| LinkedIn | 43 |
| Google | 31 |
| Microsoft Teams related referrer | 18 |
| Kagi | 15 |
| Slack | 12 |

Another 1,155 visits had no recorded referrer. That bucket could include
bookmarks, email, private messages, and browsers that strip the information.
It does not tell me which.

TLDR and Hacker News account for about two-thirds of the article's counted
visits. They explain most of the volume.

But twelve visits from Slack are interesting in a different way.

A referrer cannot tell me what someone said when they shared the link. Maybe
it supported an argument. Maybe someone thought it was bullshit. Maybe it
landed in a channel full of links that nobody had time to read.

I have no idea. I can see the click that reached my site. Everything around it
is missing.

The same is true of the Teams-related traffic. It suggests a route through a
workplace tool, without giving me a window into the workplace. I find that
little trace more interesting than its contribution to the total.

I also found Nathan Pettit responding to the article on LinkedIn. He agreed
with parts of it and pushed back on others. Someone else had saved it to
Scholion with annotations. Those tell me something a referral count cannot:
someone took the time to formulate a counterargument, and someone else took
notes. In the traffic data, either interaction could look like another click,
if it appeared at all.

Then there are the tracked email clicks. For several days, I have been
watching links with HubSpot tracking parameters arrive without being able to
identify the sender. I can recognize the distribution technology. I still do
not know which email carried the link or what it said.

## A different kind of discovery

In May, I wrote about [six numbers from this blog's
analytics](/blog/2026/blog-stats-six-numbers/). The biggest single-day spike I
found then was 33 visits to a post about Nix shells, SSH, and Claude Code.

The pattern at the time was specific technical problems getting found through
search. Someone hits an error, searches for it, and finds the thing I wrote
when I hit the same error. A small post keeps being useful months later.

I still like that pattern. A lot of this blog exists because I would rather
write down the fix once than figure it out again six months from now.

This post had a different shape. It was an essay about the work itself, and
people reached it through newsletters, reading lists, and links shared with
other people. Google accounted for just 31 visits in the referral data.

That is an interesting addition to what I saw in May. The technical posts
were being discovered through a problem someone already had. This one could
turn up among the things someone else thought were worth reading.

The countries were varied too. The United States supplied the largest share,
followed by the United Kingdom, Germany, Canada, and Australia. Those are the
top five, not the whole list.

There are several kinds of distance in that data. Geographic distance is the
one with country names. The distance between my blog and a work chat I will
never see is harder to measure.

## What the numbers leave out

These are recorded visits, not 4,818 distinct people. They do not tell me how
many people finished the post or agreed with it. October 24 was also still in
progress when I ran the queries.

The site recorded 45 helpful-click events associated with the article. That
is another small piece of feedback, with plenty left unexplained.

I could spend a lot of time trying to turn all of this into a strategy. Find
the right subject. Get into the right newsletter. Reproduce the spike.

What interests me more is how many routes showed up at all.

I wrote a response to something I read. It became something other people
could read, search for, collect, or pass along. Some of those routes left a
name in a database. Plenty probably did not.

A dozen Slack visits will not dominate a traffic chart. They were still
someone following a link to something I wrote.

That is a pretty good reason to keep publishing.
