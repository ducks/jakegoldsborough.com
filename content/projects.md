+++
title = "Projects"
path = "projects"
+++

A collection of tools, plugins, and experiments I've built and maintain. Most
are open source and actively developed.

## Rust TUI Applications

Terminal user interfaces built with Ratatui. I prefer keyboard-driven,
minimal interfaces for daily workflows.

**[shellcast](https://github.com/ducks/shellcast)** - A minimal TUI podcast
player for the terminal. Subscribe to feeds, download episodes, and play
audio without leaving the command line.

**[shelltrax](https://github.com/ducks/shelltrax)** - A cmus-inspired
terminal music player written in Rust. Lightweight, keyboard-driven playback
with playlist management.

**[llm-tui](https://github.com/ducks/llm-tui)** - TUI for Ollama chat with
vim bindings and project-based session management. Local LLM conversations
organized by context.

**[discourse-tui](https://github.com/ducks/discourse-tui)** - Browse Discourse
forums from the terminal. Navigate categories, read topics, and browse posts
with vim-style keybindings.

**[vim-navigator-rs](https://github.com/ducks/vim-navigator-rs)** - Vim-style
modal editing and navigation for Ratatui TUIs. Reusable component for building
vim-like interfaces in terminal applications.

## Discourse Plugins

Extensions for Discourse forums. Built during my work at Discourse and for
personal experimentation.

**[discourse-yaks](https://github.com/ducks/discourse-yaks)** - Virtual
currency system for Discourse. Users earn and spend "Yaks" to unlock premium
post features like colored highlights, pins, and boosts. Includes wallet
management and transaction history.

**[discourse-guest-spot](https://github.com/ducks/discourse-guest-spot)** -
Transforms Discourse into a dual-purpose platform for tattoo artists: public
Instagram-style showcase combined with a private, invite-only community.

**[discourse-transit-tracker](https://github.com/ducks/discourse-transit-tracker)** -
Split-flap departure board plugin for Discourse. Display real-time transit
information with retro airport aesthetic.

**[discourse-invite-stats](https://github.com/ducks/discourse-invite-stats)** -
Visualizes invite relationships as an ASCII tree, showing how users invited
each other to join the community.

**[discourse-frndr](https://github.com/ducks/discourse-frndr)** - Friend
finding app built on Discourse. Match people based on interests and
compatibility.

## Neovim Plugins

Plugins for Neovim written in Lua. Focus on markdown workflows and
presentation tools.

**[vimdeck.nvim](https://github.com/ducks/vimdeck.nvim)** - Modern Neovim
presentation plugin for markdown files. ASCII art headers, clean rendering,
Treesitter parsing.

**[mdpreview.nvim](https://github.com/ducks/mdpreview.nvim)** - Live markdown
preview in Neovim split window. Treesitter parsing, synced scrolling, styled
headers.

**[nvim-vandelay](https://github.com/ducks/nvim-vandelay)** - Import
management for JavaScript and TypeScript. Automatically organize and insert
import statements.

## Development Tools

Command-line tools and libraries for developers. Automation, infrastructure,
and API clients.

**[date-ver](https://github.com/ducks/date-ver)** - Date-based versioning
specification. Use YYYYMMDD, YYYYMM, or YYYY for releases where timing matters
more than compatibility signals.

**[denver](https://github.com/ducks/denver)** - Discourse ENV managER. CLI
tool for managing multiple isolated Discourse development environments. Create,
switch between, and test different plugin combinations without breaking your
main setup.

**[yaml-janitor](https://github.com/ducks/yaml-janitor)** - YAML linter that
preserves comments using psych-pure. Detects issues and fixes formatting
without destroying documentation.

**[discourse-api-rs](https://github.com/ducks/discourse-api-rs)** - Async Rust
client for the Discourse forum API. Fetch topics, posts, categories, and more.

**[node-postgres-exporter](https://github.com/ducks/node-postgres-exporter)** -
A lightweight, configurable Prometheus exporter for PostgreSQL written in
Node.js.

## Web Applications

Browser-based tools and services. Mapping and route generation.

**[slumprutt](https://github.com/ducks/slumprutt)** - Generate random walking,
cycling, or driving routes for your next adventure. Built with Svelte.

## Experiments

Older projects and experiments.

**[gitvote](https://github.com/ducks/gitvote)** - Git-based cryptographically
verifiable voting system using signed commits, pull requests, and fully
auditable blockchain-style block generation.

All repositories are available on [GitHub](https://github.com/ducks).
