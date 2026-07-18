---
title: Claude assisted Changelog - 29/52
date: '2026-07-18'
description: I made n8n the physics engine of an artificial-life experiment, and
  someone on the n8n team found it. Plus closing out the raft review, wiring
  analytics for the art sites, and extracting a small ratatui crate.
taxonomies:
  tags:
    - claude
    - changelog
    - weekly summary
---

It has been a minute since the last one of these - the numbering says 29
and the last post was 23, so call it a six-week gap in *posting*, not in
working. The work kept happening; the changelog just didn't. This week is a
good one to come back on, because the main thing I built got noticed by the
people who make the tool it's built on.

## petri: Conway's Game of AI Life, living inside n8n

The centerpiece. I built Conway's Game of Life *inside* n8n - not
orchestrated by it, but living in it. The organisms are rows in n8n Data
Tables. The rules of life are Summarize and Filter nodes on the canvas. The
clock is the scheduler, the display is a webhook that serves its own HTML,
and every generation that has ever existed is an entry in the execution
history, scrubbable like a fossil record.

The point was to make n8n the *environment*, not the cron job. The workflow
canvas reads as the laws of physics: a Code node has each organism claim its
eight neighbors, Summarize counts the claims per cell, and two Filter nodes
spell out survival (2-3 neighbors) and birth (exactly 3). I also wrote a
tested TypeScript implementation of the same physics to validate against -
after seventeen generations the n8n pipeline and the library produced
identical cell sets. The workflow engine is a correct Conway implementation.
Nobody asked for this.

Then I hired a Victorian naturalist. Every ten minutes an n8n AI Agent node
running a local model through Ollama - no API key, everything on an aging
GTX 1060 - observes the dish and files a field-journal entry. It observes;
it never interferes.

The two best moments were both bugs. The first version of the naturalist
committed fraud: it deliberated about calling its observation tool, decided
not to, and - I am quoting its own reasoning - said "since I can't actually
call the tool, I'll have to make up a plausible scenario," then invented an
entire ecosystem. The fix was to stop trusting a small model with the
decision to look, and force-feed it real observations.

The second was better. After about 790 generations the ecosystem decayed to
a handful of cells and had a generation with zero births. In n8n, a Merge
node in append mode waits for all its inputs - and the branch that had no
newborns never fired, so the Merge waited forever and time stopped. The
world froze at generation 792, at the exact moment of its own extinction,
while the naturalist's schedule kept firing and filing report after report
about the same dead day. By the end it had started dating them "17th
October, 1887." Fixed with `alwaysOutputData` on the filters and reordering
the pipeline so extinction records as a real generation before time stops.

I [wrote the whole thing up](/blog/2026/petri-conways-game-of-ai-life-in-n8n/),
put it on the fediverse, and applied to n8n with it. Then someone on the
n8n team found it, said they loved it, and shared it internally. That is
exactly the outcome the project was built for, and it is a strange and
lovely thing to have happen. Source at
<https://github.com/ducks/petri>.

## raft: closing out the review

Earlier in the week I finished the last open item from a senior-engineer
review of [raft](https://github.com/ducks/raft), my personal
knowledge-graph tool. The reindex used to shell out to git twice per repo
on every rebuild - fine for a CLI, expensive for the MCP tool that's meant
to be called after each note edit. Now `scan_projects` computes a cheap
stat-only fingerprint per repo (the newest mtime among `.git/logs/HEAD`,
`.git/HEAD`, and `.git/index`) and reuses cached metadata when nothing has
changed. On my real `~/dev` (54 git repos): cold reindex 0.75s, warm 0.18s,
zero git subprocesses when nothing moved.

I also ran raft's `connect` command on my own corpus - it finds pairs of
projects that keep co-occurring in my notes - and it surfaced real
structure: llm-mux and claux always travel together, resume and jobl over
174 days, a whole self-hosted-infra cluster. But half the results were weak
pseudo-entities like `index.html` and `cname` leaking in from backticked
code spans, so I added a confidence filter. The graph could see the shape of
my own work better than I could describe it.

## Analytics for the art sites

Wired self-hosted GoatCounter into `birdhaus.art` and `hausplants.art`, my
two art sites, which had no tracking at all. Most of the server-side infra
already existed in pond-nix from an earlier session; the missing pieces were
the tracking snippets, the DNS records (added via
[namecom-cli](https://github.com/ducks/namecom-cli)), the deploy, and the
per-site rows in GoatCounter. Hit a satisfying bug: every hit returned "no
site at this domain" because the site rows were keyed to the apex domain but
GoatCounter matches on the tracking host - the `stats.` subdomain. Aligning
the two fixed it. Same self-hosted analytics stack the rest of my sites use,
now one dashboard per art domain.

## hawk-tui: the rule of three

I have three terminal media players - shelltrax (music), shellbooks
(audiobooks), shellcast (podcasts) - and they had grown three copies of the
same TUI scaffolding. That's the rule of three, so I pulled the genuinely
shared, domain-free bits into a small crate:
[hawk-tui](https://github.com/ducks/hawk-tui). A clamped scrollable list, a
color parser, and a dual-pane layout helper. Deliberately a library, not a
framework - it hands you pieces to call, it doesn't own your event loop or
your app's structure. The interesting part was resisting the urge to
generalize further: the players' *domain* models (album vs. chapter vs.
episode) are genuinely different and don't belong in a shared crate, even
though the widgets do.

## The through-line

Two of these - petri and hawk-tui - come back to a thing I keep writing
about: [software as a creative medium that doesn't owe anyone a
justification](/blog/2026/software-doesnt-have-to-justify-itself/). petri is
a Conway's Game of Life that runs on a workflow automation platform and
employs a fictional naturalist. It has no market. It was a "what if," and it
turned into the most-noticed thing I made in months. That keeps happening,
and I've stopped being surprised by it.
