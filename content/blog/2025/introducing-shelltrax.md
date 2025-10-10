+++
title = "Introducing Shelltrax - Or how I vibe programmed my way to a TUI music player"
date = 2025-06-24
description = "Building a terminal-based music player in Rust from scratch to learn the language through real-world challenges like TUI rendering, audio streaming, metadata parsing, and concurrent state management."
[taxonomies]
tags = ["rust", "tui"]
+++

### Shelltrax

[github](https://github.com/ducks/shelltrax)

I love the terminal and have dabbled in Rust since the very early days. I've
been to 5 RustConfs, but my actual knowledge of Rust never really went past the
basics. I come from a scripted language background, so while I *understood* the
ideas, I didn't really understand them in practice -- mostly because I hadn’t
personally suffered the pain points Rust tries to solve.

The only way for me to truly understand was to build something real. Not
another tutorial. Not another toy example. Something I’d actually use.

### cmus

[cmus](https://cmus.github.io/) is a small, *fast*, and powerful console
music player for Unix-like operating systems and it's easily one of the apps
I use most.

And like I mentioned above, I learn best by writing real tools so
why not try to recreate one of my daily drivers? It seemed like the perfect mix
of things to learn: input handling, TUI design, file scanning, metadata parsing,
and real-time playback.

### Stack and Structure

I tried to keep the stack small, modern, and as "Rust-native" as possible:

- `ratatui` - TUI layout and rendering
- `crossterm` - keyboard input handling and terminal backend
- `walkdir` - recursive file scanning and directory walking
- `id3v2` and `symphonia` - parsing audio metadata (ID3, Vorbis, FLAC, etc)
- `rodio` - audio playback

Together, these gave me a good spread of "real" Rust problems to tackle:
filesystems, decoding binary formats, audio streaming, real-time UI state, and
concurrency.

### Interface Design

From the start, I wanted it to feel very simple.

The interface is split into a few key views:

- A **library view**, where I can browse artists, albums, and tracks
- A **file browser**, which lets me scan new folders and import music to the
  library
- A persistent **footer**, showing the current track, album, artist and a
  real-time progress bar while the song plays

Even building that much required learning how to manage state in a long-running
TUI app, wire up input handling with `crossterm`, and keep the UI responsive
while streaming audio in the background.

### What's Working

Despite starting this as mostly an experiment to learn Rust, I now have a music player that:

- Scans my local library for FLAC and MP3 files
- Parses metadata (title, album, artist, album artist, etc) correctly using Symphonia
- Sorts and groups tracks by album artist for proper browsing
- Supports autoplay, automatically advancing to the next track
- Displays a footer with current song info and a live progress bar
- Supports pause and resume functionality with synchronized playback state

It's already become my daily music player, replacing cmus for my listening.

### Reflections

The most valuable part of this project was finally experiencing what Rust is
really trying to protect you from.

- **Shared state**: Coordinating real-time playback state across multiple
  threads (UI thread, playback thread, decode thread) forced me to actually
  deal with ownership, borrowing, and synchronization directly.
- **Lifetimes**: I finally had to understand where lifetimes mattered when
  dealing with borrowed references and streaming APIs.
- **Real-world edge cases**: Dealing with weird metadata formats, malformed
  files, and partial decode failures showed me how fragile real-world data can
  be.

I've read about these things for years, but building Shelltrax forced me to
feel the problems directly. That's what finally made the learning click.

### Vibe programming

There’s a lot of discourse around "vibe programming" — the idea of just writing
code by intuition, following your gut, and iteratively figuring it out as you
go. It sometimes gets a bad rap: "You’re just hacking around without fully
understanding the language or design."

But for me, vibe programming doesn’t mean ignoring fundamentals. It means
building something real, fast enough to stay motivated, but being careful
enough to stop and actually understand why something works (or why it doesn’t).

I could have read Rust books or done more exercises, but none of that would
have taught me what happens when a real audio stream crosses threads and you
forget to reset a state flag at just the right time. And I'll be honest, I
didn't magically learn Rust completely and know how to handle every situation
but I certainly have a much better idea than a few weeks ago.

Vibe programming can force you into real problems. If you stay curious and
careful, those problems become extremely effective teachers.
