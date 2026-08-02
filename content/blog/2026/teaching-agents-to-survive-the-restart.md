---
title: "Teaching Agents to Survive the Restart"
date: 2026-08-02
description: "I connected Replaybook, Harbor, Nix, and claux to see whether agents can repair broken infrastructure instead of just making the health check green."
taxonomies:
  tags:
    - ai
    - rust
    - infrastructure
    - dev
---

I have been building [Replaybook](https://github.com/ducks/replaybook) as an incident replay trainer.

It starts a broken service, gives you a workstation with Docker access, and asks you to fix the incident. The success condition is objective. Usually it is a health endpoint or a real connection to a dependency.

That was useful for humans. Then I wanted to know how agents would do.

Not on a coding benchmark. On a running system with containers, state, bad configuration, and a verifier that can restart the service after the agent says it is finished.

## The stack

The evaluation harness is four projects working together:

- Replaybook provides the incidents and verifiers
- [Harbor](https://github.com/laude-institute/harbor) runs the agent tasks and records results
- Nix creates disposable workers
- [claux](https://github.com/ducks/claux) provides a lightweight OpenRouter-backed
  agent. I wrote about how it became a harness in [Part 4 of the claux
  series](/blog/2026/rewriting-claude-code-in-rust-part-4/).

Each trial gets a fresh NixOS VM, a fresh Docker environment, a separate SSH port, and only the credentials required by that agent.

The agent does not get a repository with a failing test. It gets an incident report:

```text
The application is receiving PostgreSQL authentication failures.
The database container is running, but TCP connections are rejected.

Investigate the database container from the incident workstation and restore
a real TCP connection. Make the fix survive a restart.
```

It has to inspect the running containers and repair the deployed service.

## The verifier matters

A health check is not enough.

An agent can start a second process on the expected port, get a 200 response, and report success. That is not a repair. It disappears when the container restarts.

The verifier checks the user-facing path, restarts the affected services, then checks again:

```bash
if ! wait_for_health; then
  fail
fi

docker restart "$app_container"
docker restart "$nginx_container"

if ! wait_for_health; then
  fail
fi
```

That one restart changed the results.

## The first matrix

I ran claux against three scenarios:

- Nginx returning 502
- PostgreSQL rejecting TCP connections
- An application crashing because an environment variable was missing

Three attempts per scenario. Nine trials total.

The result was 7/9, at a reported cost of six cents.

That is not a spectacular benchmark score. It is much more interesting than one.

The PostgreSQL scenario passed three out of three. The missing environment scenario passed two out of three. The Nginx scenario also passed two out of three.

One failure was a temporary fix that worked until the restart. Another agent timed out after fifteen minutes without recovering the application.

Those are different failures. The verifier tells me which one happened instead of reducing both to “the model got a zero.”

## What this is measuring

The agent has to do more than write a plausible command.

It has to:

- inspect a live system
- identify the broken layer
- repair the deployed service
- avoid replacing or bypassing the service
- preserve the repair across a restart
- verify the result from the user-facing path

That is closer to incident response than code generation.

The useful distinction is between making the current check green and actually changing the system into a healthy state.

## The part I did not expect

I started this because I wanted to compare models. I assumed the interesting output would be a leaderboard.

The more useful output is the failure classification.

A failed trial can mean:

- the model misunderstood the topology
- the repair was not durable
- the model got stuck investigating
- the provider timed out
- the worker or credential setup failed
- the verifier exposed a flaw in the task itself

Those are all different engineering problems. A single reward number hides most of them.

## What is next

I want to add more scenarios that test different operational skills:

- resource exhaustion
- broken deploys
- dependency outages
- data corruption
- security and configuration mistakes

I also want to run the same matrix with Codex and Claude Code once the authentication setup is less annoying.

This is still a small personal tool. It is not a serious benchmark yet.

But the machinery is real now. Same incident, fresh machine, objective verifier, repeated trials, and enough detail to understand why an agent failed.

That feels more useful than asking whether a model is “good at coding.”
