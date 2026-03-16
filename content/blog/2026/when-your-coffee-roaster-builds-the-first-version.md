---
title: "When Your Coffee Roaster Builds the First Version"
date: 2026-03-16
description: "A coffee roaster built production planning software with Claude. I handled the infrastructure. What this collaboration reveals about AI-enabled development."
taxonomies:
  tags:
    - ai
    - svelte
    - infrastructure
    - oss
---

A coffee roaster needed production planning software. Instead of writing a spec and hiring someone to build it, they opened Claude and built it themselves.

Single-page app with 2000 lines of React.  It featured batch calculations, leftover tracking, CSV import, production snapshots and it worked.

Then they asked me to help make it production-ready: multi-tenant SaaS, proper deployment, migrations, backups, the infrastructure layer.

The result is [BeanLedger](https://github.com/ducks/beanledger), and the collaboration pattern is worth examining.

## What They Built

The coffee roaster understood their domain completely. They knew:
- How roast loss percentages affect batch calculations
- When to track leftovers vs when to start fresh
- What information matters on a pick list
- How production snapshots should restore state

They used Claude to translate that knowledge into working code. The business logic was sound. The UI matched their workflow. The calculations were correct.

What was missing was everything around the edges:
- Multi-tenancy (it was single-user)
- Authentication and session management
- Database migrations
- Deployment automation
- Production monitoring
- Backup/restore

This is the division of labor that emerged: they own features, I own infrastructure.

## The Architecture

BeanLedger is a SvelteKit app with PostgreSQL, designed for multi-tenant SaaS:

```
├── src/
│   ├── routes/
│   │   ├── api/           # REST endpoints with tenant isolation
│   │   ├── login/         # Auth flow
│   │   └── +page.svelte   # Main app
│   ├── lib/
│   │   ├── components/    # Svelte 5 components
│   │   ├── types.ts       # TypeScript interfaces
│   │   └── calc.ts        # Batch calculation logic
│   └── hooks.server.ts    # Tenant middleware
├── migrations/            # SQL migrations
└── schema.sql            # Database schema
```

### Tenant Isolation

Every API request requires authentication. The session middleware injects tenant context:

```typescript
// hooks.server.ts
export const handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('session_id');
  if (!sessionId) return resolve(event);

  const session = await db.get('SELECT * FROM sessions WHERE id = ?', sessionId);
  if (!session) return resolve(event);

  const user = await db.get('SELECT * FROM users WHERE id = ?', session.user_id);
  event.locals.user = user;
  event.locals.tenant_id = user.tenant_id;

  return resolve(event);
};
```

All database queries filter by `tenant_id`. The roast groups, products, and orders are scoped to the authenticated tenant.

### Production Snapshots

One of the best features the roaster designed: production date tracking with snapshots.

When you switch dates, the app saves the current state (orders + leftovers) and tries to restore a snapshot for the new date. If no snapshot exists, it loads fresh data.

```typescript
async function handleProductionDateChange(newDate: string) {
  const oldDate = previousDate;
  if (oldDate === newDate) return;

  // Save current state before switching
  if (orders.length > 0 && oldDate) {
    await saveSnapshot(oldDate);
  }

  previousDate = newDate;

  // Try to load snapshot for new date
  const snapshot = await loadSnapshot(newDate);
  if (snapshot) {
    await restoreFromSnapshot(snapshot);
  } else {
    await loadData();
  }
}
```

This lets roasters plan multiple production days in advance without losing their work when switching between dates.

### Batch Calculations

The core calculation logic stayed largely intact from the original React version. It's domain knowledge, not infrastructure:

```typescript
export function calcGroup(
  group: RoastGroup,
  orders: Order[],
  products: Product[],
  leftover: number,
  batchOverrides: Record<string, number> = {}
): GroupCalc {
  const batchWeight = batchOverrides[group.batch_type] ?? 20;
  const roastLossPct = group.roast_loss_pct ?? 0;
  const roastFactor = Math.max(0.001, 1 - roastLossPct / 100);

  // Sum all ordered products for this group
  const items = products
    .filter(p => p.group_id === group.id)
    .map(p => {
      const totalQty = orders
        .filter(o => o.product_id === p.id)
        .reduce((s, o) => s + o.qty, 0);
      return { ...p, totalQty, totalLbs: totalQty * p.lbs };
    })
    .filter(p => p.totalQty > 0);

  const totalLbs = items.reduce((s, i) => s + i.totalLbs, 0);
  const neededRoasted = Math.max(0, totalLbs - leftover);
  const neededGreen = roastLossPct > 0 ? neededRoasted / roastFactor : neededRoasted;
  const batches = neededGreen / batchWeight;

  return {
    totalLbs,
    needed: neededGreen,
    neededRoasted,
    batches,
    batchesUp: Math.ceil(batches),
    batchWeight,
    roastFactor,
    roastLossPct,
    items
  };
}
```

This code came from someone who understands roast loss percentages and batch planning. I didn't need to learn the domain. I just needed to make it multi-tenant and deployable.

## What I Added

### Authentication

Built a simple session-based auth system with bcrypt-hashed passwords:

```typescript
// api/auth/login/+server.ts
const user = await db.get('SELECT * FROM users WHERE username = ?', username);
if (!user || !(await bcrypt.compare(password, user.password))) {
  return json({ error: 'Invalid credentials' }, { status: 401 });
}

const sessionId = crypto.randomUUID();
await db.run(
  'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
  sessionId,
  user.id,
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
);

cookies.set('session_id', sessionId, { path: '/', httpOnly: true, maxAge: 30 * 24 * 60 * 60 });
return json({ success: true });
```

No OAuth, no JWT. Just session cookies and server-side validation. Simple works.

### Database Migrations

Migrations live in `migrations/` and run automatically on startup if needed. The deploy script checks for new migrations and restarts the service:

```sql
-- migrations/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  created_at TEXT NOT NULL
);

-- ... more tables
```

The deploy script handles versioning and restarts:

```bash
#!/bin/bash
CURRENT_VERSION=$(cat /opt/beanledger/VERSION 2>/dev/null || echo "none")
LATEST_VERSION=$(curl -s https://api.github.com/repos/ducks/beanledger/releases/latest | jq -r .tag_name)

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
  echo "Already running latest version"
  exit 0
fi

# Download, extract, restart
curl -L "https://github.com/ducks/beanledger/releases/download/$LATEST_VERSION/beanledger.tar.gz" | tar xz
systemctl restart beanledger
echo "$LATEST_VERSION" > /opt/beanledger/VERSION
```

### Deployment

The production stack is straightforward:
- **SvelteKit** in Node adapter mode (not static)
- **PostgreSQL** for data
- **Systemd** for process management
- **Caddy** for TLS and reverse proxy

No Docker, no Kubernetes. Systemd service file:

```ini
[Unit]
Description=BeanLedger Production Planner
After=network.target postgresql.service

[Service]
Type=simple
User=beanledger
WorkingDirectory=/opt/beanledger
Environment=NODE_ENV=production
Environment=DATABASE_URL=/var/lib/beanledger/db.sqlite
ExecStart=/usr/bin/node build/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## What This Division Reveals

The coffee roaster can now ship features. They understand the domain, they can articulate requirements to Claude, and they get working code.

What they don't need to think about:
- How tenant isolation works
- Where sessions are stored
- How migrations run
- How deploys happen
- How backups work

That's my layer.

This is different from traditional client work. Usually I'm translating requirements into code. Here, the client is writing code and I'm building the platform it runs on.

AI didn't eliminate the need for engineering. It shifted the boundary.

The roaster went from "I need software" to "I built the features, can you make it production-ready?" That's a meaningful change.

## What Works

- **CSV import** with inline group creation (no context switching to Catalog)
- **Production snapshots** that save/restore daily plans automatically
- **Dynamic batch types** - users define their own batch sizes, not hardcoded
- **Multi-tenant** - multiple roasters can use the same deployment
- **Pick lists** with package size summaries and roast group breakdowns

## What Doesn't

- **No API** - It's a web app, no programmatic access
- **Limited reports** - Just basic CSV export, no analytics
- **No mobile app** - Responsive web only
- **Single database** - No read replicas or sharding (doesn't need it yet)

## Reflections

The best part of this project was watching someone with domain expertise build software directly. They didn't need to translate "how batch calculations work" into a spec for me to implement. They knew it, and they told Claude.

The boundary between developer and non-developer is blurring. Not because everyone needs to learn to code, but because AI is good enough at the translation layer that domain knowledge can drive implementation.

What still requires engineering judgment:
- Multi-tenancy architecture
- Security and authentication
- Deployment and reliability
- Database design and migrations
- Production monitoring

Those aren't going away. But the surface area of "things only developers can build" is shrinking.

BeanLedger works. It's in production. The person who built most of the features isn't a software engineer.

That's new.

## Links

- [BeanLedger on GitHub](https://github.com/ducks/beanledger)
