---
title: "ARF: Structured Reasoning for AI Agents"
date: 2026-02-02
description: "Moving beyond chat prompts to structured agent communication.
  Why unstructured data lets LLMs run wild, and how ARF enforces
  what/why/how before acting."
taxonomies:
  tags:
    - rust
    - ai
    - oss
---

### The Problem with Prompts

The deeper I get into building with LLMs, the more I realize the "chat prompt"
model works but could be better.

When you give an agent an unstructured prompt, it runs with it. Sometimes
brilliantly. Sometimes it hallucinates a photographer named "Chris Lawton"
because it couldn't parse a webpage and decided to make something up instead
of saying "I don't know." The lack of structure means the agent decides what
matters, what to skip, and what to invent.

This is fine for casual Q&A. It falls apart when you're building tools that
need to be auditable, reviewable, or predictable.

### From lok to ARF

I've been building [lok](https://github.com/ducks/lok), an LLM orchestration
tool that runs multi-step workflows across different backends. One thing
became clear: the more structure I added, the better the results.

Workflows with explicit steps, defined inputs, and expected outputs work.
Workflows that just say "figure it out" produce garbage as often as gold.

This led to a question: what if we standardized how agents communicate their
reasoning? Not just "here's my answer" but "here's what I'm doing, why I'm
doing it, how I plan to do it, and what I'll do if it fails."

The result is ARF (Agent Reasoning Format), a simple spec for structured
agent reasoning.

### The Format

ARF records are TOML files with required and optional fields:

```toml
what = "Add retry logic to API client"
why = "Transient failures causing user-visible errors"
how = "Exponential backoff with 3 retries, circuit breaker after 5 failures"
backup = "Revert to synchronous error handling if latency increases"
timestamp = "2026-02-02T15:14:32Z"
commit = "8ae882e6"
```

Two fields are required:
- **what**: The concrete action being taken
- **why**: The reasoning behind the approach

Two fields are recommended:
- **how**: Implementation details
- **backup**: Rollback plan if it fails

The backup field is the interesting one. Forcing agents to declare a rollback
plan before acting means they have to think about failure modes. It's the
difference between "I'll refactor this function" and "I'll refactor this
function, and if tests fail I'll revert to the original implementation."

### Storage: Orphan Branches

ARF records need to live somewhere. The options were:
1. Git notes (invisible, sync friction)
2. Nested repo (coordination overhead)
3. Orphan branch (separate history, same repo)

I ran a [lok debate](https://github.com/ducks/lok) across four LLM backends
to evaluate the tradeoffs. All four converged on orphan branches.

The approach uses git worktrees to mount an orphan branch at `.arf/`:

```
your-repo/
├── .arf/              # Mounted worktree (arf branch)
│   └── records/
│       └── 8ae882e6/  # Records by commit SHA
│           └── claude-20260202-151432.toml
├── .git/
└── src/
```

Records are organized by commit SHA. When you record reasoning, it links to
the commit you're working on. The `.arf/` directory is gitignored from the
main branch but has its own history on the orphan branch.

This keeps reasoning history completely separate from code history. You can
push, pull, and sync reasoning records without touching your main branch.

### The CLI

The reference implementation is a Rust CLI:

```bash
# Initialize ARF tracking
arf init

# Record reasoning for current work
arf record --what "Add graph command" \
           --why "Need unified view of git history with reasoning"

# View reasoning log
arf log

# Combined visualization
arf graph
```

The `arf graph` command shows git commits alongside their reasoning records:

```
Git + ARF History:

├─● 8ae882e Add diff command with ARF reasoning context
│  └─ what: Add diff command
│      why: Combine git diff with ARF reasoning for full context review
│      how: Shows reasoning header then git show output
├─● 5604413 Add graph command for unified git+arf visualization
│  └─ what: Add graph command
│      why: User requested visualization combining git commits with reasoning
│      how: Matches commit SHAs to .arf/records/ directories
├─● 8ec6c98 Add ARF CLI reference implementation
│  └─ what: Implement ARF CLI v0.1
│      why: Need reference implementation for spec
│      how: Rust CLI with init/record/log/sync commands
└─● 3384a83 Initial ARF spec v0.1
```

The `arf diff` command shows a single commit with reasoning context:

```
═══════════════════════════════════════════════════════════════
Commit: 8ae882e Add diff command with ARF reasoning context
═══════════════════════════════════════════════════════════════

REASONING:
  what: Add diff command
  why:  Combine git diff with ARF reasoning for full context review
  how:  Shows reasoning header then git show output

───────────────────────────────────────────────────────────────
CHANGES:

 src/main.rs | 118 +++++++++++++++++++++++++++
 1 file changed, 118 insertions(+)
```

This is "review the reasoning, not just the diff."

### Why This Matters

The shift happening in AI tooling is from unstructured to structured. Chat
interfaces are training wheels. Production systems need:

- **Declared intent**: What are you trying to do?
- **Explicit reasoning**: Why this approach?
- **Failure planning**: What if it breaks?
- **Audit trails**: What happened and why?

ARF is one piece of this. It's not a replacement for git commit messages or
PR descriptions. It's a parallel track for capturing reasoning that doesn't
belong in code history but shouldn't be lost.

When an agent makes a change, the diff shows what changed. The ARF record
shows why that approach was chosen over alternatives, what tradeoffs were
considered, and what the rollback plan is.

### Using It

The spec and CLI are on GitHub:
[github.com/ducks/arf](https://github.com/ducks/arf)

Install with Cargo:

```bash
cargo install --git https://github.com/ducks/arf
```

The format is intentionally minimal. Four fields, two required. Easy to
generate, easy to parse, easy to extend.

If you're building agent tooling and want structured reasoning, try it out.
