---
title: "gym-jams: Turn an Album Into a Workout"
date: 2026-08-25
description: "An album has a fixed length, a tempo map, and an energy arc. That's a workout plan wearing headphones. librosa provides the ears, a one-shot LLM does the planning."
taxonomies:
  tags:
    - ai
    - tools
    - oss
---

I had what I thought was a prerequisite question: are models any good at
sound recognition? I wanted an app that takes an album and generates a
workout plan mapped onto it, and I assumed the hard part was teaching a
model to hear music.

Wrong question. The app never needed model hearing at all.

## The Idea

An album has a fixed length, a track order, a tempo map, and an energy
arc. That's a workout plan wearing headphones. The design rule that makes
[gym-jams](https://github.com/ducks/gym-jams) work is simple: **the album
is the timer**. The session starts with track 1 and ends when the record
does. No mid-session decisions, no phone fiddling between sets. When the
record stops, you're done.

```
gym-jams init
gym-jams plan vol.1 "full body, kettlebells and a pullup bar, go hard"
```

## The Ears Are Twenty Years Old

Everything the planner needs from the audio comes from boring,
deterministic music information retrieval. librosa computes it locally in
about 20 seconds per album, cached after that:

```json
{
  "title": "02 Tohogd",
  "duration_sec": 245.0,
  "bpm": 172.3,
  "tempo_arc": [172.3, 172.3, 172.3, 117.5],
  "pulse_stability_cv": 0.032,
  "energy_arc": [0.47, 0.92, 0.97, 0.9],
  "onset_density": 3.04
}
```

Duration, tempo, loudness per quarter of the song (normalized so 1.0 is
the loudest quarter on the whole record), and how rhythmically busy the
track is. No neural network listened to anything.

The model's job is the other half: take that JSON plus one sentence of
intent and design the session. That's text reasoning over structured
data, which models are actually good at. The card comes back with blocks
like:

> **Tamebsz — 7:57 @ 123 — Peak effort block.** Q4 hits 1.0, the album's
> loudest point. Heavy KB complex: clean → press → front squat, max
> effort in the final quarter as energy climbs 0.71→1.0.

It read the record. The album's loudest two minutes got the max-effort
window. It noticed there's no taper anywhere on the record and said so.
For a run/walk request it matched cadence to BPM and ended the notes
with "start your watch with track 1."

## The Time Signature Problem

My test record was Angine de Poitrine's Vol.1, and Angine likes irregular
time signatures. Which raised the question: does any of this survive a
band that won't sit still in 4/4?

The first version didn't, quietly. `librosa.beat.beat_track` emits one
global BPM per track, and one number is a lie about music that changes
feel mid-song. The measurements made it concrete: Tohogd reads 172.3 BPM
globally, but its final quarter drops to half-time - and the generated
card was saying "hold effort through Q4" while the record disagreed.
Another track's "143.6 BPM" turned out to exist in exactly one quarter of
the song.

The fix wasn't meter detection - naming a 7/8 is a research problem and
workout-irrelevant anyway. What matters for training is tempo-over-time,
and that's measurable: a `tempo_arc` (median local tempo per quarter) and
a pulse stability score (variance of the beat intervals). Then two rules
in the prompt: when the tempo arc shifts, change the prescription at the
shift instead of averaging through it; when the pulse isn't steady, don't
give cadence advice at all.

The regenerated card got it right:

> **Tohogd** — Final quarter drops to half-time (117.5) — ease off to a
> recovery jog right at that shift, don't average through it.

Odd meters, incidentally, were never the problem. A steady 7/8 still has
a steady pulse to move to - the beat intervals barely vary. The thing
that actually breaks single-BPM analysis is a band changing *feel*
between sections, which is a different and more measurable sin.

## No Keys, Just a Pipe

The model backend is one config value with a stdin/stdout contract:

```toml
command = "claude -p --model {model}"
model = "sonnet"
music_dir = "~/Music"
```

Prompt in, card out. `claude -p` one-shots Claude Code and rides the auth
I already pay for - no API keys anywhere. But nothing is Claude-specific:
any command that reads stdin and prints stdout drops into the same slot,
and there's an OpenAI-compatible HTTP backend for anything serving an
endpoint. With `music_dir` set, albums resolve by name fragment - and
ambiguity lists candidates instead of guessing, which proved itself
immediately when "vol.1" matched both Angine and a Sturgill Simpson
record.

## The Model Said No

My favorite output so far wasn't a workout. I asked for "20 minute easy
recovery" against a record that, per its own energy arcs, contains about
14 and a half minutes of calm. The model picked the three tracks that
fit, reported 14:27, explained why the other tracks don't belong in a
recovery session, and offered two explicit trade-offs instead of padding
the plan to the requested number.

A tool that reads the actual data and declines to fake the answer you
asked for is rarer than it should be. I'll take it.

## What's Next

Song-structure segmentation, so cues land on actual drops instead of
quarter boundaries. A strict-album-order mode versus the adaptive track
selection it did for the recovery request. And eventually a live coach
mode that plays the record and calls the blocks.

For now it prints a card, the card goes to the gym, and the session ends
when the record does. Stretch only after the record stops.

---

Source: [github.com/ducks/gym-jams](https://github.com/ducks/gym-jams)
