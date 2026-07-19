---
title: "raft: A Graph Over the Plain-Text Log"
date: 2026-07-19
description: "I kept a plain-text log of my work for months, then hit the wall where grep stops scaling. So I built a knowledge graph that grows out of the notes and repos I already have. Then I found out Andrej Karpathy keeps the same log."
taxonomies:
  tags:
    - rust
    - tools
    - notes
    - oss
---

For a while now I've kept a plain-text log of what I work on. One markdown
file per day in `~/claude/notes`, written in past tense, no structure beyond
headings. What I did, why, what broke, what I left unfinished. It is the most
useful habit I have picked up in years, and it cost nothing to start: a
folder and the discipline to append to it.

The problem with a log is that it only grows. Mine is a bit over a year of
entries now - enough that the thing I kept wanting to ask it, grep could not
answer.

Not "where did I mention n8n" - grep does that fine. The questions grep can't
touch are the ones about *shape*:

- what did I leave unfinished, and how long ago?
- which projects keep showing up together even though I never wrote down that
  they're related?
- what did this idea eventually turn into?

Those are questions about the relationships *between* entries, and a flat log
has no relationships. It's a pile. So I built the thing that reads the pile
and finds the shape.

## raft

[raft](https://github.com/ducks/raft) is a personal knowledge graph that
grows out of what you already have - markdown notes, project repos, and git
history. It's a Rust CLI. You point it at some directories, it builds an
index, and you ask it questions.

The important design decision is that **the notes stay the source of truth.**
raft never writes to them. The index is a SQLite file it derives from the
files and can rebuild from scratch at any time; delete it and nothing is
lost. The plain text is canonical, the way Karpathy's log is canonical and
the way mine has always been. raft is a lens you hold up to it, not a place
your data goes to live.

It reads two kinds of source: trees of markdown notes, and directories of
project repos (where it pulls branch and recent-commit metadata from git).
Every organism in the graph - note, project, entity, open loop - carries
provenance: which file it came from, whether a relationship was something I
wrote explicitly or something raft inferred, and how much to trust it.

## The command that hooked me

`raft dangling` lists open loops - the unchecked boxes and follow-up bullets
scattered across the log - stalest first. The first time I ran it against my
real notes, it dredged this up:

```
 245d  Playback progress bar in footer
       2025-11-15  ...notes/2025/2025-11-15.md  (seen 2x)
 245d  Progress tracking per episode (resume where you left off)
       2025-11-15  ...notes/2025/2025-11-15.md
 245d  Seek forward/backward
       2025-11-15  ...notes/2025/2025-11-15.md
```

Those are shellcast TODOs I wrote down 245 days ago and completely forgot.
The log remembered them; I couldn't have. That is the whole pitch, right
there: a log you never re-read is a log that forgets. `dangling` is the log
re-reading itself and handing you back the threads you dropped.

## The one that surprised me

`raft connect` looks for pairs of projects and entities that keep
co-occurring in the notes over time, affinity-scored so hub words don't drown
everything, and shows me connections I never wrote down:

```
keep showing up together:
  0.89  replaybook <-> break.sh            [4 notes over 14 days]
  0.82  llm-mux    <-> claux               [7 notes over 90 days]
  0.68  date-ver   <-> burrow              [4 notes over 206 days]
```

llm-mux and claux traveling together over ninety days is real - they're both
LLM tooling and I clearly think about them as a pair without ever having said
so. `date-ver` and `burrow` co-occurring across 206 days is the kind of
long-arc connection I'd never reconstruct by hand. The graph can see the
shape of my own work better than I can describe it.

This one needed a fix, and it's a nice illustration of the provenance
principle. Early on, `connect` was flooded with junk pairs like
`birdhaus.art <-> index.html` - because raft was treating every backticked
code span in my notes as a possible entity, and those weak guesses scored the
same as real relationships. The rule I hold myself to is that an inferred
edge must carry its confidence and never masquerade as a fact. So weak
span-guesses get a low weight, and `connect` grew a `--min-weight` flag that
filters them out by default. Inference is allowed; pretending inference is
fact is not.

## Then I found the gist

I built all of this because the itch was real. Months of logging, a genuine
wall where grep stopped scaling, a tool to climb it.

Today - after raft was already built, released, and reindexing my notes on a
daily timer - I found [Andrej Karpathy's gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
where he describes keeping exactly the log I keep. One append-only file,
timestamped, never edited, grepped when needed. The same instinct, from
someone whose instincts are worth paying attention to.

I'll be honest: it felt good. Not because he validated raft - he doesn't
mention anything like it - but because he validated the *foundation*. The
plain-text log, the files-you-own-forever, the deliberate absence of an app
to rot. That's the soil raft grows in, and finding out one of the sharpest
people in the field plants in the same soil was a quiet, useful bit of
reassurance.

And here's the part that made me grin: he builds the log and stops there,
on purpose. The whole point of his approach is that there's no tooling to
maintain - just text and grep. raft is the thing he deliberately *doesn't*
build: the layer above the log, for when the pile gets big enough that you
want to see its shape and grep can't show you.

Same soil. raft is the plant.

## Using it

The real test of a tool like this was never whether the code is good. It's
whether I actually reach for it. So the last thing I did was the least
glamorous and the most important: `cargo install`ed it so `raft` is on my
PATH, and set up a systemd timer to reindex every morning so the answers are
never stale. A knowledge tool you have to remember to feed is a knowledge
tool you stop using.

Now it's just there. I type `raft dangling` when I've lost the thread, and
the log hands it back.

---

Source: [github.com/ducks/raft](https://github.com/ducks/raft)
