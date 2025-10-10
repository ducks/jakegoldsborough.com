+++
title = "ChatGPT Changelog (fka Weekly Summary) - 24/52"
date = 2025-06-13
description = "Introducing ChatGPT-generated personal changelogs covering MyFrisbee blog series, PostgreSQL exporter deployment, NixOS Hyprland configuration, and ongoing Swedish language learning."
[taxonomies]
tags = ["gpt", "changelog", "weekly summary"]
+++

### Happy Friday the 13th!

I have decided to slightly change up my personal weekly summary posts.

I have been using ChatGPT more and more and really find it to be an important
tool. It saves me so much time with debugging error messages and digging
through docs. It can also keep very good track of what I've been working on
and thinking about. Because of this, I have decided to update the way I do
the weekly summary. I am going to let ChatGPT generate a personal changelog
of everything I have been working on. It's not perfect so I do have to edit
it some but it still does a better job than I could ever do.

So with that, here is my weekly ChatGPT changelog:

### Accomplishments (Since June 7)

#### UDisc API / Blog Series

- Published Part 4 of the blog series: deep dive into `smartLayouts` and `holes`.
- Improved `deepHydrate`, began resolving issues with arrays of unresolved IDs.
- Continued resolving schema-indexed keys (e.g. `_254: 270`) for clarity.
- Added blog link to `open-udisc-api` README.
- Cleaned up TypeScript types and debugged schema hydration logic.

#### Infra & DevOps

- Set up Gitea using a Linux service.
- Implemented a Git pre-push hook to filter Zola drafts before publishing.
- Decided to drop OpenAPI support for the current API project.

#### PostgreSQL Exporter

- Deployed a general-purpose PostgreSQL -> Prometheus exporter.
- Added `/metrics`, `/livez`, `/readyz`, and `/configz` endpoints.
- Configured basic token authentication.
- Documented endpoints and auth in the README.

#### NixOS / Hyprland

- Diagnosed Hyprland reload issues involving `exec-once` behavior.
- Installed and confirmed use of:
  - wezterm
  - dunst
  - hypridle
  - bibata-cursor-theme
- Explored xcursor previews and how to apply cursor themes via Nix.
- Set up Waybar with Gruvbox-inspired CSS.

#### Miscellaneous

- Continued Swedish learning streak (currently 179+ days).
- Expanded concept for a first-person disc golf course viewer.
- Researched 360-degree and panoramic photo capture on Android/GrapheneOS.

---

### To-Do / Improvements

#### UDisc API + Blog

- Fix unresolved arrays in `deepHydrate`, such as `targetPositionLabels`.
- Begin drafting a "meta" post summarizing the UDisc reverse-engineering series.
- Write additional parts exploring fields like `dogleg` or `obLines`.
- Explore creating a visualizer for hydrated course data.

#### Infra / Self-Hosting

- Document the Gitea systemd service setup.
- Write a blog post about using Git hooks to manage Zola drafts.

#### NixOS / Hyprland

- Investigate why `exec-once` commands don't rerun on `hyprctl reload`.
- Continue refining modular `environment.systemPackages` layout.
- Extend daily-driver blog series for NixOS on MacBook hardware.

#### Portfolio + Sharing

- Add README links or badges to published blog posts.
- Write a post about decoding custom schema formats in APIs.
- Share blog content on Hacker News, Lobsters, or relevant communities.

