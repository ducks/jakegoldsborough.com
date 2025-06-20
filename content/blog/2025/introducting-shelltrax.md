+++
title = "Introducing Shelltrax - Or how I vibe programmed my way to a TUI music player"
date = 2025-06-17
[taxonomies]
tags = ["rust", "tui"]
+++

### Shelltrax

[github](https://github.com/ducks/shelltrax)

I love the terminal and have dabbled in rust since the very early days. I've
been to 5 RustConfs but my actual knowledge of rust never really went past the
basics. I come from a scripted language background so while I "understood" the
ideas, I didn't really understand them in practice because I haven't really
suffered the pain points it's trying to solve. The only way for me to really
understand is to build something real and not just learn through examples.

### cmus

[cmus](https://cmus.github.io/) is a small, *fast*, and powerful console
music player for Unix-like operating systems and it's easily one of my most used
apps. And like I mentioned above, I like learning by writing real tools so
why not try to recreate one of my daily drivers? It seemed like a nice mix of
things to learn including input handling, designing a TUI, and walking and
scanning files.

### Stack and Structure

- `ratatui` - TUI layout and rendering
- `crossterm` - input handling and terminal backend
- `walkdir` - recursive file scanning
- `id3v2` and `symphonia` - audio metadata
- `rodio` - audio playback

### Interface Design

### What's Working

### Reflections

Vibe programming
