---
title: "replaybook: Incident Replay Trainer for Infrastructure"
date: 2026-06-30
description: "A terminal trainer where you're dropped into a broken Docker container and have to fix it. Turn your post-mortems into runnable scenarios."
taxonomies:
  tags:
    - rust
    - tools
    - devops
    - oss
---

Post-mortems are the most underused artifact in software engineering.

You spend hours in the incident. You write up the timeline, the root cause, the fix, the follow-ups. You share it with the team. Six months later a new engineer joins, hits the same class of problem, and has no muscle memory for it at all. The post-mortem is in Notion somewhere.

That's the problem [replaybook](https://github.com/ducks/replaybook) solves.

## The Idea

replaybook is a terminal trainer where you fix broken infrastructure. Not simulated broken infrastructure - actual broken Docker containers running real services. Nginx with a misconfigured upstream. Postgres with the wrong permissions on its data directory. Sidekiq pointed at a Redis that requires a password it doesn't have.

You're dropped into a shell inside the broken environment and have to figure out what's wrong and fix it before the SLA timer runs out.

```
replaybook add ducks/on-call-scenarios
replaybook list
```

```
ID                             DIFF  TITLE
────────────────────────────────────────────────────────────
001-nginx-502                  1     502 Bad Gateway
002-postgres-wont-start        1     Postgres Won't Start
003-missing-env-var            2     App Crashing on Boot
004-disk-full                  2     Health Checks Failing
005-oom-kill                   2     Container Keeps Restarting
006-sidekiq-cant-connect       2     Jobs Not Processing
```

```
replaybook run 001-nginx-502
```

The terminal splits. Left pane is your shell inside the container. Right pane is the HUD.

```
16882806a585:/# █                   │ == replaybook ==
                                    │
                                    │ INCIDENT:
                                    │ URGENT: users getting 502s
                                    │ on checkout. conversion is
                                    │ tanking. started about 5
                                    │ mins ago. no deploys today
                                    │ that we know of. fix asap
                                    │
                                    │ STATUS: ACTIVE
                                    │ SLA:    14:45 remaining
                                    │ HINTS:  0 / 2 used
                                    │
                                    │ run get-hint for a hint
```

You're inside nginx. The real nginx. Look at the config, check the logs, fix the upstream, reload the service. When the health check passes, you win.

## Why Docker

The trainer isn't about Docker. Docker is just how you spin up a real broken server and throw someone into it.

The alternative is a simulated environment - fake logs, scripted responses, prerecorded output. That teaches you how a simulation works. This teaches you how nginx works.

When you're in the container, `nginx -t` tells you if the config is valid. `curl localhost` actually hits the server. `ps aux` shows real processes. Nothing is stubbed.

The fault in scenario 001 is a one-character config change: the upstream port is 3001 instead of 3000. There's no quiz asking you to identify the right port. You have to find it the same way you'd find it in production.

## The Incident Replay Angle

The scenarios that ship with the official pack are generic. But the format is a JSON file plus a Docker Compose setup:

```json
{
  "id": "redis-oom-eviction",
  "title": "Cache Eviction Killing Sessions",
  "page": "users are getting logged out randomly. started after the traffic spike yesterday. no deploys, no config changes.",
  "difficulty": 3,
  "hints": [
    "Check Redis memory usage and eviction policy",
    "What happens to session keys when Redis runs out of memory?"
  ],
  "success_condition": "http_200",
  "success_target": "http://localhost:3000/health"
}
```

Your `break.sh` injects the fault. Your `check.sh` defines what "fixed" looks like.

That means every incident your team has ever had can become a scenario. The Redis maxmemory eviction that took down sessions last quarter. The postgres autovacuum that blocked table writes during a migration. The nginx upstream that pointed at the wrong port after a deploy.

Write up what broke. Write `break.sh` to reproduce it. New engineers run it, fix it with real tools, build the muscle memory. The post-mortem becomes a runnable training scenario.

Scenario packs are just Git repos. Your team's private incidents stay private:

```bash
replaybook add mycompany/incidents
```

## The HUD

The split-pane HUD runs inside the container via tmux. No dependency on the host. The trainer installs tmux at startup via `apk` (all scenarios use alpine-based images), copies in the HUD script, splits the pane.

The state file lives on the host and is bind-mounted into the container. The poller writes to it directly - no shell escaping, no `docker exec` state writes. The HUD script reads it every 2 seconds.

```bash
# Inside the container, run anytime:
get-hint
```

Hints are revealed sequentially. The HUD shows which hints you've used. Hints used is recorded with the session outcome.

## Install

```bash
cargo install replaybook
```

Or grab a prebuilt binary for linux-x86_64, linux-arm64, macos-x86_64, or macos-arm64 from the [releases page](https://github.com/ducks/replaybook/releases). You need Docker.

Both `replaybook` and `replay` are installed - use whichever you prefer.

## What's Next

Scoring based on time and hints used. More scenarios - planning a Discourse track covering the failures that come up most in self-hosted deployments.

The scenario format is the interesting part. If you've run an incident and written a post-mortem, the hardest work is already done.

---

Source: [github.com/ducks/replaybook](https://github.com/ducks/replaybook)
