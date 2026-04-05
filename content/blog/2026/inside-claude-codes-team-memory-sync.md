---
title: "Inside Claude Code's Team Memory Sync Engine"
date: 2026-04-05
description: "How Claude Code shares knowledge across your team: a file watcher, delta sync, secret scanner, and optimistic concurrency -- all hidden behind a directory you didn't know existed."
taxonomies:
  tags:
    - ai
    - tools
    - dev
---

Most people using Claude Code don't know it has a shared memory system. A
directory on disk that syncs to Anthropic's servers, merges with your
teammates' memories, and gets injected into every conversation. No git
involved. No manual sharing. It just works.

I found it while reading the leaked source. A `teamMemorySync/` directory
with six files: a sync engine, a file watcher, a secret scanner, type
definitions, a path validator, and prompt integration. About 800 lines of
TypeScript implementing a real-time collaborative knowledge base inside a
CLI tool.

## What Team Memory Is

Team memory is a flat key-value store scoped per repository. Keys are file
paths like `MEMORY.md` or `patterns.md`. Values are UTF-8 content, typically
markdown. It lives at:

```
~/.claude/projects/<project-hash>/memory/team/
```

Every authenticated user in your organization who works in the same repo
shares this directory. When one person writes a memory file, it syncs to the
server and gets pulled into everyone else's session.

The system prompt tells Claude about both memory directories:

> You have a persistent, file-based memory system with two directories: a
> private directory at `<auto-path>` and a shared team directory at
> `<team-path>`.

Claude reads the team `MEMORY.md` index at session start and can access any
file in the team directory. When it saves a memory, it decides whether to
put it in private or team based on the content type.

## The Sync Engine

The sync logic in `teamMemorySync/index.ts` handles three operations: pull,
push, and hash comparison.

### Pull (server to local)

On session start, Claude Code fetches the team memory for your repo:

```
GET /api/claude_code/team_memory?repo={owner/repo}
```

The response includes all entries (key-value pairs), per-entry SHA-256
checksums, a version number, and an overall checksum. Server wins -- pull
overwrites local files. If the server returns a 304 (ETag matches), nothing
happens.

### Push (local to server)

When you edit a team memory file, the watcher triggers a push. But it
doesn't upload everything -- it computes a delta:

1. Hash each local file with SHA-256
2. Compare against `serverChecksums` (cached from the last pull/push)
3. Only upload files whose hash differs

```
PUT /api/claude_code/team_memory?repo={owner/repo}
```

The PUT uses upsert semantics -- keys not in the request are preserved on
the server. This means pushing a single changed file doesn't delete
everything else.

There's also a body size cap of 200KB per request. If the delta exceeds
that, it splits into sequential PUTs. Each one merges safely because of
the upsert semantics.

### Conflict Resolution

Optimistic concurrency via ETags. Every push includes the last-known
checksum as `If-Match`. If someone else pushed in between, you get a
412 Precondition Failed.

The conflict resolution is clever. Instead of pulling the full content
(potentially 300KB), it fetches just the checksums:

```
GET /api/claude_code/team_memory?repo={owner/repo}&view=hashes
```

This returns per-key hashes without the actual content. The client updates
its `serverChecksums` map, recomputes the delta, and retries the push
with the new ETag. Up to 2 conflict retries before giving up.

## The File Watcher

A `fs.watch` on the team memory directory, debounced at 2 seconds. When
a file changes:

1. Wait 2s for more changes (debounce)
2. If a push is already in progress, mark `hasPendingChanges`
3. When the current push finishes, if `hasPendingChanges`, push again
4. On permanent failure (auth error, too many entries), suppress the
   watcher to prevent infinite retry loops

The watcher is careful about one edge case: when a pull writes server
content to local files, those writes trigger watch events. Without
suppression, you'd get a pull-then-immediate-push loop. The watcher
skips events during pull operations.

## The Secret Scanner

Before any push, every file is scanned for credentials. The scanner uses
30+ regex patterns adapted from gitleaks (MIT licensed), covering:

- **Cloud providers**: AWS access keys, GCP API keys, Azure AD secrets,
  DigitalOcean tokens
- **AI APIs**: Anthropic keys (`sk-ant-api03-...`), OpenAI keys, HuggingFace
  tokens
- **Version control**: GitHub PATs/OAuth/app tokens, GitLab PATs/deploy tokens
- **Communication**: Slack bot/user/app tokens, Twilio, SendGrid
- **Dev tools**: NPM tokens, PyPI upload tokens, HashiCorp TF tokens,
  Databricks, Pulumi, Postman
- **Payment**: Stripe keys, Shopify tokens
- **Crypto**: PEM private key blocks

Files with detected secrets are silently skipped -- not uploaded, not
deleted locally, not reported to the server. The push result includes which
files were skipped and why, so the system can inform the user.

The patterns are curated for near-zero false positives. They only match
distinctive prefixes (`ghp_`, `sk-ant-`, `xoxb-`, `AKIA`, etc.) rather
than generic keyword patterns. The comment in the source:

> Uses a curated subset of high-confidence rules from gitleaks -- only
> rules with distinctive prefixes that have near-zero false-positive
> rates are included. Generic keyword-context rules are omitted.

One interesting detail: the Anthropic API key pattern assembles its prefix
at runtime (`['sk', 'ant', 'api'].join('-')`) so the literal string doesn't
appear in the compiled bundle. They have an internal `excluded-strings.txt`
check that greps build output for sensitive strings -- the secret scanner
would trip its own detection if the prefix were hardcoded.

## Path Safety

Team memory files arrive from the server with relative paths as keys. The
path validator in `teamMemPaths.ts` prevents directory traversal attacks:

- Rejects paths containing `..` after normalization
- Resolves symlinks and checks the canonical path stays inside the team
  memory directory
- Rejects absolute paths
- Throws a `PathTraversalError` if a key would escape the sandbox

This matters because the server response drives file writes. A malicious
or compromised server could theoretically send a key like
`../../../.bashrc` -- the path validator prevents that.

## How Claude Uses It

The team memory directory gets loaded into the system prompt alongside the
private memory. Claude sees both and is instructed on when to use each:

- **Private memories**: things specific to one user (preferences, role,
  feedback on how to work with them)
- **Team memories**: shared project knowledge (architecture decisions,
  patterns, conventions, ongoing initiatives)

The prompt is explicit about what NOT to put in team memory:

> You MUST avoid saving sensitive data within shared team memories. For
> example, never save API keys or user credentials.

When Claude writes a memory, it chooses the directory based on content type.
User preferences go private. Project patterns go team. The two indexes
(`MEMORY.md` in each directory) are both loaded into context.

## Size Limits

- **Per file**: 250KB max (filtered client-side before upload)
- **Per PUT body**: 200KB (splits into sequential requests if exceeded)
- **Entry count**: server-enforced, tunable per-org (no client-side default)
- **API timeout**: 30 seconds

When the server rejects a push for too many entries, it returns a structured
413 with the limit:

```json
{
  "error": {
    "details": {
      "error_code": "team_memory_too_many_entries",
      "max_entries": 100,
      "received_entries": 142
    }
  }
}
```

The client caches the `max_entries` value and truncates on subsequent pushes.

## Requirements

Team memory requires:
- OAuth authentication (not API key, not Bedrock/Vertex)
- `user:inference` and `user:profile` scopes
- A git repo with a remote (used to derive `owner/repo` slug)

It's designed for Claude.ai Team and Enterprise plans, but works for Pro/Max
too. Bedrock and Vertex users are excluded -- the sync endpoint requires
first-party Anthropic auth.

## What's Interesting About It

The engineering is solid but the concept is what stands out. Most AI coding
tools treat each session as isolated. Your context disappears when you close
the terminal. If your teammate learned something useful, you have to
rediscover it.

Team memory makes knowledge accumulate. One person documents a tricky API
pattern, and every future conversation in that repo -- by anyone on the
team -- gets that context. Without checking anything into git, without
sharing a doc, without telling anyone. The AI just knows because the
team taught it.

The secret scanner is the paranoid layer that makes this possible. Shared
memory across a team is a liability if it leaks credentials. Scanning
before upload, with patterns that match real secret formats instead of
guessing from keywords, is the right approach.

The sync engine is pragmatic. Server wins on pull. Upsert on push. ETag
for conflicts. No CRDT, no operational transform, no fancy merge. Just
"last write wins per key" with checksums to avoid unnecessary uploads.
For markdown files that humans edit infrequently, it's the right level
of complexity.

---

Found by reading the Claude Code source that leaked via npm source maps on
March 31, 2026. The team memory system lives in
`src/services/teamMemorySync/` and `src/memdir/teamMemPaths.ts`.
