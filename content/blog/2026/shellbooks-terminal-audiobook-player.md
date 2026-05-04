---
title: "shellbooks: A Terminal Audiobook Player"
date: 2026-05-04
description: "A cmus-inspired terminal audiobook player and library manager, with chapters, series, and per-book progress that survives a crash."
taxonomies:
  tags:
    - rust
    - tui
    - oss
---

I have a music player in the terminal ([shelltrax](https://github.com/ducks/shelltrax)) and a podcast player in the terminal ([shellcast](https://github.com/ducks/shellcast)). Audiobooks were the obvious gap.

So I built [shellbooks](https://github.com/ducks/shellbooks).

```
cargo install shellbooks
```

It's a TUI audiobook player and library manager. cmus-inspired keybinds, ratatui rendering, rodio for audio, the same shape as the other two shell\* tools.

## Why audiobooks need their own player

Music players treat tracks as the unit. Podcast players treat episodes as the unit. Audiobooks need the *book* as the unit, with chapters as the unit *inside* a book. That changes a few things:

- **Position memory matters more.** Resuming a song from 0:00 is fine. Resuming a 14-hour book from 0:00 is a tragedy.
- **Variable speed is table stakes.** Most people listen at 1.25x or 1.5x. A music player has no reason to ship this; an audiobook player without it is broken.
- **Chapter navigation needs to work.** Multi-file books have one chapter per file; single-file `.m4b` books have chapter markers embedded in the container.

None of this is exotic. It just doesn't fit the music or podcast model directly.

## The Stack

- `ratatui` and `crossterm` for the TUI
- `rodio` and `symphonia` for audio playback
- `id3` for mp3 tags, `mp4ameta` for m4b tags and chapter atoms
- `walkdir` for the file browser
- Plain JSON at `~/.local/share/shellbooks/library.json` for the library and per-book progress

Same stack the other shell\* tools use. The point of building these in a series is that each one starts halfway done.

## Interface

Three views, swapped with `1` / `2` / `3`:

- **Library** is two-pane: books left, chapters right. Tab toggles which side `j`/`k` moves through. Enter on the books pane resumes from the saved position. Enter on the chapters pane jumps to that chapter's start.
- **Bookmarks** lives at `2` (UI is still placeholder; the data model is in place).
- **Browser** is a file system browser. Navigate to a directory of audio files or a single `.m4b`, press `a`, and it's added to the library.

A persistent footer sits on every screen with the book title, current chapter, position, total duration, speed, and a progress gauge. Press `i` anywhere to open a centered modal with the full metadata for the selected book.

## What's Working

- Imports from a file browser - explicit action, no surprise sweeps of `~`
- Chapter detection: parses the chpl atom in `.m4b`, falls back to one chapter per file with cleaned filenames (`01 - Prologue.mp3` becomes `Prologue`)
- Per-book progress with autosave every 10 seconds while playing, plus on every chapter change. A crash never costs more than ten seconds.
- Variable speed (0.5x - 3.0x) via `+` and `-` in 5% steps. Pitch shifts with tempo today; pitch-preserving via tdpsola is next.
- Chapter skip (`b` next, `z` previous), seek (`,`/`.` ±10s, `[`/`]` ±60s)
- Cover art resolution: sidecar `cover.jpg` or `cover.png` first, then embedded artwork written to a cache file
- Tag extraction: title, author, narrator, series, year - using the audiobook publishing convention where artist is author and album is the book title
- Delete a book from the library with `d` (mirrors shelltrax)

## What's Not (yet)

- Pitch-preserving variable speed
- Bookmarks UI (model exists, no bindings yet)
- Theme parsing
- Sleep timer countdown
- Cover art rendered in-terminal (kitty / sixel / iterm2)
- Network sources like Audiobookshelf

## A Bug Worth Mentioning

Imported a book and the title showed as "Track 001."

The reason: I was reading the title tag from the first audio file. For a multi-file audiobook, the per-track `TIT2` is the *chapter* title, not the book. The book title belongs in the album tag. So now `apply_to_book` takes a `multi_file` flag and uses the album tag in that case, falling back to the directory name if there's no album.

For single-file `.m4b` it still uses the title tag normally, since there the file *is* the book.

The kind of bug that's obvious in hindsight and only really shows up once you point the tool at real publisher data.

## Building it in a Series Pays Off

The bulk of the work on shellbooks was on the audiobook-specific bits: chapter atom parsing, the multi-file album-as-title rule, position tracking that survives speed changes and pause/resume, the autosave loop. Almost none of it was on TUI scaffolding, the file browser, the event loop, or the release pipeline. All of that was lifted from shelltrax.

It's also why I'm thinking about pulling the shared TUI bits into a `shell-tui` crate. The `ListSelector`, the `BrowserState`, the event loop, the cmus-style screen jumps, the `Makefile` template, the GitHub Actions release workflow - all of it is duplicated nearly verbatim across three apps now. Three is the inflection point.

## Try It

```bash
cargo install shellbooks
shellbooks
```

Press `3` to open the file browser, navigate to your audiobooks, press `a` to import a book directory or `.m4b`. Press `1` to return to the library, Enter to start playing.

## Links

- [shellbooks](https://github.com/ducks/shellbooks)
- [shelltrax](https://github.com/ducks/shelltrax) - the music player it descends from
- [shellcast](https://github.com/ducks/shellcast) - the podcast player it descends from
