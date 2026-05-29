---
title: "Auditing a 489-page Squarespace 7.0 site before migrating to 7.1"
date: 2026-05-17
description: "Squarespace's 7.0 to 7.1 update tool has a 100-page cap and several documented content limitations. Before running it on a real site, you want a complete inventory of what's about to break. Here's the script I wrote to produce that inventory."
taxonomies:
  tags:
    - squarespace
    - dev
    - tools
---

A local non-profit asked me to volunteer as a "front-end web developer consultant" on their Squarespace site. The presenting problem: they want to migrate from Squarespace 7.0 to 7.1 and figure out what to do about their members-only login area.

Before any migration conversation, I wanted a real inventory of what's actually on the site. Squarespace's [update tool](https://support.squarespace.com/hc/en-us/articles/360038270572-Moving-from-Squarespace-version-7-0-to-version-7-1) has documented limitations - a 100-page cap, no support for album pages, video blocks on gallery pages don't carry over, certain templates are ineligible. The docs tell you these limitations exist. They don't tell you whether *your* site is going to hit them.

So I wrote a small Python script that does.

## The trick: `?format=json`

Every Squarespace page accepts a `?format=json` query parameter that returns a structured representation of the page. It's used internally by their iOS editor and has been stable for years. It's not officially documented, which is why agencies whisper about it.

```bash
curl -sS "https://www.portlandbonsai.org/resources?format=json" | jq .
```

You get 15 top-level keys per page. The interesting ones:

- `website` - site-wide identity (title, tagline, domain, language, social accounts)
- `websiteSettings` - configuration (business type, country, contact info)
- `collection` - the page itself (title, URL, page type, item count, updated date)
- `mainContent` - the rendered HTML body of the page
- `template` - which template the site is on

That's enough to build a real audit. The page type field is especially useful - it tells you which pages are blog posts vs galleries vs products vs plain pages, which directly maps to the update tool's limitations.

## What the audit checks

I encoded the documented limitations from Squarespace's update tool into a script:

| Check                                  | Why it matters                                          |
| -------------------------------------- | ------------------------------------------------------- |
| Total page count                       | Update tool refuses sites over 100 pages                |
| Album pages                            | Deleted by the update                                   |
| Gallery pages                          | Convert to layout pages; embedded videos are lost       |
| Share buttons                          | Not supported in 7.1                                    |
| Custom Adobe Typekit fonts             | Not supported in 7.1                                    |
| Products per store page                | Cap of 200 per store                                    |

The script crawls `sitemap.xml`, hits `?format=json` for every page, and groups findings by severity (block / warn / info). Output is a markdown report you can read top to bottom.

## What it found on the real site

The site I was auditing has a public face of maybe 30 pages. The audit found **489**.

```
- Discovered pages: 489
- ❌ OVER the 100-page eligibility cap.

Page type summary
- blog:     309
- page:     76
- events:   48
- gallery:  45
- products: 11
```

The blog accounts for 63% of the page count. The site has galleries going back to 2016 - convention photos, fall show photos, monthly meeting photos - 45 of them, each one a potential video-loss issue if any contain embedded clips.

This is the kind of detail you can't get from a casual click-through. The president of the org genuinely did not know they had this much content. The webmaster knew the blog was big but hadn't connected it to the update tool's cap.

Without this audit, the conversation would have been:

> "We'll run the update tool when you're ready."
> "The update tool refused."
> "Oh."

Instead, the conversation becomes:

> "You're 4-5x over the eligibility cap. Most of that is blog posts. Here are three ways to handle it."

That's the kind of pre-work that actually moves a project forward.

## The script

It's a single Python file, no dependencies beyond the stdlib. Crawls the public sitemap, fetches each page's JSON, runs the checks, emits markdown.

The full source is in a gist: [sqsp-preflight.py](https://gist.github.com/ducks/...). About 200 lines. No setup. Run it as:

```bash
python3 sqsp-preflight.py https://example.com > report.md
```

For a 30-page site it finishes in seconds. For a 489-page site it takes a couple of minutes (one HTTP request per page, no parallelism - good enough).

## What it doesn't do

A few things the audit can't see:

- **Members-only content.** The crawler is unauthenticated. If a site has a member area with extra pages behind login, they're invisible.
- **Developer mode usage.** Only the admin knows whether this is on.
- **Discontinued template detection.** The `template` field in the JSON is sparse. Cross-referencing against Squarespace's current supported-template list still needs a human eyeball.
- **Visual fidelity in 7.1.** No tool can predict whether a 7.0 layout will look right in 7.1's Fluid Engine. That's why the update tool has a preview mode.
- **Sidebar navigation.** I couldn't find a reliable signal in the JSON for this one.

The script's job is to surface the *known unknowns* fast enough that the human can focus on the genuine judgment calls.

## What this is and isn't

It's not a migration tool. Squarespace's update tool is the migration tool. This is a **preflight check** - run it first, learn what you're working with, then decide whether to run the migration.

It also isn't a project. I'm not going to maintain this as a package. Squarespace can change `?format=json`'s shape at any time and break it; the maintenance commitment isn't worth it. If you hit the same problem, fork the gist, adapt it to your site, throw it away after.

The actually-publishable thing here is the *approach*: use `?format=json` to inventory the site, encode the update tool's documented limitations as checks, produce a markdown report a non-technical decision-maker can read. Anyone reading this should be able to recreate the script in an evening.

## The bigger lesson

Squarespace's docs tell you the limitations. They don't tell you whether your site hits them. That gap shows up over and over with hosted platforms - the docs describe the system, not your specific situation.

For any platform migration on any hosted product, the first useful piece of work isn't "start the migration." It's "audit the source against the destination's known constraints." Sometimes that takes a script. Often a CLI plus an afternoon does it.
