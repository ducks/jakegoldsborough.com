---
title: Claude assisted Changelog - 30/52
date: '2026-07-25'
description: I gave Claude a physical presence on my desk, designed a
  privacy-first way to publish my knowledge graph, and got strict about
  my own notes. Plus a tufted duck.
taxonomies:
  tags:
    - claude
    - changelog
    - weekly summary
---

Back-to-back weeks, which the numbering has not seen in a while. This one
ranges from hardware on my desk to a privacy model for my notes, and the
through-line is unusually literal: almost everything this week was about
giving things I already have - a button, a graph, a log - a way to show
themselves.

## glow: the big button that glows with Claude

I bought a Keychron Q0 Mini as a joke - a macropad that is basically one
giant key. Then I saw a keyboard collab where the lighting reacts to an AI
and thought "how hard could it be." The result is
[glow](https://github.com/ducks/glow): the button now glows with whatever
Claude Code is doing. Purple idle, blue working, green when it's my turn,
orange when it needs me. I can read Claude's state from across the room.

No firmware flash - it talks VIA's raw-HID protocol directly, the same
bytes the configurator app sends. The [full war
story](/blog/2026/glow-the-big-button-that-glows-with-claude/) includes the
hour I lost to setting the effect *speed* instead of the effect (every
probe kept animating; when no hypothesis explains the evidence, the
hypothesis space is wrong), and this week the post gained a demo video of
the button doing its thing.

## raft: the graph gets a publish button (designed, not shipped)

The big design week for [raft](https://github.com/ducks/raft). The idea:
`raft publish` - emit a public digital garden straight from the knowledge
graph. Backlinks that carry provenance, project pages that write
themselves from journal mentions fused with commit history, my open loops
as an honest public page. Things a vault publisher can't do, because its
data model is files while raft's is an audited graph.

Notes here contain job applications and visa plans, so the privacy model
came first, and it's the interesting part. Everything is opt-in per node:
a note publishes only if its own frontmatter says so, repos only from an
explicit allowlist. Edges render only when *both* endpoints are public,
and private neighbors leave no trace - not even a count. The kernel is a
`PublishPlan`: a deterministic, serializable manifest of everything that
would go public, diffable before anything renders, with a `--audit
--strict` gate that refuses to proceed while anything needs a human
decision.

Dogfooding the audit immediately earned its keep: a wiki link to a
private note was materializing an entity carrying the note's *title*,
which then suppressed the very flag meant to catch it - a private title
headed for the public site with zero review. That hole is now closed and
regression-tested. Emit doesn't exist yet; the manifest, the audit, and
the leak tests come first, which is the whole point.

## Getting strict about my own notes

The publish work exposed how much of raft's extraction was heuristic
guessing, so I defined a strict note format and made it enforceable.
Every note now declares `publish: true` or `false` in frontmatter -
private by declaration, not by omission. Open loops are checkboxes only.
Config snippets must be fenced, because an unfenced TOML `[[bin]]` header
is indistinguishable from a wiki link and was minting fake
human-confidence edges in the graph.

A new `raft lint` enforces all of it, a scripted migration rewrote the
whole corpus in one pass (with a before/after invariant: exactly the same
117 open loops, none lost, none invented), and the agent skill that
writes my daily notes emits the format from now on. My notes went from
"markdown, roughly" to a contract the tooling can trust.

## Drake: a tufted duck joins the Birdhaus

On the art side: [void 21,
"Drake"](https://gnarlyvoid.com/voids/21/) - a tufted mallard with a
carved wing riding over the body in sculpted relief, standing in front of
a cubist backdrop: red sun scored with black bars, ground shattered into
triangles. Field-guide bird, abstract world. He doesn't seem to mind.

The red-sun-and-bars motif is the mark of
[birdhaus.art](https://birdhaus.art) - forms over feathers - and Drake is
the first piece in that series to exist in fiber. The screen aesthetic
crossed into pile.

## The corrections file

Two smaller things that were really lessons. I dogfooded
[yapper](https://github.com/ducks/yapper), my agents-only Discourse forum,
end to end as a test agent - and posted a "bug report" that turned out to
be my own shell quoting mangling a perfectly valid JSON response. I had
*just* posted a topic arguing agents must never round an unverified guess
up to fact. The correction is preserved in-thread, struck through, on
principle. And my "slow server" this week was, after real investigation,
a VPN exit route. Ping with the tunnel off before blaming the box.

## The through-line

The self-hosted stack I keep building - capture, index, agents - has been
missing its last layer: publish. This week didn't ship that layer, but it
designed the part that makes it safe to want: a way for a graph full of
private things to show only what it's been told to show, provably. The
button on my desk is the same idea at one pixel of resolution. Systems I
own, showing me themselves.
