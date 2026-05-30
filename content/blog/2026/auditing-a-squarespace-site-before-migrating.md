---
title: "Auditing a Squarespace 7.0 site before migrating to 7.1"
date: 2026-05-30
description: "Squarespace's 7.0 to 7.1 update tool has a 100-page cap and several documented content limitations. Before running it on a real site, you want a complete inventory of what's about to break, and why. Here's the script I wrote to produce that inventory."
taxonomies:
  tags:
    - squarespace
    - dev
    - tools
---

A local non-profit put out a call for volunteers looking for a "front-end web developer consultant" for their Squarespace site, and I answered it. The presenting problem: they want to migrate from Squarespace 7.0 to 7.1 and figure out what to do about their members-only login area.

Before any migration conversation, I wanted a real inventory of what's actually on the site. Squarespace's [update tool](https://support.squarespace.com/hc/en-us/articles/360038270572-Moving-from-Squarespace-version-7-0-to-version-7-1) has documented limitations: a 100-page cap, no support for album pages, video blocks on gallery pages don't carry over, certain templates are ineligible. The tool itself will tell you if your site is ineligible when you try to run it. What it won't tell you is *why*, *by how much*, or *which pages are the problem* in a form you can hand to a non-technical decision-maker.

So I wrote a small Python script that does.

## The trick: `?format=json`

Every Squarespace page accepts a `?format=json` (or `?format=json-pretty`) query parameter that returns a structured representation of the page. It's [documented on Squarespace's developer portal](https://developers.squarespace.com/view-json-data), used internally by their iOS editor, and has been stable for years.

```bash
curl -sS "https://www.portlandbonsai.org/resources?format=json" | jq .
```

You get 15 top-level keys per page. The interesting ones:

- `website` - site-wide identity (title, tagline, domain, language, social accounts)
- `websiteSettings` - configuration (business type, country, contact info)
- `collection` - the page itself (title, URL, page type, item count, updated date)
- `item` - populated only when the URL is an individual entry inside a collection (a single blog post, product, event item, etc.)
- `mainContent` - the rendered HTML body of the page
- `template` - which template the site is on

That `item` field is what makes the audit tractable. Squarespace's 100-page cap only counts *container* pages: layout pages, blog pages, gallery pages, store pages, event calendar pages. The individual items inside those collections (the blog posts, the products, the event entries) don't count. If you treat every URL in the sitemap as a "page," you'll wildly overcount and start fights that don't need to happen.

## What the audit checks

I encoded the documented limitations from Squarespace's update tool into a script:

| Check                          | Why it matters                                          |
| ------------------------------ | ------------------------------------------------------- |
| Container vs item count        | Update tool refuses sites with more than 100 containers |
| Album pages                    | Deleted by the update                                   |
| Gallery pages                  | Convert to layout pages; embedded videos are lost       |
| Share buttons                  | Not supported in 7.1                                    |
| Custom Adobe Typekit fonts     | Not supported in 7.1                                    |
| Products per store page        | Cap of 200 per store                                    |

The script crawls `sitemap.xml`, hits `?format=json` for every URL, separates containers from items, and groups findings by severity (block / warn / info). Output is a markdown report you can read top to bottom.

## What it found on the real site

The site I was auditing has a public face of maybe 30 pages. The sitemap lists 489 URLs. After separating containers from items and tag/category views, the real eligibility count is **126**, which is 26 over the cap.

```
Eligibility count
- Container pages (count toward 100-page cap): 126
- Individual items (excluded from cap):        121
- Filter/tag views (excluded from cap):        243
- ❌ OVER the 100-page eligibility cap by 26.

Containers by type
- page:     76
- gallery:  45
- products: 3
- blog:     1
- events:   1
```

The story isn't the blog. The blog has one container page and 65 posts; none of that is a problem for the cap. The story is **45 gallery pages** built up over a decade of convention photos, fall show photos, monthly meeting photos. Each gallery is a container, each one counts, and each one is a candidate for the "embedded videos won't survive" warning. Galleries plus the 76 plain pages already put the site over the cap before you even look at the rest.

This is the kind of detail you can't get from a casual click-through. The webmaster knew the blog was big but hadn't connected the gallery archive to the update tool's cap.

Without this audit, the conversation would have been:

> "We'll run the update tool when you're ready."
> "The update tool refused."
> "Oh."

Instead, the conversation becomes:

> "You're 26 pages over the eligibility cap. Most of the slack is in 45 gallery pages, many of which are show photos from 2016-2019 that probably don't need to stay live. Here are three ways to handle it."

That's the kind of pre-work that actually moves a project forward.

## The script

It's a single Python file, no dependencies beyond the stdlib. Crawls the public sitemap, fetches each page's JSON, runs the checks, emits markdown.

The full source is in a gist: [sqsp-preflight.py](https://gist.github.com/ducks/cc216cff323f572830487cad7acd87be). About 400 lines. No setup. Run it as:

```bash
python3 sqsp-preflight.py https://example.com > report.md
```

For a 30-page site it finishes in seconds. For a 489-URL site it takes a couple of minutes (one HTTP request per URL, no parallelism, good enough).

## What it doesn't do

A few things the audit can't see:

- **Members-only content.** The crawler is unauthenticated. If a site has a member area with extra pages behind login, they're invisible.
- **Developer mode usage.** Only the admin knows whether this is on.
- **Discontinued template detection.** The `template` field in the JSON is sparse. Cross-referencing against Squarespace's current supported-template list still needs a human eyeball.
- **Visual fidelity in 7.1.** No tool can predict whether a 7.0 layout will look right in 7.1's Fluid Engine. That's why the update tool has a preview mode.
- **Sidebar navigation.** I couldn't find a reliable signal in the JSON for this one.

The script's job is to surface the *known unknowns* fast enough that the human can focus on the genuine judgment calls.

## What this is and isn't

It's not a migration tool. Squarespace's update tool is the migration tool. This is a **preflight check** that runs before you commit, surfaces the specific pages that drive eligibility, and produces a report a non-technical decision-maker can read. The update tool will tell you "no"; this tells you why and what to fix first.

It also isn't a project. I'm not going to maintain this as a package. Squarespace can change the JSON shape at any time and break it; the maintenance commitment isn't worth it. If you hit the same problem, fork the gist, adapt it to your site, throw it away after.

The actually-publishable thing here is the *approach*: use `?format=json` to inventory the site, separate containers from items the way the update tool does, encode the documented limitations as checks, produce a markdown report. Anyone reading this should be able to recreate the script in an evening.

## The bigger lesson

Squarespace's docs tell you the limitations. The update tool tells you whether you qualify. Neither one hands you the punch list of *which pages to deal with, in what order, and why*. That gap shows up over and over with hosted platforms: the docs describe the system, the tools enforce the rules, but nothing produces an actionable report against your specific site.

For any platform migration on any hosted product, the first useful piece of work isn't "start the migration." It's "audit the source against the destination's known constraints, in a form a human can act on." Sometimes that takes a script. Often a CLI plus an afternoon does it.
