---
title: "Introducing Lok: A Local Multi-LLM Orchestration Control Plane"
date: 2026-01-24
description: "When one AI isn't enough. Lok is a CLI tool that coordinates multiple LLM backends, routing tasks to the right model and letting them debate each other."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

Large language models are getting better, but they're also getting more
specialized. Some are fast and direct for pattern matching. Others are slower
but excel at deep, multi-step reasoning. If you work on real codebases, you've
probably felt the pain: no single model is "best" for every task, and switching
between tools manually is a constant tax.

That's the problem Lok solves.

## The Brain That Controls the Arms You Already Have

Lok is a local orchestration layer that coordinates multiple LLM backends
through one control plane. It wraps existing CLIs like OpenAI's Codex and
Google's Gemini, treating them as pluggable backends with a unified interface.

The key insight: model choice isn't a preference anymore. It's part of the
engineering workflow. When your toolchain includes multiple LLMs, you need
orchestration.

```bash
lok hunt .          # Bug hunt with smart backend selection
lok audit .         # Security audit
lok team "analyze"  # Coordinated multi-model analysis
lok debate "async?" # Let the models argue
lok spawn "task"    # Parallel agents on subtasks
```

```
                            ┌─────────────┐
                            │    USER     │
                            │   (task)    │
                            └──────┬──────┘
                                   │
                                   ▼
            ┌──────────────────────────────────────────┐
            │           CONDUCTOR (BRAIN)              │
            │                                          │
            │  • Analyze task complexity               │
            │  • Break into parallel subtasks          │
            │  • Assign backends via delegator         │
            └──────────────────┬───────────────────────┘
                               │
      ┌────────────────────────┼────────────────────────┐
      │                        │                        │
      ▼                        ▼                        ▼
┌───────────┐            ┌───────────┐            ┌───────────┐
│  AGENT 1  │            │  AGENT 2  │            │  AGENT 3  │
│ "frontend"│            │ "backend" │            │ "database"│
│  [CODEX]  │            │ [GEMINI]  │            │  [CODEX]  │
└─────┬─────┘            └─────┬─────┘            └─────┬─────┘
      │                        │                        │
      │     ══ PARALLEL EXECUTION ══                    │
      │                        │                        │
      └────────────────────────┼────────────────────────┘
                               │
                               ▼
            ┌──────────────────────────────────────────┐
            │         SUMMARIZATION PHASE              │
            │                                          │
            │  • Collect all agent outputs             │
            │  • Report success/failure per agent      │
            │  • Aggregate into final summary          │
            └──────────────────────────────────────────┘
```

## Mode Comparison

| Mode    | Backends Used | Execution     | Use Case                          |
|---------|---------------|---------------|-----------------------------------|
| smart   | 1 (best fit)  | Single call   | Fast, targeted tasks              |
| team    | 1-3           | Sequential    | Analysis + optional peer review   |
| debate  | 2+            | 3 rounds      | High-stakes decisions             |
| spawn   | 2-4           | Parallel      | Complex tasks with subtasks       |

## Smart Delegation: The Right Tool for the Job

Not every task requires the most expensive, reasoning-heavy model. Conversely,
complex security audits shouldn't be handled by a model optimized for speed.

Lok's delegator (`src/delegation.rs`) routes tasks based on keyword matching and
task classification:

- **N+1 queries, code smells, dead code**: fast, pattern-matching models (Codex, Claude Haiku)
- **Security audits, architecture reviews**: thorough, investigative models (Gemini, o1)
- **General questions**: whatever's available (first responsive backend)

The routing logic is straightforward: task descriptions are tokenized and matched
against known patterns. If the task contains "security", "audit", "vulnerability",
it routes to investigative models. If it contains "find", "search", "pattern", it
routes to fast models. No ML involved - just conditional routing based on task
characteristics.

```bash
lok smart "Find N+1 queries"           # Routes to Codex
lok smart "Security audit"              # Routes to Gemini
lok suggest "Find SQL injection"        # Shows routing decision without running
```

**When routing fails**: If the chosen backend is unavailable, Lok falls back to
the next-best available backend. If all backends fail, you get a clear error
message listing what's offline.

## Debate Mode: Built-In Skepticism

Single-model answers are often too confident. Debate mode turns that into a
feature by making backends disagree on purpose.

In `lok debate`, each backend responds in multiple rounds. They see each other's
answers and can challenge them. Round 1 is initial positions. Round 2 is
responses to each other's positions. Round 3 is final synthesis by a judge
model that weighs all perspectives.

```bash
lok debate "What's the best way to handle auth?"
```

**How synthesis works**: The judge model receives all responses with their
round numbers and prompts: "Given these competing perspectives, identify points
of agreement, highlight unresolved disagreements, and synthesize a final
recommendation that acknowledges tradeoffs."

This catches two failure modes:
- **False confidence**: A single model confidently recommending an antipattern
- **Blind spots**: One model missing a constraint that another catches

The cost is 3x the API calls and 2-4x the latency. Use it for decisions where
being wrong is expensive.

## Team Mode: Coordinated Analysis

Team mode combines smart delegation with optional debate. It orchestrates the
backends like a small group:

1. Choose the best available backend for the task
2. If debate is enabled, ask others to review or challenge
3. Synthesize a final result

```bash
lok team "Analyze this codebase for issues"
lok team --debate "Should we use async here?"
```

This gives you both the speed of a model that's good at the task and the rigor
of peer review. In practice, it feels like having a lead engineer and two
reviewers that don't get tired.

## Spawn Mode: Parallel Agent Execution

Spawn takes the coordination further. Instead of routing a single task to the
best backend, it breaks a complex task into parallel subtasks and runs multiple
agents simultaneously.

```bash
lok spawn "Build a todo app with frontend and backend"
```

The flow:

1. **Plan**: An LLM breaks the task into 2-4 independent subtasks
2. **Delegate**: Each subtask gets assigned to the best available backend
3. **Execute**: All agents run in parallel with shared context
4. **Summarize**: Results are collected and aggregated

You can also specify agents manually:

```bash
lok spawn "Build an app" \
  --agent "api:Build REST endpoints" \
  --agent "ui:Build React components" \
  --agent "db:Design the schema"
```

This is the conductor pattern in CLI form. A brain that plans, delegates to
specialized workers, and synthesizes results. The same pattern that makes
human teams effective, applied to LLM orchestration.

## The Naming Story

"Lok" has two meanings, both relevant.

**Locomotive** (Swedish/German: lokomotiv). Lok has a `conduct` command, and the
metaphor is intentional: a conductor sends trained models down the tracks. The
pun on "trained" models is deliberate.

**Sanskrit/Hindi लोक** ("world" or "people"), as in Lok Sabha, the People's
Assembly. Lok's philosophy is a collection of agents working together, not a
single monolithic mind.

The name captures both the engineering (orchestration, routing, coordination)
and the philosophy (collective intelligence, multiple perspectives).

## Configuration: Encode Your Team's Knowledge

Lok works out of the box, but gets more powerful with `lok.toml`:

```toml
[tasks.hunt]
description = "Find bugs and code issues"
backends = ["codex"]
prompts = [
  { name = "n+1", prompt = "Search for N+1 query issues..." },
  { name = "dead-code", prompt = "Find unused code..." },
]

[tasks.audit]
description = "Security audit"
backends = ["gemini"]
prompts = [
  { name = "injection", prompt = "Find SQL injection..." },
  { name = "auth", prompt = "Find auth bypass..." },
]
```

This isn't just configuration. It's a way to encode your team's knowledge about
which model to trust for what. Tasks become repeatable workflows, not one-off
experiments.

## Why This Matters

We're moving away from the era of "Prompt Engineering" and into the era of Flow
Engineering. The quality of an AI output is no longer determined solely by how
clever your prompt is, but by the architecture of the workflow that processes
it.

By formalizing these flows into a CLI tool, Lok brings determinism and
reliability to AI interactions:

1. **Higher signal, lower noise**: Smart delegation keeps the right model on the
   right task
2. **Built-in skepticism**: Debate and team modes catch errors and broaden
   coverage
3. **Parallel execution**: Spawn mode runs multiple agents simultaneously,
   turning sequential workflows into concurrent ones
4. **Repeatable workflows**: Tasks like `lok hunt` become part of your
   engineering rhythm
5. **Local control plane**: No hidden SaaS layer, no opaque routing. You can see
   and customize how it chooses backends

## Before and After: A Real Example

**Without Lok:**
```bash
# Manual workflow for finding Rails performance issues
$ claude "Find N+1 queries in app/controllers"
# Review output, switch tools
$ gemini "Are there better caching strategies?"
# Manually synthesize both answers
# Total time: 5-10 minutes of context switching
```

**With Lok:**
```bash
# Single command, automatic backend selection and synthesis
$ lok team --debate "Analyze Rails app for performance issues"
# Codex finds N+1 queries (fast, pattern-matching)
# Gemini suggests caching strategies (thorough, investigative)
# Judge model synthesizes into prioritized action items
# Total time: 2 minutes, no context switching
```

The value isn't just speed - it's that you get both the exhaustive pattern
matching and the strategic recommendations in one pass, with built-in
skepticism from debate mode catching false positives.

## Getting Started

```bash
# Check what backends you have
lok doctor

# Ask all backends
lok ask "Find performance issues"

# Let them debate
lok debate "Best approach for caching?"

# Smart routing
lok smart "Find N+1 queries"

# Parallel agents
lok spawn "Build a REST API with tests"
```

Lok doesn't replace your LLMs. It coordinates them. That means you keep the
tools you already trust and add orchestration on top.

**Performance characteristics**: Smart routing adds ~50-100ms overhead for task
classification. Debate mode runs 3 rounds sequentially, so expect 3x the
single-model latency. Spawn mode runs agents in parallel, so wall-clock time is
determined by the slowest agent, not the sum of all agents.

The source is at [github.com/ducks/lok](https://github.com/ducks/lok). It's
Rust, it's fast, and it's the brain that makes your AI arms work together.

---

Next: [Part 2: Workflows and Local LLMs](/blog/2026/lok-workflows-and-local-llms)
