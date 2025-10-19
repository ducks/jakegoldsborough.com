---
title: Weekly Summary - 23/52
date: '2025-06-07'
description: Accomplishments in reverse engineering MyFrisbee API, TypeScript module
  publishing, static site improvements, NixOS blog series, Gitea self-hosting, and
  reaching 179-day Swedish streak.
taxonomies:
  tags:
    - weekly summary
---

### Accomplishments

#### Reverse Engineering UDisc API

- Published Part 3 of blog series on `Course` and `CourseDetails` structure.
- Drafted outline for Part 4, focused on `smartLayouts` and `hole` info.
- Renamed `resolveSchemaMap` to a clearer, more specific function name.
- Improved nested hydration using `deepHydrate` for decoding nested data.
- Considered naming conventions like `courseWithDetails` for client API.
- Decided to provide a client library first, rather than a full backend.

#### TypeScript Module and Publishing

- Adopted `YYYYMMDD` format for versioning with semantic meaning.
- Resolved JSON parsing and bundling issues in the TypeScript setup.
- Held off on publishing to npm, but prepared module for later release.

#### Static Site and Blogging

- Fixed insecure site warning by enabling HTTPS on GitHub Pages.
- Designed favicons and tried different accent colors and sizes.
- Planned a meta-post to tie the blog series together conceptually.

#### NixOS Daily Driver Series

- Published Part 3 of your NixOS daily driver blog series.
- Started exploring ideas for better display managers like Lemurs.

#### Gitea Self-Hosting

- Setup Gitea as Linux service.
- Resolved SSH cloning issues by switching to internal SSH service.
- Researched CI/CD via Woodpecker

#### Swedish Language Learning

- Reached 179-day streak learning Swedish using Babbel.

### To-Do / Next Steps

#### UDisc Blog Series

- Write and publish Part 4 about `smartLayouts`, `holes`, and `tees`.
- Create a meta-post summarizing the series with internal references.
- Explore building a schema or data visualizer for reader clarity.

#### open-udisc-api Module

- Prepare for npm publishing (README, `exports`, format cleanup).
- Write more Vitest-based tests using mock data to avoid real API calls.
- Add inline documentation and usage examples to client methods.

#### NixOS Configuration

- Start Lemurs setup for display management.
- Write Part 4 of the daily driver series covering service setup.
- Explore modularizing `environment.systemPackages` further.

#### Gitea Enhancements

- Consider automating deployment with Git hooks or CI.

#### Additional Ideas

- Write a short post explaining UDisc `.data` format independently.
- Research legality of wrapper libraries for non-public data APIs.
- Consider writing a proxy or wrapper API as a hosted endpoint.
