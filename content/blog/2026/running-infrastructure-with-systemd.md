---
title: "Running VPS Infrastructure with Systemd"
date: 2026-01-02
description: "Declarative VPS infrastructure using systemd services. Running Gitea, Woodpecker CI, Scrob, and GoatCounter with automated deployment scripts."
taxonomies:
  tags:
    - self-hosting
    - infrastructure
    - systemd
---

I run all my personal infrastructure on a single VPS using systemd
services instead of Docker. No containers, no orchestration, just
systemd units and bash scripts.

## Why Not Docker?

Docker is fine, but for a single VPS it felt like overhead. I wanted something simpler
and built-in. I initially started with Docker but was constantly hitting
networking issues with services communicating.

Systemd already handles process supervision, logging, and restarts. Why
add another layer?

## What's Running

The VPS hosts:
- **Gitea** - Git hosting at code.jakegoldsborough.com
- **Woodpecker CI** - Continuous integration (idle for now)
- **Scrob** - Music scrobbling server (see [previous
  post](https://jakegoldsborough.com/blog/2026/building-scrob-self-hosted-scrobbling/))
- **GoatCounter** (3 instances) - Analytics for multiple sites
- **Caddy** - Reverse proxy with automatic HTTPS
- **PostgreSQL** - Shared database for Gitea, Woodpecker, and Scrob

Everything runs as dedicated system users with systemd units managing
their lifecycle.

## How It Works

```
Caddy (reverse proxy + TLS)
    |
    +-- code.jakegoldsborough.com -> Gitea (port 3000)
    +-- ci.jakegoldsborough.com -> Woodpecker (port 8000)
    +-- scrob.jakegoldsborough.com -> Scrob (port 3002)
    +-- ui.scrob.jakegoldsborough.com -> Scrob UI (static files)
    +-- stats.jakegoldsborough.com -> GoatCounter (port 8081)
    +-- stats.date-ver.com -> GoatCounter (port 8082)
    +-- stats.gnarlyvoid.com -> GoatCounter (port 8083)
```

Each service runs as a systemd unit. Caddy handles TLS termination and
proxies requests to the appropriate backend.

## The Repository Structure

The entire setup lives in a git repo called `burrow-systemd`:

```
burrow-systemd/
├── systemd/            # Service unit files
│   ├── gitea.service
│   ├── woodpecker-server.service
│   ├── scrob.service
│   ├── goatcounter-*.service
│   └── caddy.service
├── config/             # Service configurations
│   ├── Caddyfile
│   ├── gitea/app.ini
│   ├── woodpecker/server.env
│   └── scrob/scrob.env
└── bin/                # Deployment scripts
    ├── bootstrap       # Initial setup
    ├── deploy          # Update and restart
    ├── update          # Check and apply updates
    └── backup          # Backup databases
```

Configuration is declarative. Change a config file, commit, push, pull
on the VPS, run `./bin/deploy`, done.

## Bootstrap Script

The bootstrap script sets up everything from scratch:

1. Installs packages (Caddy, PostgreSQL)
2. Downloads service binaries (Gitea, GoatCounter, Woodpecker)
3. Creates system users (`gitea`, `goatcounter`, `scrob`, etc.)
4. Initializes PostgreSQL databases
5. Generates secure passwords and tokens
6. Copies config files from templates
7. Installs systemd service files

Run once on a fresh VPS:

```bash
sudo ./bin/bootstrap
```

It generates a `.env` file with all secrets and database passwords. This
file is git-ignored and stays on the server.

## Deploy Script

The deploy script handles updates and restarts:

1. Updates configuration files (substitutes passwords from `.env`)
2. Copies service files to `/etc/systemd/system/`
3. Reloads systemd
4. Creates databases if they don't exist
5. Enables and restarts all services
6. Checks service status

After changing config locally:

```bash
git add config/Caddyfile
git commit -m "Update reverse proxy config"
git push

# On VPS
cd ~/dev/burrow-systemd
git pull
sudo ./bin/deploy
```

The deploy script is idempotent. Run it as many times as you want.

## Service Updates

Updates are automated via the update script. It checks GitHub releases
for all services and downloads new binaries when available:

```bash
# Check what needs updating
sudo ./bin/update check

# Apply all updates
sudo ./bin/update apply

# Update specific service
sudo ./bin/update apply gitea
```

The script compares installed versions against the latest GitHub
releases. If an update is available, it downloads the new binary, stops
the service, replaces the binary, and restarts the service.

Scrob migrations run automatically on startup via `sqlx::migrate!()`.

Simple and explicit.

## Database Strategy

PostgreSQL is shared across Gitea, Woodpecker, and Scrob. Each service
gets its own database and user with limited permissions.

GoatCounter uses SQLite because each instance is independent. Three
separate SQLite databases, three separate systemd units, three separate
ports.

No database clustering, no replication, no complexity. Daily backups via
cron are enough for my use case.

## What Works

- Single command deployment (`./bin/deploy`)
- Automated binary updates (`./bin/update`)
- Centralized logging via journalctl
- Automatic HTTPS via Caddy + Let's Encrypt
- Service isolation via systemd users
- Declarative config in git
- Low memory footprint (no container runtime)

## What Doesn't

- Can't easily move to a different host (not portable like containers)
- Service isolation is weaker than containers
- Harder to test locally (no docker-compose equivalent)

## Security Model

- Each service runs as a dedicated system user
- PostgreSQL only listens on localhost
- TLS handled by Caddy (reverse proxy)
- Secrets stored in `.env` (git-ignored, mode 600)
- No rate limiting (future work)

All services bind to localhost and are only accessible via Caddy's
reverse proxy. The VPS firewall blocks everything except 80, 443, and
SSH.

## Reflections

The best part is the simplicity. No Docker networking, no volume mounts,
no image building. Just systemd units, config files, and bash scripts.

When something breaks, `journalctl -u <service>` shows exactly what went
wrong. No container layers to debug.

The tradeoff is portability. This setup is tied to the specific VPS and
filesystem layout. Migrating to a new server means running bootstrap
again and restoring database backups.

For my use case, that's fine. I'm not running a multi-tenant SaaS. I'm
hosting services for myself.

That's enough.

## Links

- [burrow-systemd](https://github.com/ducks/burrow-systemd)
- [Scrob blog post](https://jakegoldsborough.com/blog/2026/building-scrob-self-hosted-scrobbling/)
- [Gitea](https://about.gitea.com/)
- [Woodpecker CI](https://woodpecker-ci.org/)
- [GoatCounter](https://www.goatcounter.com/)
- [Caddy](https://caddyserver.com/)
