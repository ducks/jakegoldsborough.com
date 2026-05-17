---

title: "Six numbers from my blog's analytics"
date: 2026-05-17
description: "I dug into the GoatCounter database for my blog. Single-day spikes, fastest risers, fastest first month, two kinds of streaks, and where readers actually come from."
taxonomies:
  tags:
    - blog
    - writing
    - dev

---

I recently noticed that the 1 year anniversary of my blog came and went. I was curious about how much traffic I got so I took a look.

I sshed into my VPS and pointed sqlite at the GoatCounter database that powers my analytics. Six numbers stood out.

For context: this blog gets modest traffic. Usually 20-50 unique visitors a day, mostly from search. I'm not actively trying to grow it, I just write. But the data is interesting because it shows what people actually read versus what I assumed they would.

## 1. Biggest single-day spike: 33 hits

On 2026-05-11, the post [Nix shells, SSH, and Claude Code](/blog/2026/nix-shells-ssh-claude-code/) got 33 visits in one day. That's the single biggest day for any post I've published.

For comparison, the next biggest days were 25 (a January post called [Letting AI pick the project](/blog/2026/letting-ai-pick-the-project/)), 19 ([How a friend's gif broke our filesystem](/blog/2026/how-a-friends-gif-broke-our-filesystem/)), and 13 ([Rewriting Claude Code in Rust](/blog/2026/rewriting-claude-code-in-rust-with-claude/)).

The pattern is obvious in hindsight: every spike came from a post solving a specific problem someone was searching for. None of them are essays. None of them are opinions. They're all "here's a weird thing I ran into and how I fixed it."

This is the closest thing I have to "going viral," and it's about a 30-line shell.nix.

## 2. Fastest rising: NixOS + Claude Code

In the last seven days versus the prior seven, the two biggest gainers are both about running Claude Code on NixOS:

| Post                                                                       | Last 7d | Prev 7d | Delta |
| -------------------------------------------------------------------------- | ------: | ------: | ----: |
| [Nix shells, SSH, and Claude Code](/blog/2026/nix-shells-ssh-claude-code/) |      49 |      10 |   +39 |
| [Running Claude Code on NixOS](/blog/2026/running-claude-code-on-nixos/)   |      34 |       9 |   +25 |

That's probably not a coincidence. Anthropic must have changed something recently that caused more people to hit problems running Claude Code on NixOS, and search engines surface my posts as the fix.

The two posts also feed each other. Readers land on one, then click through to the other. Internal linking matters more than I expected.

## 3. Fastest out the gate: 88 hits in the first 30 days

The previous numbers measure "popular right now." A different question is "which posts hit hardest in their first month after publishing?"

The top five by views in the first 30 days after their publish date:

| Post                                                                                          | Published   | First 30d |
| --------------------------------------------------------------------------------------------- | ----------- | --------: |
| [Rewriting Claude Code in Rust](/blog/2026/rewriting-claude-code-in-rust-with-claude/)        | 2026-04-01  |        88 |
| [Running Claude Code on NixOS](/blog/2026/running-claude-code-on-nixos/)                      | 2026-05-07  |        43 |
| [Letting AI pick the project](/blog/2026/letting-ai-pick-the-project/)                        | 2026-01-19  |        37 |
| [Skin shedding, not bikeshedding](/blog/2025/skin-shedding-not-bikeshedding/)                 | 2025-11-23  |        32 |
| [Rewriting Claude Code in Rust (Part 2)](/blog/2026/rewriting-claude-code-in-rust-part-2/)    | 2026-04-02  |        29 |

The Rust + Claude post is in its own tier. It got 47 of those 88 hits in the first 7 days. That's almost certainly a referral spike from somewhere - Hacker News, Lobsters, a Mastodon boost, hard to say without per-day referrer data.

This is a different shape from the NixOS posts. The NixOS surge is search-driven and building over weeks. The Rust + Claude launch was a sharp burst that mostly came and went. Both are "popular." Only one keeps compounding.

## 4. Longest site-wide streak: 119 days

Every single day from 2026-01-19 to today, at least one post on this blog has been read by someone. That's 119 consecutive days without a gap.

The previous longest streak was 49 days. Before that, 29. Before that, 25.

This is what "getting indexed" actually looks like as a curve.

Before indexing, your blog gets read on days when you publish something or share a link somewhere. After indexing, it gets read every day, forever, because somebody somewhere is searching for a problem you wrote about.

That shift was the biggest surprise from all this data. The traffic doesn't spike and disappear anymore. It compounds.

## 5. Longest per-post streak: 32 days

[Nix shells, SSH, and Claude Code](/blog/2026/nix-shells-ssh-claude-code/) was read every day from 2026-03-26 to 2026-04-26 - 32 consecutive days. That's the longest streak any single post has had.

The next best are all under two weeks:

* [Rewriting Claude Code in Rust](/blog/2026/rewriting-claude-code-in-rust-with-claude/): 13 days (twice)
* [Hyprland tricks: close window confirmation](/blog/2025/hyprland-tricks-close-window-confirmation/): 13 days
* Same hyprland post again: 11 days, then 10, then 8, then 7

The hyprland post is still the quiet workhorse of the blog. Published in 2025, it's been read at least once on 146 different days. About 1.8 hits per day on average, every week, for nearly a year.

Nothing else comes close to that consistency.

If you can choose the problems you write about, choose ones that everybody eventually hits and that nobody else has documented clearly.

Length is uncorrelated with traffic.

Problem-specificity is.

The hyprland post is one paragraph and a screenshot. The nix-shells post is six paragraphs. Both outperform longer essays by a wide margin.

## 6. Where readers actually come from

Top 10 referrers, last 90 days:

| Source                                | Hits |
| ------------------------------------- | ---: |
| (direct)                              |  391 |
| Google                                |  382 |
| duckduckgo.com                        |   45 |
| jakegoldsborough.com/blog             |   37 |
| /tags/nixos                           |   33 |
| /blog/2026/nix-shells-ssh-claude-code |   32 |
| /resume                               |   32 |
| jakegoldsborough.com                  |   29 |
| kagi.com                              |   19 |
| Hacker News                           |   14 |

A few things stood out immediately:

* **Direct and Google are basically tied.** "Direct" includes users with stripped referrer headers, privacy-focused browsers, chat apps, bookmarks, and manually typed URLs. In practice, a lot of "direct" is probably search-driven too.
* **DuckDuckGo (45) and Kagi (19) combined still trail Google by an order of magnitude.** Kagi has a much smaller user base than Google, so this isn't surprising, but it's a useful reality check on how niche the alternative-search world still is.
* **Internal navigation matters.** The /blog index, /tags/nixos, and even /resume page each drive 30+ clicks. Once someone lands on the site, they often keep exploring.
* **Hacker News isn't the firehose people imagine.** A front-page post probably changes the math, but a link in /new creates a short spike and then vanishes quickly.

The more surprising pattern is that almost all long-term traffic comes from search and internal links, not social media.

## What I'd do differently

Honestly? Nothing.

I'm not optimizing for traffic. But if I were, the data points toward one obvious strategy:

Write more posts documenting highly specific problems with highly specific solutions.

Not opinions.

Not giant tutorials covering everything.

Just the thing somebody searches for after they hit a wall at 1am.

Small technical posts outperform broad polished essays by a huge margin. At least on this blog.

## How I got this data

GoatCounter ships a SQLite database. I ssh into my VPS, run `nix-shell -p sqlite`, and query it directly.

The two most useful tables are:

* `paths`: post URLs and titles
* `hit_counts`: hour-bucketed view counts joined by `path_id`

The streak queries use the standard SQL trick of subtracting a row number from a date. Rows with the same difference belong to the same consecutive run.

If you self-host GoatCounter, the same queries work on your data. If you don't, the API exposes most of this through `/api/v0/stats/hits` and related endpoints.

The funny part is that after a year of blogging, the strongest signal wasn't traffic volume.

It was consistency.

Once a post solves a real problem and gets indexed, it just keeps quietly working in the background forever.

