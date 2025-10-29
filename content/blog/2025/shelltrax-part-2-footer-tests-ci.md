---
title: "Shelltrax Part 2: Footer, Tests, and CI"
date: 2025-10-29
description: "Fixing footer playback progress, implementing unit tests, and setting up GitHub Actions CI for the Rust TUI music player."
taxonomies:
  tags:
    - rust
    - tui
    - ci
---

In [Part 1](@/blog/2025/introducing-shelltrax.md), I built the core of shelltrax
- a TUI music player in Rust. It had library navigation, file browsing,
audio playback, and a footer with song info and status. One big problem though,
the footer would stop updating after the first song and I really wanted to fix
that.

This post covers three improvements: implementing a proper footer with
playback progress, adding unit tests for the tricky bits, and setting up CI
to keep code quality high.

## Running With A Limp

The footer existed from early on (progress bar, time display, track info), but
it had a critical bug: when autoplay advanced to the next track, the progress
bar wouldn't reset. It would either keep counting from where the previous song left
off, showing wrong times and eventually overflowing past 100% or it would just
reset back to 0 and not progress. Whatever it did, it didn't work.

The bug was in `play_next_track()`. It would set `playback_start` and
`current_track`, but it wouldn't reset `paused_duration` or `paused_at`. If
you paused the first song for 30 seconds, that 30 seconds would carry over to
every subsequent song, throwing off the footer display completely.

## Consolidation: begin_playback()

The solution was extracting the timer reset logic into a dedicated method:

```rust
pub fn begin_playback(&mut self, track: &LibraryTrack) {
    self.current_track = Some(track.clone());
    self.playback_start = Some(Instant::now());
    self.paused_duration = Duration::ZERO;
    self.paused_at = None;
    self.playback_duration = track.duration.unwrap_or(0);
}
```

Now `play_next_track()` calls `begin_playback()` instead of manually setting
fields. This ensures all timing state resets properly when advancing to the
next song, whether manually or via autoplay.

## Implementation: Tracking Time Correctly

The app needs to track multiple timing values:

```rust
pub struct App {
    pub playback_start: Option<Instant>,
    pub playback_duration: u64,
    pub paused_at: Option<Instant>,
    pub paused_duration: Duration,
    // ... other fields
}
```

When a song starts, we record `playback_start`. When the user pauses, we
record `paused_at`. When they unpause, we add the pause duration to
`paused_duration` and clear `paused_at`.

The footer calculation looks like this:

```rust
let elapsed = if let Some(paused_at) = app.paused_at {
    paused_at.duration_since(start)
} else {
    now.duration_since(start)
};

let adjusted = elapsed.saturating_sub(app.paused_duration);
```

If currently paused, elapsed time is frozen at the pause moment. Otherwise,
it's the time since playback started. Then we subtract all the accumulated
pause time to get the actual playback position.

The `saturating_sub` is important. Without it, if `paused_duration` somehow
exceeded `elapsed` (race condition, clock skew, whatever), you'd get an
underflow panic. `saturating_sub` clamps to zero instead.

## Layout: Three Lines of Footer

The footer uses a vertical layout with three lines:

```rust
let layout = Layout::default()
    .direction(Direction::Vertical)
    .constraints([
        Constraint::Length(1),  // Progress bar
        Constraint::Length(1),  // Time display
        Constraint::Length(1),  // Track info
    ])
    .split(inner);
```

Line 1 is a `Gauge` widget showing the ratio of elapsed to total time. Line 2
shows `MM:SS / MM:SS`. Line 3 shows `Artist - Title - Album`.

The progress bar ratio:

```rust
let ratio = if total.as_secs_f64() > 0.0 {
    adjusted.as_secs_f64() / total.as_secs_f64()
} else {
    0.0
};
```

Clamp it to `1.0` max so the gauge doesn't overflow if the elapsed time
somehow exceeds the track duration (can happen with malformed metadata).

## Testing: What Actually Needs Tests?

I'm not a fan of testing UI rendering code. It's tedious, fragile, and
doesn't catch the bugs that matter. What I do test is the state management
logic that the UI depends on.

For shelltrax, the critical logic is:
- Playback state transitions (playing, paused, stopped)
- Time tracking during pause/unpause cycles
- Library state management (artist/album hierarchy)

I added two test modules: one in `app.rs` for playback logic, one in
`library.rs` for library state.

### Testing Playback State

Four tests in `app.rs`:

**test_begin_playback_resets_timers:**
```rust
#[test]
fn test_begin_playback_resets_timers() {
    let mut app = App::new();

    app.playback_start = Some(Instant::now());
    app.paused_duration = Duration::from_secs(10);
    app.paused_at = Some(Instant::now());

    let track = create_test_track("test", 180);
    app.begin_playback(&track);

    assert!(app.playback_start.is_some());
    assert_eq!(app.paused_duration, Duration::ZERO);
    assert!(app.paused_at.is_none());
}
```

When starting a new track, all the timing state should reset. If it didn't,
the footer would show stale pause data from the previous song.

**test_toggle_pause_accumulates_paused_duration:**
```rust
#[test]
fn test_toggle_pause_accumulates_paused_duration() {
    let mut app = App::new();

    let start = Instant::now();
    app.paused_at = Some(start);
    app.paused_duration = Duration::from_secs(5);

    app.toggle_pause();  // Unpause

    std::thread::sleep(Duration::from_millis(100));

    app.toggle_pause();  // Pause again

    assert!(app.paused_at.is_none());
    assert!(app.paused_duration > Duration::from_secs(5));
}
```

This test verifies that pausing multiple times accumulates the total paused
duration. The `sleep` is gross but necessary to test time-based logic without
mocking the clock (which would require dependency injection, which is
overkill for a hobby project).

### Testing Library State

Six tests in `library.rs` covering the artist/album/track hierarchy:

**test_add_tracks_creates_structure:**
```rust
#[test]
fn test_add_tracks_creates_structure() {
    let mut lib = LibraryState::new();

    let tracks = vec![
        create_test_track("Artist A", "Album 1", "Track 1", 1),
        create_test_track("Artist A", "Album 1", "Track 2", 2),
        create_test_track("Artist B", "Album 2", "Track 3", 1),
    ];

    lib.add_tracks(tracks);

    assert_eq!(lib.artists.len(), 2);
    assert_eq!(lib.artists[0].name, "Artist A");
    assert_eq!(lib.artists[0].albums.len(), 1);
    assert_eq!(lib.artists[0].albums[0].tracks.len(), 2);
}
```

This validates the library builds the correct tree structure when adding
tracks. If the grouping logic broke, you'd end up with duplicate artists or
albums in the wrong places.

**test_visible_tracks_for_album:**
```rust
#[test]
fn test_visible_tracks_for_album() {
    let mut lib = LibraryState::new();

    lib.add_tracks(vec![
        create_test_track("Artist", "Album 1", "Track 1", 1),
        create_test_track("Artist", "Album 1", "Track 2", 2),
        create_test_track("Artist", "Album 2", "Track 3", 1),
    ]);

    lib.selection = Some(LibrarySelection::Album {
        artist_index: 0,
        album_index: 0,
    });
    let tracks = lib.visible_tracks();

    assert_eq!(tracks.len(), 2);
    assert_eq!(tracks[0].title, "Track 1");
    assert_eq!(tracks[1].title, "Track 2");
}
```

The `visible_tracks` method returns different results depending on whether
an artist or an album is selected. This test ensures album selection filters
correctly.

## CI: Keeping Code Quality High

GitHub Actions makes CI trivial for Rust projects. The workflow file:

```yaml
name: test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: install rust
      uses: dtolnay/rust-toolchain@stable
      with:
        components: clippy

    - name: cache dependencies
      uses: actions/cache@v4
      with:
        path: |
          ~/.cargo/bin/
          ~/.cargo/registry/index/
          ~/.cargo/registry/cache/
          ~/.cargo/git/db/
          target/
        key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

    - name: install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y libasound2-dev

    - name: run tests
      run: cargo test --verbose

    - name: run clippy
      run: cargo clippy -- -D warnings
```

The important bits:

**Dependency caching:** Without caching, every CI run would download and
compile all dependencies from scratch. With caching, subsequent runs reuse
compiled dependencies, dropping build time from several minutes to under 30
seconds.

**System dependencies:** The audio libraries (cpal, rodio) need ALSA headers
to compile. `libasound2-dev` provides those on Ubuntu.

**Clippy with `-D warnings`:** This flag treats all warnings as errors. It's
strict, but it keeps code quality high. If clippy suggests a fix, you either
apply it or add an explicit `#[allow(...)]` annotation explaining why you're
ignoring it.

## Results

The footer works. Tests pass. CI keeps the codebase clean. Shelltrax now
feels like a real music player instead of a tech demo.

Running `cargo test` shows 10 passing tests:

```
running 10 tests
test app::tests::test_begin_playback_resets_timers ... ok
test app::tests::test_toggle_pause_accumulates_paused_duration ... ok
test app::tests::test_toggle_pause_cycles_state ... ok
test app::tests::test_toggle_pause_sets_paused_at ... ok
test library::tests::test_add_tracks_creates_structure ... ok
test library::tests::test_toggle_expanded ... ok
test library::tests::test_track_by_path_finds_track ... ok
test library::tests::test_track_by_path_returns_none_for_missing ... ok
test library::tests::test_visible_tracks_for_album ... ok
test library::tests::test_visible_tracks_for_artist ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured
```

And `cargo clippy` stays green with zero warnings.

## What's Next?

The core functionality is solid, but there are still features I want:
- config system
- seeking
- better metadata handling
- vi keybindings

But for now, shelltrax does what I needed it to do: play music in the
terminal with a proper UI that shows what's happening.

**Code**: [github.com/ducks/shelltrax](https://github.com/ducks/shelltrax)
