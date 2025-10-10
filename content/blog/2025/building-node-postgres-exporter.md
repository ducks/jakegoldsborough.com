+++
title = "node-postgres-exporter — A Lightweight, Configurable PostgreSQL Prometheus Exporter"
date = 2025-06-20
description = "Building a flexible Node.js-based Prometheus exporter for PostgreSQL with multi-database support, dynamic custom metrics via JSON configuration, and production-ready fault isolation."
[taxonomies]
tags = ["devops", "nodejs"]
+++

I’m releasing a small project I’ve been building:

`node-postgres-exporter`, is a lightweight Prometheus exporter for PostgreSQL,
written in Node.js.

The goal: build a fully configurable exporter that supports multiple databases,
dynamic custom metrics, and solid production fault tolerance — while keeping
the design modular and simple to operate.

There are excellent existing exporters in the ecosystem — but many of them
require full privilege access, tightly coupled SQL views, or lack flexible
multi-database support.

This exporter aims to solve a more targeted problem:

- Support multiple independent PostgreSQL instances
- Expose core database metrics (connections, size, etc.)
- Allow fully configurable, per-database custom metrics via JSON
- Provide basic fault isolation so partial database failures don't block full scrapes
- Expose Prometheus-friendly endpoints with modern HTTP APIs

### Key Features

- Node.js + Express based architecture
- Uses [`pg`](https://node-postgres.com/) for database access via dedicated connection pools per database
- Uses [`prom-client`](https://github.com/siimon/prom-client) for full Prometheus metric management
- Simple configuration via JSON files (`databases.json` and `queries.json`)
- API key authentication (Bearer token) for securing metrics endpoint
- Graceful shutdown handling for safe database pool cleanup
- Fully Dockerized with ready-to-run `docker-compose` setup for local testing
- Includes health endpoints: `/healthz`, `/readyz`, `/livez`, `/configz`

### Metric Types Supported

- PostgreSQL connection counts
- Per-database size metrics
- Custom query metrics with support for `Gauge` and `Counter` types
- Exporter self-metrics: scrape duration, error tracking, scrape lockouts, etc.

### Dynamic Query Configuration

One of the core design goals for `node-postgres-exporter` was flexibility
without requiring code changes. To achieve this, all custom metric definitions
are fully externalized via configuration files.

`queries.json`

Custom metrics are defined in a simple `queries.json` file, allowing operators
to add new metrics by writing plain SQL queries without modifying or
redeploying the exporter. Each query entry includes:

`name` – the Prometheus metric name

`help` – description for the metric

`type` – gauge or counter

`labels` – array of columns to extract as metric labels

`query` – the raw SQL statement to run against the target database

```
[
  {
    "name": "active_users",
    "help": "Number of active users",
    "type": "gauge",
    "labels": ["status"],
    "query": "SELECT status, COUNT(*)::int FROM users GROUP BY status"
  }
]
```

On each scrape, the exporter executes the configured queries, extracts label
values from the row fields, and populates the Prometheus metric accordingly.

### Fault Tolerance and Isolation

Another design goal was to handle database failures gracefully. If one database
becomes unavailable (network issue, restart, maintenance), the exporter:

- Continues scraping all healthy databases
- Exposes scrape success/failure per database as dedicated metrics
  (`pg_scrape_success`)
- Never fails the entire scrape due to single database issues

Internally, this is implemented using:

- `Promise.allSettled()` to concurrently scrape databases while isolating
  failures
- Explicit error metric tracking
- Per-database scrape duration timing

### Example Use Case

This design fits environments where:

- You manage multiple distinct PostgreSQL instances
- You have limited privilege access on some databases
- You want metrics to be purely driven by SQL queries without deeper system
  integration

### What it’s not trying to be

- A full replacement for highly privileged exporters like the canonical
  [`postgres_exporter`](https://github.com/prometheus-community/postgres_exporter)
- A deep SQL monitoring agent requiring superuser roles or heavy introspection

This exporter is intentionally **simple, safe, and scoped** — easy to audit and
deploy.

### Roadmap / Future Ideas

There’s plenty of room for future enhancement:

- Hot-reload support for queries and DB configs
- JSON schema validation on configuration files
- Cardinality protection on dynamic label sets
- Additional metric types (`Histogram`, `Summary`)
- Publish Docker images to container registries
- Integration with secret management for DB credentials

### Source Code

Repo available here:
[https://github.com/ducks/node-postgres-exporter](https://github.com/ducks/node-postgres-exporter)

### A Side Benefit

Although this started as part of an audition project, I ended up building
something I’d absolutely consider productionizing for real-world use cases —
and more importantly, something I can showcase as a clean systems-level
engineering project.
