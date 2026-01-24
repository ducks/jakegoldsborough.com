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
```

## Smart Delegation: The Right Tool for the Job

Not every task requires the most expensive, reasoning-heavy model. Conversely,
complex security audits shouldn't be handled by a model optimized for speed.

Lok's delegator (`src/delegation.rs`) routes tasks based on their nature:

- **N+1 queries, code smells, dead code**: fast, pattern-matching models
- **Security audits, architecture reviews**: thorough, investigative models
- **General questions**: whatever's available

```bash
lok smart "Find N+1 queries"           # Routes to Codex
lok smart "Security audit"              # Routes to Gemini
lok suggest "Find SQL injection"        # Shows reasoning without running
```

This isn't magic. It's just encoding knowledge about which model to trust for
what. The same knowledge you'd use if you were switching tools manually, but
automated.

## Debate Mode: Built-In Skepticism

Single-model answers are often too confident. Debate mode turns that into a
feature by making backends disagree on purpose.

In `lok debate`, each backend responds in multiple rounds. They see each other's
answers and can challenge them. Round 1 is initial positions. Round 2 is
responses. Round 3 is final synthesis.

```bash
lok debate "What's the best way to handle auth?"
```

This is ideal for high-stakes questions where you want:
- Competing perspectives
- Cross-checks for false positives
- Nuanced recommendations

When two models argue about the best approach, you get surface area for risk,
tradeoffs, and overlooked constraints. The tool literally implements peer
review.

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
3. **Repeatable workflows**: Tasks like `lok hunt` become part of your
   engineering rhythm
4. **Local control plane**: No hidden SaaS layer, no opaque routing. You can see
   and customize how it chooses backends

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
```

Lok doesn't replace your LLMs. It coordinates them. That means you keep the
tools you already trust and add orchestration on top.

The source is at [github.com/ducks/lok](https://github.com/ducks/lok). It's
Rust, it's fast, and it's the brain that makes your AI arms work together.
