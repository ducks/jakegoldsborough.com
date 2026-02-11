---
title: "llm-mux: Why I Rebuilt Lok"
date: 2026-02-11
description: "Lok got 300+ installs, then I rewrote it. The abstractions were
  wrong. llm-mux has roles, teams, and proper apply/verify. Here's why."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

Lok hit 317 cargo installs. People were using it. So naturally I rewrote it from
scratch.

That's not as chaotic as it sounds. Lok grew organically from "query multiple
LLMs" to "run workflows" to "apply edits" to "create GitHub issues." Each feature
bolted onto the side. The codebase worked but the abstractions were wrong.

llm-mux is what lok should have been from the start.

## What Was Wrong

Lok conflates backends with tasks. When you write `backend = "claude"` in a
workflow step, you're coupling your workflow to a specific model. Want to swap
Claude for Gemini? Edit every step.

Lok also has no concept of project context. A Rust project needs `cargo test`
for verification. A Node project needs `npm test`. In lok, you hardcode these
per-workflow. Switch projects, rewrite workflows.

The apply_edits feature was bolted on late. It works but there's no retry loop,
no structured verification, no rollback without git-agent.

## Roles

llm-mux introduces roles. Instead of hardcoding backends:

```toml
# lok style - backend hardcoded
[[steps]]
name = "analyze"
backend = "claude"
prompt = "Find bugs"
```

You declare what kind of task it is:

```toml
# llm-mux style - role-based
[[steps]]
name = "analyze"
type = "query"
role = "analyzer"
prompt = "Find bugs"
```

Then configure which backends handle which roles:

```toml
[roles.analyzer]
description = "Code analysis tasks"
backends = ["claude", "codex"]
execution = "parallel"

[roles.quick]
description = "Fast local checks"
backends = ["qwen"]
execution = "first"
```

Swapping backends is a config change, not a workflow rewrite. The workflow says
"I need analysis." The config decides who does analysis.

## Teams

Teams add project context:

```toml
[teams.rust]
description = "Rust projects"
detect = ["Cargo.toml"]
verify = "cargo clippy && cargo test"

[teams.rust.roles.analyzer]
backends = ["claude", "codex"]
```

When llm-mux detects `Cargo.toml`, it activates the rust team. Verification
commands come from the team. Role mappings can be overridden per-team.

Same workflow, different projects, correct tooling.

## HTTP Backends

Lok only does CLI. You shell out to `claude`, `codex`, `ollama run`. Each query
spawns a process.

llm-mux supports both CLI and HTTP:

```toml
[backends.claude]
command = "claude"
args = ["-p", "--"]

[backends.openai]
command = "https://api.openai.com/v1"
model = "gpt-4"
api_key = "${OPENAI_API_KEY}"

[backends.local]
command = "http://localhost:11434/v1"
model = "llama3"
```

If the command starts with `http`, it's HTTP. Otherwise CLI. HTTP is faster for
high-volume workflows. No process overhead. Proper streaming. Rate limit handling.

## Apply and Verify

Lok's apply_edits was a boolean flag. llm-mux has a real system:

```toml
[[steps]]
name = "fix"
type = "apply"
source = "steps.analyze"
verify = "cargo test"
verify_retries = 3
verify_retry_prompt = "Fix failed: {{ error }}. Try again."
rollback_on_failure = true
```

The flow:

1. Parse edits from source step
2. Apply edits
3. Run verification
4. If it fails and retries remain, show error to LLM, try again
5. If all retries fail, rollback

The retry loop is the difference. Instead of failing on first bad edit, llm-mux
shows the error and asks for a fix. Most failures are small mistakes a second
attempt catches.

Rollback uses git stash. No external tooling.

## An Example

The rust-audit workflow runs four parallel audits and writes structured docs:

```bash
llm-mux run rust-audit
llm-mux run rust-audit outdir=reports/feb-audit
```

Output:

```
docs/audit/
├── README.md          # Summary table
├── 01-safety.md       # Memory safety
├── 02-performance.md  # Perf issues
├── 03-errors.md       # Error handling
└── 04-idioms.md       # Patterns
```

Each audit is its own query step. Each saves to a file. The final step synthesizes
a summary. The `outdir` argument makes it reusable.

## What llm-mux Is Not

llm-mux is not a replacement for lok's CLI commands. There's no `llm-mux ask` or
`llm-mux hunt`. It's purely a workflow runner.

If you want quick one-off queries, use lok. If you want structured multi-step
pipelines with proper abstractions, use llm-mux.

I'm keeping both. They solve different problems.

## What Doesn't Work Yet

The template system is powerful but error messages are cryptic. A typo in a Jinja
variable gives you a wall of minijinja internals.

HTTP backend streaming works but the progress output is ugly. You see chunks
arrive but it's not as clean as the CLI backend output.

Team auto-detection is basic. It looks for files but doesn't understand monorepos
or nested projects yet.

## Getting Started

```bash
cargo install llm-mux
llm-mux doctor
llm-mux run rust-audit
```

Config goes in `~/.config/llm-mux/config.toml`. Workflows go in
`.llm-mux/workflows/` or `~/.config/llm-mux/workflows/`.

Source at [github.com/ducks/llm-mux](https://github.com/ducks/llm-mux).

---

Lok was the prototype. llm-mux is the product. The 317 people using lok helped
me figure out what the abstractions should be.
