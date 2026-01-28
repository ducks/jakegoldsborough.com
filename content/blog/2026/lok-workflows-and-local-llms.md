---
title: "Lok Part 2: Workflows and Local LLMs"
date: 2026-01-25
description: "Declarative multi-step pipelines and Ollama integration. The workflow system that's also a plugin system."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

Since [introducing Lok](/blog/2026/introducing-lok-multi-llm-orchestration/), two
features emerged from actual use: local LLM support via Ollama, and a declarative
workflow engine. Both solve real problems I hit while using the tool.

## Ollama: Local LLMs Without the API Tax

Cloud APIs are great until they're not. Rate limits, quota exhaustion, latency
spikes, privacy concerns. Sometimes you just want to run a model locally and not
worry about any of that.

Ollama runs LLMs on your machine via a simple HTTP API. Lok now supports it as a
first-class backend:

```toml
# ~/.config/lok/lok.toml
[backends.ollama]
enabled = true
command = "http://localhost:11434"
model = "llama3.2"
```

```bash
lok ask --backend ollama "Explain this function"
```

The implementation is straightforward. Ollama exposes a `/api/chat` endpoint that
accepts JSON. No CLI binary to shell out to, no stdout parsing. Just HTTP.

```rust
async fn chat(&self, prompt: &str) -> Result<String> {
    let request = ChatRequest {
        model: self.model.clone(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }],
        stream: false,
    };

    let response = self.client
        .post(format!("{}/api/chat", self.base_url))
        .json(&request)
        .send()
        .await?;

    // Parse response...
}
```

**When to use Ollama:**
- Privacy-sensitive codebases that can't hit external APIs
- Avoiding rate limits during intensive analysis sessions
- Cost control (no per-token billing)
- Offline development environments

**Trade-offs:**
- Slower than cloud APIs on most hardware
- Model quality depends on what you can run locally
- Requires Ollama running as a daemon

In practice, I use Ollama for synthesis steps where I'm combining outputs from
faster cloud models. The final summarization doesn't need to be fast, it needs
to be private and reliable.

## Workflows: Declarative Multi-Step Pipelines

Single-shot LLM calls are useful, but real analysis often requires multiple
passes. First a fast scan, then a deep investigation, then synthesis. Doing this
manually means copy-pasting outputs between commands.

Workflows solve this by defining multi-step pipelines in TOML:

```toml
# ~/.config/lok/workflows/security-review.toml
name = "security-review"
description = "Multi-pass security review with synthesis"

[[steps]]
name = "initial-scan"
backend = "codex"
prompt = "Find obvious security issues: injection, auth bypass, hardcoded secrets"

[[steps]]
name = "deep-audit"
backend = "claude"
depends_on = ["initial-scan"]
prompt = """
Review these findings and investigate deeper:
{{ steps.initial-scan.output }}
"""

[[steps]]
name = "synthesize"
backend = "ollama"
depends_on = ["initial-scan", "deep-audit"]
prompt = """
Combine into a prioritized report:
Initial: {{ steps.initial-scan.output }}
Deep: {{ steps.deep-audit.output }}
"""
```

Run it with:
```bash
lok run security-review
```

The output:
```
Running workflow: security-review
Multi-pass security review with synthesis
==================================================

[step] initial-scan
  ✓ (2.3s)
[step] deep-audit
  ✓ (8.1s)
[step] synthesize
  ✓ (4.2s)

==================================================

Results:

[OK] initial-scan (2.3s)

  Found 5 potential issues:
  1. src/api/auth.rs:45 - SQL string interpolation
  ...

[OK] deep-audit (8.1s)

  Investigated the SQL interpolation finding...
  ...

[OK] synthesize (4.2s)

  ## Security Review Summary

  ### Critical (1)
  - SQL injection in auth.rs...
```

### Variable Interpolation

The `{{ steps.NAME.output }}` syntax passes previous step outputs into subsequent
prompts. The workflow engine does a simple regex replacement before sending the
prompt to the backend.

This is the key feature that makes workflows useful. Without it, you'd need
manual copy-paste between steps. With it, you can build arbitrary pipelines
where each step builds on previous results.

### Dependency Resolution

Steps declare dependencies with `depends_on`. The engine performs a topological
sort to determine execution order. Steps without dependencies can run in
parallel (though the current implementation runs sequentially for simplicity).

```toml
[[steps]]
name = "patterns"
backend = "codex"
prompt = "Find code patterns"

[[steps]]
name = "dead-code"
backend = "codex"
prompt = "Find dead code"

[[steps]]
name = "synthesize"
backend = "claude"
depends_on = ["patterns", "dead-code"]
prompt = """
Combine findings:
Patterns: {{ steps.patterns.output }}
Dead code: {{ steps.dead-code.output }}
"""
```

The first two steps have no dependencies, so they could run concurrently. The
third step waits for both to complete before running.

### Conditional Execution

Steps can include a `when` clause for conditional execution:

```toml
[[steps]]
name = "emergency-fix"
backend = "claude"
depends_on = ["scan"]
when = "steps.scan.output contains 'critical'"
prompt = "Propose immediate fixes for critical issues..."
```

If the condition isn't met, the step is skipped with a `[skip]` message. This
keeps workflows from doing unnecessary work.

### Workflow Discovery

Workflows are loaded from two locations:
- `.lok/workflows/` in the current directory (project-local)
- `~/.config/lok/workflows/` (global)

Project-local workflows override global ones with the same name. This lets you
define team-wide workflows globally while allowing project-specific overrides.

```bash
lok workflow list
```

```
Available workflows:

  security-review (global)
    Multi-pass security review with synthesis
    3 steps

  code-quality (global)
    Multi-backend code quality analysis
    3 steps

  rails-audit (local)
    Rails-specific security checks
    4 steps
```

## The Plugin System Realization

Here's the thing I didn't plan: workflows are plugins.

When you define a workflow, you're creating a reusable command. `lok run
security-review` isn't calling a built-in feature. It's loading a TOML file and
executing it. The "plugin" is just configuration.

This means:
- No compilation needed to add new capabilities
- Share workflows by copying TOML files
- Customize existing workflows without touching Rust code
- Version control your workflows alongside your code

A future `lok workflow install` could fetch workflows from URLs:

```bash
lok workflow install https://example.com/rails-audit.toml
lok run rails-audit
```

The plugin system is the workflow system. No separate concepts needed.

## The Real Conductor: Your LLM Session

Here's the pattern that actually works best: use your existing LLM as the
conductor, and call lok as a tool.

I run Claude Code as my daily driver. When I need multi-model analysis, I don't
switch to `lok conduct`. I just ask Claude to use lok:

```
Me: Find performance issues in this codebase

Claude: [runs: lok ask --backend codex "Find N+1 queries and performance issues"]

Claude: I found 3 N+1 queries in the controllers. Let me get a second
        opinion on the caching strategy...

Claude: [runs: lok ask --backend gemini "Review caching approach in lib/cache.rb"]

Claude: Based on both analyses, here's what I'd prioritize...
```

The LLM session becomes the orchestration layer. It sees results, reasons about
them, decides when to query other backends. No need for lok to implement its own
multi-round conversation loop.

This works because lok is just a command. It doesn't try to be a chat interface
or maintain conversation state. It does one thing: send a prompt to backends and
return results. The intelligence stays in the LLM that's already running.

The workflow engine complements this. For repeatable multi-step analysis, define
a workflow. For exploratory work where you need to reason about intermediate
results, let your LLM call lok directly.

## Putting It Together

Here's my actual workflow for auditing a new codebase:

```
Me: Audit this codebase for security issues

Claude: [runs: lok run security-review]

Claude: The workflow found 5 issues. The SQL interpolation in auth.rs
        looks serious. Let me investigate...

Claude: [runs: lok ask --backend gemini "Is the SQL in auth.rs:45 exploitable?"]

Claude: Gemini confirms it's exploitable. I'll draft a fix...
```

Workflows handle the repeatable multi-step analysis. Claude handles the
reasoning and follow-up questions. Lok is just the interface to multiple
backends. Each layer does what it's good at.

## What's Next

The dead code that `lok hunt` found in its own codebase still needs cleanup.
There's also the question of parallel step execution in workflows, which would
make multi-backend pipelines faster.

But the core loop is solid: define workflows in TOML, run them with one command,
get multi-model analysis without the manual coordination tax.

The source is at [github.com/ducks/lok](https://github.com/ducks/lok).

---

Previous: [Introducing Lok](/blog/2026/introducing-lok-multi-llm-orchestration) |
Next: [Part 3: Dogfooding and Code Review](/blog/2026/lok-dogfooding-and-code-review)
