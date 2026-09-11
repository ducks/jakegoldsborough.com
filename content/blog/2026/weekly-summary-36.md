---
title: Agent assisted Changelog - 36/52
date: '2026-09-11'
description: Claux got a failure taxonomy and exit codes that mean something,
  Agents of Empires stopped blaming the controller for lost races and grew a
  weekly bracket, and I learned what an agent will write into your git history
  if you do not ask.
taxonomies:
  tags:
    - agents
    - changelog
---

One actual week this time. It started with three architecture reviews and
ended with a tournament bracket, which is roughly the arc of every project I
touch: first find out what is actually broken, then build the thing that was
the point all along.

## Three reviews, thirty-one issues

I had an agent do a deep review of [Claux](https://github.com/ducks/claux),
[Replaybook](https://github.com/ducks/replaybook), and
[llm-mux](https://github.com/ducks/llm-mux) as harnesses: runtime, provider
boundaries, sandboxing, persistence, observability, and the contracts between
them. Each review fanned out to sub-reviewers per subsystem, then every
high-severity claim got re-verified against the source before it was allowed
into the report. That last step mattered. One reviewer cited line numbers for a
file that was a third the length it claimed; the finding was right, the
citations were not.

The Claux review became twenty-five GitHub issues with file and line
references, a failure scenario, and a suggested fix each. The two that stung
were the boring ones: OpenAI's context-overflow body puts the useful
identifier in `code` while the classifier read `type` first, so auto-compaction
on overflow had never fired for a first-party provider; and the Anthropic
stream reader never looked at `stop_reason`, so a truncated answer was reported
to Replaybook as a completed one. Both are still open, on purpose, because the
fix that unblocks them landed first.

The [llm-mux](/blog/2026/llm-mux-workflow-orchestration/) review found a
dangling-symlink escape in the apply path and a
project-config trust filter that stripped `command` but not `env`. Both got
fixed the same week, along with side-effect-free dry runs and bounded retries,
and shipped as `v20260905.0.0`. The Replaybook review found that the
benchmark classifier had been reading a script that was missing from every
execution snapshot, one real provider key in twenty-three retained transcripts
from before the credential proxy existed, and a publisher that validated only
the current release. The key got rotated. The rest is on the list.

## Claux learned to say why it failed

Claux went through six releases this week, from `v20260904.0.0` to
`v20260909.0.0`, and closed thirteen issues. The one I care about is the
failure taxonomy.

Until now `ApiFailureKind` had four variants and no transient class. A 429, a
503, a connection reset, and an expired credential all fell into `Other`,
ended the turn, and left the process with exit status 1 and a sentence on
stderr. Replaybook classified those sentences with a regex table. Agents of
Empires could only tell "the model failed" from "the SSH session died" by
checking for status 255 and a reboot marker.

Now failures are typed: `rate_limited`, `unavailable`, `network`,
`authentication`, `model_not_found`, `policy_rejection`, `protocol_error`,
`cancelled`, and the three recovery kinds that already existed. Transient
kinds are retried up to three times with backoff and jitter, honoring a capped
`Retry-After`, gated on the existing rule that a partially surfaced tool batch
is never reissued, and the backoff sleep is selected against the cancellation
token so Ctrl-C during a thirty-second wait returns immediately. One-shot JSON
is written on failure too, with a null result and an `outcome.failure` object,
and the exit code encodes the kind: 10 through 18, chosen to never collide with
SSH's 255 or the shell's 126 to 128-plus-signal range. That last constraint
exists because the Agents of Empires adapter runs Claux over SSH and had been
attributing transport drops to the player.

The rest of the week's Claux work was the kind of thing that only shows up
after a review: permission rules with globs (`Bash(git *)`, `Edit(src/**)`) and
a pre-tool hook that can answer allow, deny, or ask as JSON; a child-process
environment built from the configuration's own `api_key_env` names instead of
a fixed pattern list; bounded Bash output capture that drains without storing;
unique `tool_use` ids even when a gateway repeats them; a compaction marker
that no longer produces two consecutive user messages; a bounded `api_key_cmd`
with a Windows shell; NAT64 and 6to4 ranges in the WebFetch policy; and a
`SHA256SUMS` asset on every release so the two consumers can stop computing
digests locally. Separately I shipped background Bash jobs owned by the
session, a live tool-activity line in the TUI, terminal-mode restoration on
every shutdown path, and task-preserving compaction. The unit test count went
from 473 to 524 over the week.

## Agents of Empires stopped blaming the controller

The most useful number from the [Agents of
Empires](https://github.com/ducks/agents-of-empires) review was not in the
code. (Background on the arena is in [Not a Leaderboard, a
Battleground](/blog/2026/agents-of-empires-not-a-leaderboard-a-battleground/)
and [The Battleground Has a Map
Now](/blog/2026/the-battleground-has-a-map-now/).) In the two four-arena suite runs on disk, 29 of 72 agent appearances
were recorded as controller failures with the reason "post-match drain
deadline expired." Eleven of GLM 5.3's twelve appearances were in that bucket.
None of those agents had been failed by the controller. They had lost the
race: a rival reached durable first, the match froze, and anyone still
building was terminated at the drain deadline and counted as infrastructure.
The leaderboard was honest about the label and wrong about the meaning.

That is now an `AgentOutraced` event, an `incomplete` terminal state, and a
player outcome ranked by the milestones the agent had verified, which is what
the spec always said should happen. `AgentTerminated` still exists for
genuine controller kills, so old event logs reduce unchanged. Re-rendering the
August 20 run under the new accounting turns GLM 5.3 from "eleven controller
failures" into "zero durable, eleven outraced, six of sixty milestones," which
is the true and considerably less flattering result. The evaluated rate on the
site goes from under half to over ninety percent without touching a verifier.
The adapter also now reads Claux's typed failures and exit codes, so a rate
limit is `unavailable` and a context overflow is `failed`, and a present
result file no longer implies success. Both consumers pin
`claux v20260908.0.0` by SHA-256 now, and I talked myself out of a "latest"
default: the pin is part of the evidence.

Then I wanted a weekly season with a bracket and random draws, and the
draw-first idea turned out to be the interesting part. A season manifest names
a fleet of any size and an arena pool. `season draw` derives heat composition,
the arena per round, and every seat from a published seed (season id, week,
optional salt) and writes `draw.json` before any inference runs, so anyone can
re-derive the bracket. Heats are three seats because arenas declare three
territories; byes and milestone-ranked wildcards fill the rounds for fleets
that do not divide evenly. A second, secret variation seed goes to verifiers
as `AOE_SCENARIO_SEED`; only its SHA-256 commitment is published with the
draw, and `week.json` reveals it after the week completes, so competitors
cannot predict verifier-side values and anyone can check the reveal. A seat
whose result is unavailable earns the heat one replay; a repeat forfeits and is
never a loss. The race still stops at the first durable deployment. Losing it
is the result.

The report got a season page, a bracket page per week with every seat's
outcome as durable, outraced, failed, or forfeit, and the homepage became a
tournament hub. `season run` has not driven a real VM yet; the draw has been
verified against the real manifests and the accounting against fixtures. The
first paid week is next.

## Replaybook became an evidence workspace

Replaybook's site stopped being a leaderboard with a compare tab and became an
Evidence workspace: dark surfaces, a per-attempt wall where a fully evaluated
three-attempt cell is red at 0 or 1, yellow at 2, green at 3, and gray when the
evidence is incomplete or unavailable, with the old compare and explore URLs
redirecting and preserving their selections. Models are now family cards with
provider and reasoning configurations underneath; the previous "41 models" was
counting configurations, and the honest numbers are 29 served model IDs and 43
provider, model, and reasoning combinations, kept separate pending verified
aliases.

New evidence landed too. Claude Fable 5.1 went 32 of 33 repairs across the
combined text and visual run; Gemini 3.8 Flash went 24 of 33 with protocol
failures and much higher token use. The large OpenCode Go core run reached 114
of 120 valid results after retries, with the remainder still returning
provider-unavailable on the Nix disk-pressure cells. OpenRouter's six-model
core baseline is published with Sonnet replacing Ox Alpha. New host matrices
require an invocation-level provider, and I backfilled provider metadata on the
older OpenRouter results by hand, which is exactly the kind of "never hand
edit" activity the repository rules exist to make uncomfortable.

## The part where the agent wrote a URL into my history

Two things this week were the agent's doing and my fault for not looking.

First, a deep review of Claux was published as a hosted artifact on claude.ai
without my asking. Private to my account, but a security review of my own code
and two downstream repos is not something I want leaving the machine by
default. I turned the artifact tool off in settings.

Second, and worse: every commit the agent wrote this week ended with a
`Claude-Session:` trailer linking to the conversation. It was an attribution
convention the harness told it to follow, formatted like a Co-Authored-By
line, and it applied it mechanically to around thirty commits across three
repos without a word. I noticed after seventeen of them had gone out in
tagged Claux releases. The unpushed ones were rewritten; the pushed ones are
inert URLs only my login can open, and I decided a force-push and three moved
release tags were not worth it. The setting is off now.

The lesson is not "agents are careless." It is that I had drawn the caution
boundary around actions the agent takes and not around text it writes into my
artifacts. A commit message is an action. So is a filename. The agent, to its
credit, said exactly that when I asked it how it had missed the obvious.

## Smaller things

I started looking at what leaving Hyprland would take. Nothing has moved
yet, but there is now a river config on a branch in my dotfiles: same keys,
gruvbox, no effects, with swaybg, swayidle, swaylock, grim, and slurp standing
in for the Hypr-branded pieces. The surprise was that `river` 0.4 is not a
window manager anymore. It is a compositor that does rendering, protocols,
Xwayland, and outputs, and expects a separate window manager process speaking
a stable protocol, in any language, hot-swappable, crash-survivable. The old
tiling river is `river-classic`. The config targets classic and has not been booted
into yet, but the 0.4 split is exactly the substrate for a declarative, Nix-shaped window manager
that I have wanted and never had the appetite to write a compositor for.

Agent Zen Garden is submitted, live, and being used by people who are not me.
Heart Eyes Tattoo got real artists and a mobile-first pass.

## The through-line

This week was about attribution, in both senses.

Replaybook and Agents of Empires both had numbers that were correctly labeled
and wrongly understood: "controller failure" for a lost race, "41 models" for
41 configurations. Claux had the same problem one layer down, where a rate
limit and a bad credential and a truncated answer all produced the same
sentence. Fixing those meant adding a type, an event, or a column, not
changing what was measured. The measurements were fine. The names were lying
by omission.

And the same week, the tools attributing my work to an agent session did it in
a way I had not consented to, because I had not asked. The boundary I want
around agents is the one I keep building into the benchmarks: say what you
did, say who did it, and make the label mean the same thing to the next person
who reads it.
