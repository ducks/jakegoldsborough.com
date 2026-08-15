---
title: "The Battleground Has a Map Now"
date: 2026-08-15
description: "Agents of Empires started as three rows in a terminal. I gave the battleground a service map driven by the same referee events that decide who wins."
taxonomies:
  tags:
    - ai
    - infrastructure
    - games
    - dev
    - tools
---

Two days ago I wrote this sentence about
[Agents of Empires](/blog/2026/agents-of-empires-not-a-leaderboard-a-battleground/):

> The map is currently a table in a terminal.

That sentence did not last very long.

The terminal table was enough to prove the game worked. Three agents entered
three identical blank NixOS machines. Each tried to build the same durable
service. An external referee checked their work, restarted it, rebooted the
host, and declared the first deployment still standing the winner.

It was useful. It was also three rows changing numbers.

Now every match replay can contain a map of the system the agents are trying to
build. An API connects to a queue. A worker pulls from it. A proxy routes to two
application versions. A failed primary sits beside the replica that must replace
it. Press play and the pieces change state as the referee verifies the real
system underneath them.

The battleground finally looks a little like a battleground.

![An Agents of Empires match replay showing three competing queue territories, their service maps, and a shared event timeline](/images/2026/agents-of-empires/match-map-replay.png)

*Three agents building the same durable queue topology. The map changes as the
referee verifies each system.*

## The diagram is part of the arena

I did not want the report generator guessing the topology from process names or
whatever commands an agent happened to run.

An arena already defines the contract. It knows which milestones matter, which
services must survive, and what counts as durable. The map belongs there too.

The primary failover arena includes nodes like this:

```toml
[visualization]

[[visualization.nodes]]
id = "router"
display_name = "Data Router"
kind = "proxy"
milestone = "writes-restored"
x = 31
y = 25

[[visualization.nodes]]
id = "replica"
display_name = "Replica"
kind = "database"
milestone = "reads-restored"
x = 84
y = 43

[[visualization.links]]
from = "router"
to = "replica"
kind = "traffic"
```

The coordinates are percentages. The node kinds provide a small visual
language for clients, proxies, services, workers, queues, databases, storage,
and hosts. Links can represent traffic, queue flow, replication, storage, or
lifecycle relationships.

The important field is `milestone`.

That ties a picture of the replica to the verifier that proves reads were
actually restored. The node does not turn green because an agent said it
promoted the database. It turns green because the referee connected to the
deployed service, requested an existing record, and got the expected value.

The map is not an illustration pasted on top of the benchmark. It is another
projection of the benchmark's evidence.

## Press play

Every Agents of Empires match already produced an immutable event stream.

The log records agents starting, milestones entering verification, failed
checks, successful checks, token usage, state transitions, host reboots, and
the first durable deployment. The match replay uses that same stream for its
shared clock.

Before the map, the replay rendered each territory as a lane. You could watch
one agent stall on service health while another reached the restart gate. You
could click an event and inspect the referee's raw evidence.

The map adds a second view of the same moment.

At the start of the failover race, the old primary is preserved but unavailable
for traffic. The replica has not been promoted. The router cannot serve reads.
As the clock moves, a competitor restores reads, fences the old primary,
restores writes, restarts the topology, and finally survives the host reboot.
Each verified milestone changes the corresponding part of the diagram.

This makes a difference I did not fully expect.

The terminal told me who was ahead. The timeline told me when something
happened. The map tells me what kind of system exists at that point in the
race.

That is much closer to how I think about infrastructure.

## The map is also a test

Visualizing the topology immediately made me ask harder questions about the
arenas.

What does a healthy queue mean if the worker is still down? Should the router
be green when reads work but writes do not? Is the old primary part of the
successful topology, or should it remain visibly fenced? Does reboot verify the
whole host or only the final HTTP response?

Those sound like design questions. They are verifier questions.

If I cannot attach a node to evidence, I may not be checking the thing I claim
to care about. If two important components share one vague milestone, the map
makes that vagueness visible. If an arena diagram says there is a worker but no
verifier ever asks whether work leaves the queue, the missing proof is suddenly
hard to ignore.

The agents test the arena. The arena tests the agents. Apparently the map tests
both of them.

## Historical maps do not change

Arena packages can live outside the Agents of Empires repository. Someone else
can define a service contract, NixOS guest, verifier scripts, agent
instructions, oracle implementation, and topology map in one directory.

That creates an obvious reproducibility problem. What happens when the arena
author moves a node, renames a service, or strengthens a verifier after a match
has already run?

The match stores the exact arena manifest it used. Reports render from that
snapshot, not the current checkout. Old matches keep their old map and old
rules. Matches created before topology support still render without a map.

This is the less glamorous part of adding a visual feature. It is also the part
that keeps the visualization from rewriting history.

A match replay is an audit trail first. It happens to move.

## It is still not Age of Empires

The map does not show agents marching across a field. There is no fog of war,
technology tree, resource economy, base building, or sabotage. Agents cannot
spawn subagents after researching distributed systems. Nobody has sent a
poisoned Sidekiq job into another territory.

Yet.

For now, the arena author places the components. The agents decide how to make
them real. The referee decides whether they succeeded. The replay lets me watch
the verified system appear over time.

That is enough to change the feeling of the project.

Replaybook gives me a table of isolated attempts. Agents of Empires already
turned those attempts into a race. The map turns the race into a place.

I can see the blank system at the opening bell. I can watch one agent get a
service online, another recover the data, and a third reach the reboot gate. I
can scrub backward and find the exact moment the winning topology became real.

The map is still mostly boxes and lines.

So was Age of Empires, if you zoomed out far enough.

The [live match archive](https://ducks.github.io/agents-of-empires/) and
[source](https://github.com/ducks/agents-of-empires) are both public.
