---
title: Agent assisted Changelog - 37/52
date: '2026-09-19'
description: Agents of Empires became a cup circuit, a three-way harness final
  exposed another accounting boundary, and Timecapsule got a discovery inbox
  for an archive that does not confuse finding something with owning it.
taxonomies:
  tags:
    - agents
    - changelog
---

In [the last summary](/blog/2026/weekly-summary-36/), the first paid Agents of
Empires tournament was still next. There are now cups, champions, a domain,
replays, and enough conversations about tournament formats that I briefly
considered duplicating the entrants just to fill a bracket. The software is
getting better. My ability to leave the scope alone remains unproven.

## The battleground became a cup circuit

[Agents of Empires](https://github.com/ducks/agents-of-empires) is now live at
[agents-of-empires.dev](https://agents-of-empires.dev/). The homepage explains
the idea and points to cups; each cup has its own description and tournament
history; each tournament has a bracket and links to the actual attempts. The
replay defaults to 5x, because watching someone else's infrastructure wait to
boot should at least be faster than watching your own.

The usual format is six entrants, two three-agent opening heats, and a final
with the two winners plus a wildcard. Publishing a draw and running it are
separate operations. That means I can announce the field before spending
anything, then run exactly that bracket later.

The first clean [OpenCode Cup](https://agents-of-empires.dev/seasons/opencode-cup/2026-W37-20260913-021918/)
had DeepSeek win its opening build race in 43.2 seconds and the durable job
queue final in 89.8. All three heats finished on their first attempt. No
forfeits, no replays. Getting there was less tidy.

Earlier tests produced enough failures that I could not tell whether I was
watching poor play or a broken adapter. The fixes included explicit guest
model definitions instead of hoping OpenCode refreshed its catalog, making
the configured memory floor reach the actual VMs, and keeping the rollout
continuity monitor alive for the match's configured duration.

There was also a tournament that crowned a contender after everybody failed.
That is a perfectly reasonable way to invent a sport I did not mean to invent.
Heat winners now need a durable deployment. Sporting draws and unavailable
seats have separate, bounded replay budgets, and an exhausted bracket can end
without a champion. Tied wildcard ranks use a seeded lottery, not alphabetical
order or the cheapest bill.

Kimi took the first published
[Vercel Cup](https://agents-of-empires.dev/seasons/vercel-cup/2026-W37-20260913-173203/).
Different routes, different fields, different stories. Still not a model
ranking. [Replaybook](https://github.com/ducks/replaybook) is where I do the
evaluation work; this is where I want to pick a contender and watch a race.

## One pool, frozen draws

Adding cups made the model lists annoying almost immediately. OpenRouter,
OpenCode Go, and Vercel AI Gateway each expose a different slice of the world,
and maintaining those lists independently was an invitation to drift.

AoE now has one shared model registry. Each cup selects its provider slice,
and `season draw --entrants 6` samples a field without requiring the whole
eligible pool to enter. The selected entrants and eligible pool are frozen
into the draw. Refreshing a catalog tomorrow must not change the tournament
I announced today.

The refresh script defaults to a dry run. New discoveries stay disabled until
reviewed, and refreshes preserve deliberate access blocks and premium-model
opt-ins. Finding a model in a catalog is not proof that my account can run it,
or that I want to pay for it.

I also floated a budget cup that draws from whatever is on sale. That remains
an idea, not another thing quietly running up a bill in the background.

## Same model, different harnesses

The new adapter is for [term-llm](https://github.com/SamSaffron/term-llm).
The first [Harness Cup](https://agents-of-empires.dev/seasons/harness-cup/)
put it against [Claux](https://github.com/ducks/claux) and OpenCode, all
configured for OpenRouter GPT-5.6 Luna, high reasoning, one vCPU, and 768 MiB
of memory per guest.

term-llm won in 45.216 seconds. The outside referee verified the service,
record round-trip, service restart, and host reboot. OpenCode was outraced.
Claux's guest rebooted and the SSH connection dropped, but the retained
evidence does not establish who initiated that reboot. There was no referee
reboot marker for its seat and no recorded reboot command in its tool trace.
That stays an unresolved harness error, not a story about a model deciding to
restart its machine.

The accounting needed attention too. Missing provider costs had looked like
zero dollars, and token totals did not consistently include cache categories.
Future adapter output now normalizes fresh input, cache reads, and cache
writes; reporting distinguishes a known total from an incomplete subtotal.
The original event logs remain unchanged. Usage captured while losing agents
drain after the finish is also not a synchronized race-only measurement.

We recorded this as an exhibition, then published it as a single-round cup.
Three entrants and one final are enough. I considered two opening heats with
duplicate entries from each harness, then decided to wait for more distinct
harnesses. A bracket should describe the competition, not manufacture a need
for more seats.

## Timecapsule starts with an inbox

The other thread was an archive of Angine de Poitrine material. I wanted to
find scattered recordings and links without turning every discovery into a
published claim about a performance, its date, or its rights.

Timecapsule is a local prototype for that flow. Internet Archive discovery
produces private metadata snapshots in an inbox. I review a candidate,
approve it into a Markdown record with source and rights notes, then build a
static archive. Repeating discovery does not reset review decisions. An
upload date does not silently become a concert date. Approval does not deploy
a website or download the recording.

The optional TypeSafe/Jev integration sits between discovery and review. It
can suggest relevance and material type from metadata, and I can preview the
exact request before making a paid call. It does not watch the video, approve
the entry, or decide that I have permission to republish it. I have not run a
paid enrichment call yet.

The first implementation has sixteen tests covering the unglamorous parts:
deduplication, retained decisions, approval recovery, validation, escaping,
private/public separation, and byte-identical offline builds. YouTube
discovery and a visual review inbox are not wired in yet. There is no public
repository link for this one yet either; it is still local work.

## The through-line

This week kept coming back to what a result actually authorizes me to say.

A model being listed does not mean an account can use it. A null charge does
not mean the race was free. An SSH disconnect does not identify who rebooted
the machine. Finding a recording does not establish its date or give me
permission to copy it.

The useful work is in keeping those distinctions visible without making the
whole thing miserable to use. I still want the bracket to be fun and the
archive to be inviting. I just want the next person clicking through to find
the evidence, not a more confident version of my guess.
