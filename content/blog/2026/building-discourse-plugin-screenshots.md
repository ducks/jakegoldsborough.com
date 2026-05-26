---
title: "Building a Screenshot Pipeline for Discourse Plugins"
date: 2026-05-25
description: "A small tool that captures Discourse plugin UIs in CI and publishes a gallery, modeled on Penar's theme-screenshots project but pointed at plugin routes."

taxonomies:
  tags:
    - discourse
    - ruby
    - ci
    - oss
---

I built [discourse-plugin-screenshots on
GitHub](https://github.com/ducks/discourse-plugin-screenshots), a small tool
that captures Discourse plugin UIs against a real Discourse instance in CI
and publishes the resulting PNGs to GitHub Pages.

It's modeled on [Penar Musaraj's
discourse-theme-screenshots](https://github.com/pmusaraj/discourse-theme-screenshots),
which screenshots themes against a battery of routes. Same idea, different
target: instead of "does this theme break the latest topic view," it asks
"does my plugin's UI still render correctly in current Discourse."

Live example for `discourse-itinerary`, the plugin I dogfooded it on:
[https://ducks.github.io/discourse-itinerary/](https://ducks.github.io/discourse-itinerary/).

## Why?

I'd been hand-screenshotting [discourse-itinerary](https://github.com/ducks/discourse-itinerary)
for [its blog post](/blog/2026/building-discourse-itinerary/) and realized
the same problem applies to every plugin I might write or maintain:

- Plugins break in unexpected ways when Discourse core changes. A CSS class
  gets renamed and your plugin's panel suddenly looks weird.
- A new theme like Horizon ships and your plugin's overrides don't quite
  match anymore.
- A plugin API method deprecates and silently degrades.

You usually find out from a user filing a screenshot. That's a slow loop.

What if every plugin had a nightly or per-push screenshot run that posted
its current state to a public page? Visual regressions become visible.
"Here's what my plugin looks like today" becomes a free byproduct of
shipping.

Penar's tool already does this for themes. Plugins were the X-shaped hole
next to it.

## The architecture

The tool ships a **reusable GitHub Actions workflow**. Plugins opt in by
adding ~12 lines of YAML to their own `.github/workflows/`:

```yaml
name: Screenshots
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  screenshots:
    uses: ducks/discourse-plugin-screenshots/.github/workflows/plugin-screenshots.yml@main
```

That's it. Each plugin maintainer owns their schedule, their gallery, their
CI minutes. The tool repo doesn't enumerate plugins, doesn't centrally
batch them, doesn't pay for anyone else's runs. Same pattern Discourse
already uses for its own
[`discourse-plugin.yml`](https://github.com/discourse/.github/blob/main/.github/workflows/discourse-plugin.yml)
reusable workflow.

## How a plugin describes what to capture

A plugin opts in by shipping `config/screenshots.yml` at the repo root:

```yaml
seed: spec/screenshot_seed.rb

urls:
  - path: /itinerary
    name: trip-list
    description: Trip list home page
  - path: /itinerary/2
    name: timeline
    description: Per-trip timeline with day grouping
```

The optional `seed` is a Ruby file run inside the test env before captures
fire. Without it, `/itinerary` would render an empty state ("No trips
yet"), which makes for sad screenshots. The seed creates a few realistic
trips with legs so the pages have something to render.

The seed file is plain Ruby that runs inside Discourse's Rails test
environment. It can use `PostCreator`, `SiteSetting`, plugin-specific
classes, whatever. Plugin-specific concerns stay in the plugin.

## The workflow

The reusable workflow is the heart of it. Slightly simplified:

1. Spin up `discourse/discourse_test:release` (Discourse's official test
   container, comes with system libs Playwright needs).
2. Check out the calling plugin, this tool, and `discourse/discourse`.
3. Symlink the plugin into `discourse/plugins/<id>`.
4. Boot Postgres + Redis, migrate the test DB.
5. Install Playwright Chromium.
6. Run a Capybara system spec that reads the plugin's manifest, runs the
   seed file, visits each URL, and saves a PNG.
7. Upload `public/` to the calling repo's GitHub Pages.

Total runtime: ~5-10 minutes after the initial container pull.

## First green run

I wired the workflow into the itinerary plugin's CI, pushed, and the
first run came back green. Screenshots up at
[ducks.github.io/discourse-itinerary](https://ducks.github.io/discourse-itinerary/),
captured automatically on every push to main.

That's the whole loop. Plugin author writes
`config/screenshots.yml`, drops a reusable-workflow file in
`.github/workflows/`, enables Pages, pushes. Five minutes later there's
a public gallery of what their plugin looks like in current Discourse.

## The rabbit holes

Building it taught me three things about the Discourse-on-NixOS stack
that I wouldn't have learned otherwise.

### Playwright's Chromium doesn't run on NixOS

Discourse uses Playwright for system specs. The first time I tried the
tool locally, the Capybara driver tried to launch Chromium and got:

```
error while loading shared libraries: libglib-2.0.so.0: cannot open
shared object file: No such file or directory
```

Playwright's `pnpm playwright install` downloads a generic Linux Chromium
build to `~/.cache/ms-playwright`. That binary expects to find shared libs
at standard `/usr/lib` paths. NixOS, famously, doesn't have a
`/usr/lib`. Everything is in `/nix/store/<hash>-glib-2.x.y/lib`.

Two paths to fix this:

1. `LD_LIBRARY_PATH` gymnastics. Add every needed lib to a nix-shell.
2. `nixpkgs.playwright-driver.browsers`, a package that pre-patches the
   Chromium binary with NixOS-compatible RPATHs.

I went with option 2:

```nix
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [ pkgs.playwright-driver.browsers ];
  shellHook = ''
    export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
  '';
}
```

This got me past the lib errors and into a new one: my nixpkgs channel
ships `chromium-1169` but Discourse's Playwright gem pins
`chromium-1217`. The right fix is a flake pin or `nixpkgs-unstable`
override, which I haven't shaved yet.

So locally on NixOS the tool runs up to "launching Chromium" before
hitting the version mismatch. In CI it sails through, because
`discourse/discourse_test:release` is a regular Linux image with the
matching system libs and Playwright downloads the right version. **The
same code runs in both places. CI is currently the only one that
succeeds end-to-end on my machine.**

That ended up being a useful property. The CI is the authoritative loop:
real container, real Discourse, real Playwright, public gallery at the
end. Local is a developer convenience that I can keep chipping at without
blocking the rest of the tool from being useful.

### Rspec accepts absolute spec paths from outside the project

I was worried that running Discourse's `bin/rspec` against a spec file
that lives outside the Discourse repo wouldn't work. `rails_helper.rb`
wouldn't be picked up automatically, Capybara's drivers wouldn't be
registered, etc.

Turns out: it works fine. RSpec loads `rails_helper` via the spec file's
own `require`, and Discourse's `bin/rspec` boots Rails normally
regardless of the spec's path. The spec just needs `require
"rails_helper"` at the top.

This let me keep the spec in this tool's repo rather than vendoring it
into every plugin or asking Discourse to ship it.

### Reusable workflows scale better than central orchestration

The first version of this had a central `config/plugins.yml` listing
every plugin, and a single CI run that captured all of them. Penar's
theme tool works that way for good reasons: themes are a relatively small
set and they're meant to be compared side-by-side.

For plugins it doesn't work. If you add 20 plugins, the central run
becomes a 4-hour job that fails halfway and has to retry the whole batch.
You also push all the CI cost onto whoever maintains the tool repo.

Reusable workflows flip both. Each plugin's CI runs only when that plugin
changes. The tool repo's job is to provide the reusable workflow, not to
enumerate consumers.

## What's missing

This is a v0. Real things it doesn't do yet:

- **Multiple themes.** Right now it captures against the default theme.
  Capturing against Horizon, a dark theme, and the default is the obvious
  next step. Penar's tool already does this; mostly a matter of porting
  the theme-loading code.
- **Multiple viewports.** Just 1440x900 today. Mobile (375x667) would be
  the big one to add.
- **Visual diffing.** "Here's what changed since last run" via image
  diff. Tools like reg-suit or Percy do this; expensive at scale.
- **Auto-discovery of routes.** Right now you list URLs in
  `config/screenshots.yml`. Could introspect the plugin's
  `route-map.js` for routes, but dynamic segments (`:trip_id`) need
  hints either way.
- **NixOS local parity.** The chromium-1217 pin dance is genuinely the
  last thing blocking local runs.

## Try it

```sh
# In your plugin repo, create config/screenshots.yml with your URLs.
# Then drop this in .github/workflows/screenshots.yml:

name: Screenshots
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  screenshots:
    uses: ducks/discourse-plugin-screenshots/.github/workflows/plugin-screenshots.yml@main
```

Enable GitHub Pages on the plugin repo (Settings -> Pages -> Source:
GitHub Actions), push to main, and after a few minutes your screenshots
will be at `https://<you>.github.io/<plugin>/`.

The tool is open source:
[ducks/discourse-plugin-screenshots](https://github.com/ducks/discourse-plugin-screenshots).
Pull requests for theme + viewport + diff support welcome.
