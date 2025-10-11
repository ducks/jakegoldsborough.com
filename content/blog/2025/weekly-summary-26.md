---
title: ChatGPT Changelog (fka Weekly Summary) - 26/52
date: '2025-06-27'
description: Refining NixOS workflow with nix-shell and Flakes, progressing GitVote
  CLI with GPG signatures, continuing blog writing, and maintaining Swedish language
  learning streak.
tags:
- gpt
- changelog
- weekly summary
---

## NixOS Workflow & Improvements

- Refined NixOS development workflow by exploring the use of `nix-shell`
  and Flakes for environment isolation and reproducibility. Discussed how to
  structure shell files for separate projects (e.g. Rust/Zola vs. Node).
- Discovered how tools like `rustup` and `volta` behave in Nix environments.
  You acknowledged that `nix-shell` helps contain them safely, but the
  Nix-native approach may still be preferable long term.
- Cleaned up a bug with `nixvim` setup by updating to the latest
  version and resolving a plugin rename (`coedium-vim` ➝ `windsurf`).
- Added Blueman via Nix, and experimented with different ways to start Waybar
  without tying up terminal (eventually using `hyprctl dispatch exec`).
- Successfully reversed trackpad scroll direction in Hyprland using overrides,
  and this worked well across setup.

## GitVote & GPG Work

- Progressed `gitvote` CLI and backend significantly:
  - Implemented registration and GPG signature support.
  - Verified that voting model and simulation strategy still worked.
  - Explored commit signing, storing keys in-repo, and ensuring modular CLI
    support for different user flows.
- Began planning for how to handle edge cases like simultaneous votes and
  eventually tallying.

## Blogging & Writing

- Continued work on NixOS daily driver series, planning to document how to
  set up Dotter and Hyprland cleanly from scratch before layering more config.
- Reflected on privacy-focused analytics post, considering how to improve
  tracking and discussing stance on respecting blockers.

## UDisc API & Wrapper Library

- Worked on orchestration pattern for the TypeScript `UDiscAPI` class,
  ensuring everything flows through a clean and testable interface.
- Removed unnecessary `loadFromFile` logic and moved toward using raw JSON
  inputs with explicit route extraction.
- Streamlined the construction flow:

  ```
  const udisc = new UDisc();
  const schemaMap = udisc.extractSchemaMap(raw);
  const eventListings = udisc.resolveKeyValuePairs('eventListing');
  ```

## Personal Progress

- Maintained streak of learning Swedish — now at 193 days in a row. Mostly
  review. Need to listen to more podcasts/books again.
- Only played one round of disc golf this week

