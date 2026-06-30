---
title: "on-call: Fix Real Broken Infrastructure to Win"
date: 2026-06-30
description: "A terminal game where you're dropped into a broken Docker container and have to fix it. Built for incident replay - turn your post-mortems into training scenarios."
taxonomies:
  tags:
    - rust
    - tools
    - devops
    - oss
---

Post-mortems are the most underused artifact in software engineering.

You spend hours in the incident. You write up the timeline, the root cause, the fix, the follow-ups. You share it with the team. Six months later a new engineer joins, hits the same class of problem, and has no muscle memory for it at all. The post-mortem is in Notion somewhere.

That's the problem [on-call](https://github.com/ducks/on-call) solves.

## The Idea

on-call is a terminal game where you fix broken infrastructure. Not simulated broken infrastructure - actual broken Docker containers running real services. Nginx with a misconfigured upstream. Postgres with the wrong permissions on its data directory. Sidekiq pointed at a Redis that requires a password it doesn't have.

You're dropped into a shell inside the broken environment and have to figure out what's wrong and fix it before the SLA timer runs out.

```
on-call list
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
on-call run 001-nginx-502
```

The terminal splits. Left pane is your shell inside the container. Right pane is the HUD.

```
16882806a585:/# █                   │ == on-call ==
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

The game isn't about Docker. Docker is just how you spin up a real broken server and throw someone into it.

The alternative is a simulated environment - fake logs, scripted responses, prerecorded output. That teaches you how a simulation works. This teaches you how nginx works.

When you're in the container, `nginx -t` tells you if the config is valid. `curl localhost` actually hits the server. `ps aux` shows real processes. Nothing is stubbed.

The fault in scenario 001 is a one-character config change: the upstream port is 3001 instead of 3000. There's no quiz asking you to identify the right port. You have to find it the same way you'd find it in production.

## The Incident Replay Angle

The scenarios that ship with the game are generic. But the format is a JSON file plus a Docker Compose setup:

```json
{
  "id": "redis-oom-eviction",
  "title": "Cache Eviction Killing Sessions",
  "page": "users are getting logged out randomly. started after the traffic spike yesterday. no deploys, no config changes.",
  "difficulty": 3,
  "tags": ["redis", "memory", "sessions"],
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

Write up what broke. Write `break.sh` to reproduce it. New engineers run it, fix it with real tools, build the muscle memory. The post-mortem becomes a playable training scenario.

## The HUD

The split-pane HUD runs inside the container via tmux. No dependency on the host. The game installs tmux at startup via `apk` (all scenarios use alpine-based images), copies in the HUD script, splits the pane.

The state file lives on the host and is bind-mounted into the container. The poller writes to it directly - no shell escaping, no `docker exec` state writes. The HUD script just reads it every 2 seconds.

```bash
# Inside the container, run anytime:
get-hint
```

Hints are revealed sequentially. The HUD shows which hints you've used. Hints used is recorded with the session outcome - eventually that'll factor into scoring.

## Install

```bash
curl -fsSL https://github.com/ducks/on-call/releases/latest/download/on-call-linux-x86_64 -o on-call
chmod +x on-call
sudo mv on-call /usr/local/bin/
```

Binaries for linux-x86_64, linux-arm64, macos-x86_64, macos-arm64. You need Docker.

Or from source:

```bash
cargo install on-call
```

## What's Next

Scoring based on time and hints used. Badges for specific solve conditions (under 2 minutes, no hints). More scenarios - planning a Discourse track covering the failures that come up most in self-hosted deployments.

The scenario format is the interesting part. If you've run an incident and written a post-mortem, the hardest work is already done.

---

Source: [github.com/ducks/on-call](https://github.com/ducks/on-call)
