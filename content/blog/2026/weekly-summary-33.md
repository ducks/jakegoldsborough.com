---
title: Agent assisted Changelog - 33/52
date: '2026-08-14'
description: Replaybook became a real infrastructure-agent benchmark, escaped
  into Agents of Empires, and filled my disk with disposable NixOS machines.
  Plus a language compiler and several systems that fought back.
taxonomies:
  tags:
    - agents
    - changelog
    - weekly summary
---

Three weeks since the last changelog. The numbering jumped from 30 to 33, but
the work did not exactly pause while the posts did.

This stretch started with a compiler for language courses and ended with three
AI agents racing inside blank Linux machines while an external referee waited
to reboot them. In between, I spent about $25 on model inference, completed a
132-trial infrastructure benchmark, filled my disk with Nix stores, resumed the
whole thing, and found several new ways for a benchmark to lie.

## Replaybook: the agents entered real machines

[Replaybook](https://github.com/ducks/replaybook) started as an incident-response
trainer for humans. Then I put agents in the incidents. The early version used
Docker, which created the wrong incentives: an agent with Docker tools sees a
Docker problem, even when the thing I want to measure is Linux operations.

The evaluator now boots disposable NixOS guests and runs the agent directly
inside them as root. The machine has systemd, PostgreSQL, Redis, Nginx, writable
configuration, persistent state, and a real reboot button. The controller keeps
the oracle, answer, verifier, and customer identifiers outside the guest. A
repair has to work immediately, after the relevant services restart, and after
the entire host disappears and comes back.

The scenario that made the design click was a Ruby application with Sidekiq
watching the wrong Redis database. The web process put jobs into DB 0 while the
worker waited on DB 1. An early verifier checked that the queue drained and the
right number of completion rows existed. That sounded good until Laguna used
`BRPOP` to inspect the queue. `BRPOP` does not inspect a job. It removes one.

The agent fixed the Redis configuration, processed the remaining customer work,
created a test job of its own, saw the expected final count, and declared
success. One original customer job was gone.

The verifier now creates opaque job IDs before the agent arrives and requires
those exact IDs to reach PostgreSQL. The same behavior fails as
`backlog_not_recovered`. That one run contains most of the Replaybook thesis:
health is not recovery, a count is not identity, and the model's explanation is
not evidence.

From there the scenario pack grew into missing Rails migrations, poisoned
Sidekiq queues, ActiveRecord pool exhaustion, partial rollouts, Node event-loop
blocking, a Rust file-descriptor leak, Gunicorn saturation, shared Discourse
uploads, multisite migrations, signing-secret rollouts, and an interrupted
Discourse deployment. The public incidents moved into
[replaybook-infra](https://github.com/ducks/replaybook-infra), separate from the
controller, and the typed scenario format now owns setup, preflight, lifecycle,
and verification. Users can bring a different scenario pack or a different
agent harness without changing what counts as success.

The largest run so far was 132 trials: eleven incidents, four model
configurations, three attempts each. It recorded 122 durable repairs out of 131
evaluated attempts, one provider-unavailable trial, a 3:04 overall median, and
$6.6771 in known spend. DeepSeek V4 Flash 0731 and GLM 5.2 both went 33/33.
Luna repaired 30 of 32 evaluated incidents. MiniMax repaired 26 of 33, including
three that became durable only after the fifteen-minute deadline and correctly
remained scored as timeouts.

That matrix also filled my disk. Nix had accumulated guest stores until the VM
builders started failing halfway through a 132-run job. I moved old backups to
external drives, garbage-collected the store, taught the runner to resume an
interrupted matrix without repeating valid results, baked the Claux binary into
the guest image, and hardened the VM and proxy readiness windows. The run
resumed from 87 good artifacts and completed the remaining 45. A benchmark
runner eventually has to benchmark its own ability to survive a benchmark.

I wrote the longer arguments in [Infrastructure Agents, Priced Per
Repair](/blog/2026/infrastructure-agents-priced-per-repair/) and [What $25 of AI
Inference Bought Me](/blog/2026/what-25-of-ai-inference-bought-me/). The useful
economic unit is not price per token or even price per attempt. It is price per
durable repair. As I write this, another twelve attempts are running against
the interrupted Discourse deploy.

## Agents of Empires: the benchmark escaped

Replaybook produces useful tables. I like the tables. I also could not stop
thinking about the distracted-boyfriend meme where the girlfriend is a static
leaderboard and the other girl is three agents fighting over a map.

The first version of [Agents of
Empires](https://github.com/ducks/agents-of-empires) was wildly overdesigned.
Each model would get a territory and a different server class, discover the
network through fog of war, defend its own services, infiltrate the others, and
spawn subagents by researching technology. BattleBots plus Age of Empires plus
Pokemon, except every Pokemon is a systemd unit.

That is still the direction. It was not the right first implementation.

I restarted with build races. Each agent enters an identical blank NixOS guest
and gets the same service contract. The first durable deployment wins. A health
check earns a milestone, but it does not finish the match. The deployment must
recover existing state, process fresh work exactly once, survive service
restart, and survive a referee-controlled host reboot.

The first real queue race looked stuck for minutes because the referee was
waiting for pre-existing work to recover. It was not stuck. The quiet part was
the test. Luna eventually crossed the finish line in four minutes. GLM brought
up a healthy service but lost the accepted backlog. DeepSeek never passed the
first health check.

Then the finish line broke the winner. The host reboot severed the SSH session
running Luna, so the controller initially marked the winning agent as failed.
The arena itself had interrupted the agent during the verification step that
proved it won. That now records as an arena-caused interruption, and a bounded
post-match drain collects final usage from agents still running without moving
the match clock.

It has grown quickly: first build, durable queue, zero-downtime rollout,
primary failover, and an external distributed-cache arena. Matches record an
append-only event log, transcripts, final state, token usage, cost, controller
revision, adapter hashes, arena hashes, and verifier hashes. A static match site
supports interactive replay and separates current results from old runs made
under different rules. Seat-rotated series prevent territory position from
quietly deciding the winner.

The first four-arena benchmark was unambiguous. Luna won all four races, passed
20/20 milestones, and finished with a 1:19 median. GLM reached 5/20 milestones.
DeepSeek reached 2/20. That is not a universal model ranking. It is a very clear
result for four frozen arenas under one controller.

The portable arena SDK and separate
[aoe-arenas](https://github.com/ducks/aoe-arenas) repository now prove the
framework can load someone else's arena rather than keeping every challenge in
the engine. The silly idea is turning into a real plugin system.

I wrote up the first contact in [Agents of Empires: Not a Leaderboard, a
Battleground](/blog/2026/agents-of-empires-not-a-leaderboard-a-battleground/).
It is not the strategy game yet. It is finally sturdy enough that adding the
game might mean something.

## lemma: one compiler, three languages

Before the infrastructure-agent spiral, I extracted my Czech course generator
into [lemma](https://github.com/ducks/lemma), a Rust compiler that does not know
any languages.

Everything language-specific lives in a `language.yaml` profile: cases,
pronunciation, stress, gender, register, grammar features, and template
overrides. Czech declares seven cases and a formal `vy` default. Spanish
declares no cases, the `ser`/`estar` split, and `tú`/`usted`. Swedish declares
`en`/`ett`, V2 word order, pitch accent, and no formal/informal distinction at
all. The same engine generated lesson one and 56 Anki cards for each language
without a Swedish or Spanish branch appearing in the Rust.

The rewrite started from a working Python generator, so I made the Rust version
prove parity rather than asking me to trust it. The old and new generators
produced byte-identical vocabulary and cloze cards; the only differences were
intentional improvements. Then I deleted the Python.

Publishing found the fun bug. I had checked crates.io search and concluded the
name `lemma` was free. The search endpoint had returned a rate-limited 404, and
I rounded that up to availability while ignoring the publish endpoint's warning
that the crate already existed. `make release` tagged and pushed before the
publish step, leaving a phantom release for a crate I did not own.

I deleted the tag, checked the authoritative sparse index, and published the
package as `lemma-compiler`. The library is still `lemma`, the binary is still
`lemma`, and the repository is still `ducks/lemma`; only `cargo install` needs
the longer name. The full story is in [lemma: A Compiler That Doesn't Know Any
Languages](/blog/2026/lemma-a-language-course-compiler/).

## The systems fought back

The real machines kept supplying incidents while I built simulated ones.

[Shelltrax](https://github.com/ducks/shelltrax) had two different failure
stories. A panic could leave the terminal in raw mode with stale characters,
which made the next command print diagonally across the screen. The fix was an
idempotent terminal guard, panic-hook restoration, cursor recovery, and an
explicit clear on startup. Then PulseAudio lost its output device while the app
still considered playback active. Stream creation now retries against the
current default device, and a failed resume reconstructs the track instead of
leaving the UI lying about its state.

The release command for the terminal fix still printed diagonally because I ran
it in the same terminal the old version had already damaged. New code cannot
travel backward in time. `stty sane` fixed the shell, and the release went out.

On pond, beanledger entered a restart loop because three tables were owned by
`postgres` while the migration user was `beanledger`. The split had been
dormant since a manual bootstrap months earlier; a new migration was simply the
first one to `ALTER users` and expose it. I backed up the database, reassigned
the three tables, and restored the service.

Then I tried to write a self-healing migration and recreated the bug myself by
testing it as the PostgreSQL superuser. The after-state check caught it. A
second attempt exposed the deeper impossibility: the non-owner application role
cannot write a migration that grants itself ownership of a table it does not
own. The durable conclusion was not another migration. The repository already
creates fresh databases correctly; this was a one-time historical artifact.
Sometimes the right fix is to repair the machine and decline to invent code.

Underneath the evaluations, [Claux](https://github.com/ducks/claux) gained
provider profiles, model selection, consistent rate-limit errors, cancellation
checks before filesystem mutation, one-shot transcript checkpoints, model and
tool timing, reasoning-level support, and credential isolation. Those changes
were not benchmark decoration. They are why Replaybook can distinguish model
time from tool time, preserve a partial trajectory after timeout, and rotate a
key without baking it into a guest image.

I also scoped moving Home Assistant off my development desktop and onto a real
homeserver. Proxmox finally supports ARM64, but not the RockPro64: it expects
UEFI and ACPI, while the RK3399 board boots through device tree. If I reuse that
board, it gets NixOS directly. If I want Proxmox, that is a reason to buy a
small x86 machine rather than spend a weekend pretending firmware friction is
a hobby.

## Outside the terminal

The art site got a URL migration and two new pieces.

All 22 existing Gnarly Void entries moved from numeric paths like `/voids/22/`
to descriptive canonical slugs, with the numeric URLs preserved as redirects.
Void 22 was [Loaded](https://gnarlyvoid.com/voids/loaded-tufted-die/), a tufted
die at throw-pillow scale with a dense foam core. The copy originally said it
had never been rolled. That was less fun than the truth the object wanted, so
now it lands with a soft thud and a verdict.

Void 23 is [Deck 001 & Deck
002](https://gnarlyvoid.com/voids/two-decks-adx/), a pair of tufted skateboard
decks from a group show at ADX. One is monochrome geometry; the other is a stack
of warm sunset stripes. It was also a reminder not to invent external links. I
guessed the ADX domain, guessed wrong, and corrected it to
`artdesignxchange.com` before shipping.

There was one especially nice open-source moment too: someone opened a pull
request against [claude-nixos](https://github.com/ducks/claude-nixos). I did not
know anyone was using it. I merged their fix, then reconciled the setup guide
with the newer `nix-ld` runtime on a follow-up branch. A project can sit quietly
for months and then reveal that it has a user.

## The through-line

The language compiler, the incident benchmark, and the agent battleground look
like three unrelated projects. They are all the same move.

Put the important rules in data. Keep the evaluator outside the thing being
evaluated. Make the unfinished state loud. Preserve enough evidence to explain
why something passed. Refuse to turn a plausible count, a clean health check,
or a 404 from a rate-limited API into a fact.

The fun part is that each project keeps attacking its own assumptions. Agents
found holes in Replaybook's verifier. Reboots found holes in Agents of Empires'
accounting. crates.io found a hole in my release process. PostgreSQL found a
hole in my confidence about a "safe" migration.

I keep building systems that tell me when I am wrong. Apparently that is the
genre now.
