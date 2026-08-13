---
title: "Agents of Empires: Not a Leaderboard, a Battleground"
date: 2026-08-13
description: "I dropped DeepSeek, Luna, and GLM into identical blank NixOS hosts and made them race to recover queued work, survive a reboot, and produce the first durable deployment."
taxonomies:
  tags:
    - ai
    - infrastructure
    - games
    - dev
    - tools
---

At 10:30 this morning, three language models woke up inside three blank NixOS
machines.

Each machine contained three accepted customer jobs, no application, and the
same service contract. The models had to build an API and a background worker,
recover the existing jobs exactly once, process new work, survive a worker
restart, and come back after the referee rebooted the host.

The first durable deployment would win.

Four minutes later, GPT-5.6 Luna crossed the finish line. GLM had a healthy
service but failed to recover the original backlog. DeepSeek never got a health
check past the referee.

This is a strange thing to build.

It is called [Agents of Empires](https://github.com/ducks/agents-of-empires).

## I got distracted by another girl

I have spent the past week building
[Replaybook](https://github.com/ducks/replaybook), a benchmark that sends AI
agents into broken Linux systems and checks whether their repairs survive
service restarts and host reboots.

Replaybook produces useful tables. Pass rates, time, cost, token use, failure
categories, and tool behavior. I like those tables. I have spent an unreasonable
amount of time looking at them.

But I kept thinking about the distracted boyfriend meme.

His girlfriend is a static leaderboard. The other girl is three agents dropped
onto blank servers, racing to recover real queued work before an external
referee reboots them.

What if the models did not take turns? What if they entered the arena at the
same time?

The first idea was closer to a free-for-all strategy game. Every agent would get
a territory, a different kind of server, and a catalog of attacks. They could
infiltrate each other, break services, take resources, and grow their empire. A
little BattleBots, a little Age of Empires, and somehow also Pokemon.

It was a great way to design six systems before proving one.

So I backed up. Before the agents fight each other, they need to prove they can
build something.

## The build race

Agents of Empires currently gives every competitor an identical disposable VM
and the same contract. The machine is not secretly a container. It is a real
NixOS guest with systemd, a writable filesystem, networking, and a reboot
button the referee is happy to press.

The durable job queue arena starts with three opaque accepted jobs:

```
accepted-alpha-7d3
accepted-beta-91e
accepted-gamma-c42
```

The payloads are already on disk. The agent cannot discard them and create
three convenient replacements.

It must deploy two separate services:

- `queue-api.service` accepts jobs and reports their state;
- `queue-worker.service` processes them exactly once.

The referee awards milestones, but points do not decide the winner:

| Milestone | Points |
|---|---:|
| Service becomes healthy | 10 |
| Existing accepted jobs are recovered | 25 |
| A fresh opaque job completes exactly once | 20 |
| Work survives a worker restart | 20 |
| The whole deployment survives a host reboot | 25 |

The first agent to pass all five wins.

This distinction matters. The fastest agent to return HTTP 200 did not win. The
agent with the longest explanation did not win. The winner was the first one
whose work was still there after the machine disappeared and came back.

That is the same lesson Replaybook kept teaching me. A confident answer is not
a repair, and a running process is not a durable system.

## First contact

The first real queue race used the same agent harness and three different
models:

| Territory | Model | Result |
|---|---|---|
| queue-one | DeepSeek V4 Flash 0731 | Never passed service health |
| queue-two | GPT-5.6 Luna | Durable in 4:00.961 |
| queue-three | GLM 5.2 | Healthy, but lost the accepted backlog |

For a while, the terminal looked stuck.

```
AGENTS OF EMPIRES  match=running  clock=02:37

    territory        state        milestones   points
    queue-one         verifying        0/1           0
    queue-three       verifying        1/2          10
    queue-two         verifying        0/1           0

 02:06  queue-three passed service-up (+10)
 02:06  queue-three verifying recover-accepted
 02:37  queue-three failed recover-accepted
```

It was not stuck. The verifier was giving each deployment time to recover the
pre-existing jobs. The quiet part was the test.

Luna came through later. It recovered the original backlog, processed a fresh
job exactly once, survived a worker restart, and then survived the host reboot.

```
 03:44  queue-two passed worker-restart (+20)
 03:44  queue-two verifying host-reboot
 04:00  queue-two passed host-reboot (+25)
 04:00  queue-two completed a durable deployment
 04:00  match finished winner=queue-two
```

There was no judge reading the model's final answer. The referee inspected the
system.

## The winner looked like a failure

The first run immediately found a bug in the arena.

Luna won by surviving a host reboot. Rebooting the host also severed the SSH
session running the agent. From the controller's perspective, the winning agent
had exited unexpectedly.

My first implementation called that a failure.

That is obviously wrong once you say it out loud. The arena itself interrupted
the session as part of the winning verification step. Luna had not failed. It
had been hit by the finish line.

The controller now records that outcome as `interrupted`, with the arena as the
source. After a winner is declared, the match clock freezes and a short
post-match drain collects final output from the other agents. Anything still
running after the deadline is terminated, but the original finish time does not
move.

That drain exposed another honest limitation. The match page shows $0.0480 in
recorded cost, all from GLM. That is not the total cost of the race. Luna's
usage report disappeared with the reboot, and DeepSeek was terminated before
returning one. The page says **Recorded cost** because zero would be a lie.

The agent race tested my accounting before I had a chance to trust it.

## The oracle also found a bug

Before spending model tokens, every arena can run deterministic oracle agents.
They install a known-good implementation so I can test the guest image, network,
referee, restart logic, and reboot path.

The first queue oracle race produced one winner and two broken competitors.

All three guests were identical. All three agents ran the same script. Only one
could start its services.

The seed service was a systemd oneshot. It completed, became inactive, and then
the API and worker dependencies tried to start it again. The other guests fell
over in slightly different places. Adding `RemainAfterExit = true` fixed the
arena.

On the next run, all three oracle deployments reached the reboot milestone at
the same time. One host returned first and won by a fraction of a second.

A battleground can be buggy too. If I cannot make identical scripted agents
produce identical systems, I have no business comparing language models on it.

## A match is an audit trail

The terminal animation is fun, but it is not the record.

Every match writes an immutable event log, the final world state, agent results,
transcripts, and a provenance file containing the controller revision, arena
manifest hash, verifier hash, and adapter hashes. The report generator turns
those artifacts into a static site.

The [public match archive](https://ducks.github.io/agents-of-empires/) separates
current runs from historical ones. A run is current only when it shares the
newest verifier and manifest compatibility key for its arena. Old prototypes
stay visible, but they are not silently compared with results produced under
different rules.

That part is less exciting than watching models race. It may be more important.

Without the verifier version, a faster time could mean a faster agent. It could
also mean I forgot to check whether the customer jobs survived.

## It is not Pokemon yet

Agents of Empires is not the original game in my head.

There are no attacks, territory bonuses, resource economies, random disasters,
or specialized server classes yet. The agents cannot sabotage each other. The
map is currently a table in a terminal.

Good.

The build-first version gives me a smaller question with an answer I can check:
which agent can turn the same blank machine into the same durable service first?

Later, I can introduce uneven territory, offensive actions, random infrastructure
events, and a real visualization. But combat only gets interesting after the
rules become trustworthy. Otherwise I am just animating benchmark bugs.

Replaybook tells me how agents repair a broken system one attempt at a time.
Agents of Empires lets me watch them build under the same clock, on the same
field, with the same referee.

Leaderboards tell me which number is bigger.

I want to watch three agents enter identical blank machines, see what they
build, reboot it, and find out what remains.

That is not a leaderboard. It is a battleground.

[Source on GitHub](https://github.com/ducks/agents-of-empires)

