---
title: "Rewriting Claude Code in Rust, With Claude"
date: 2026-04-01
description: "Claude Code's TypeScript source leaked via a source map. I read the architecture and rewrote the core in Rust. Using Claude. Here's Part 1."
taxonomies:
  tags:
    - ai
    - rust
    - tools
    - dev
---

Claude Code's source leaked on March 31st. A source map in the npm package
pointed to unobfuscated TypeScript hosted on Anthropic's R2 bucket. 1,900
files, 512,000 lines.

So I did the obvious thing: I asked Claude to rewrite itself in Rust.

## The Source

The leak was spotted by [Chaofan Shou](https://x.com/Fried_rice/status/2038894956459290963).
A `.map` file in the npm distribution referenced the full `src/` tree. Someone
at Anthropic shipped a source map to production. Classic.

The codebase is TypeScript, runs on Bun, uses React and Ink for the terminal
UI, Commander.js for CLI parsing. It's a real production system with years of
accumulated complexity: feature flags, MCP integration, multi-agent
coordination, voice mode, a permission system with denial tracking, and about
40 tools.

A university student mirrored the source for research. I grabbed a copy.

## What I Was Looking For

I wasn't trying to ship a competitor. I build LLM tooling in Rust already
([llm-tui](https://github.com/ducks/llm-tui),
[llm-mux](https://github.com/ducks/llm-mux)) and I wanted to understand how
Anthropic solved the same problems I'm solving.

How do they handle tool dispatch? How does the conversation loop recover from
context overflow? What does the permission system actually look like under the
hood?

Reading the source answered those questions. Rewriting it in Rust made the
answers stick.

## Architecture: The Parts That Matter

Strip away the React rendering, the plugin system, the MCP server integration,
the voice mode, the telemetry, and the enterprise policy layer. What's left is
a surprisingly clean engine:

1. **Query loop** (`query.ts`, 1,729 lines) — an async generator that sends
   messages to the API, streams responses, dispatches tool calls, collects
   results, and loops. Error recovery for prompt-too-long, rate limits, and
   max-output-tokens. Auto-compaction when context gets full.

2. **Tool system** (`Tool.ts`, 793 lines) — each tool has a schema, a
   `call()` method, permission checking, and concurrency classification.
   Read-only tools can run in parallel. Mutating tools run serially.

3. **Context assembly** (`context.ts`, 190 lines) — builds the system prompt
   from git status, CLAUDE.md files, current date, and environment info.
   Memoized per session.

4. **Permission layer** (`types/permissions.ts`) — five modes from
   "auto-allow everything" to "plan mode, read only." Rules match on tool
   name and input patterns.

5. **Session persistence** (`history.ts`) — JSONL append-only log. Large
   pastes stored separately by hash.

6. **Cost tracking** (`cost-tracker.ts`) — accumulates token usage per model,
   estimates USD cost.

The `QueryEngine` wraps the query loop with session state, slash command
processing, and transcript persistence. That's the whole engine. Everything
else is UI, orchestration, or enterprise features.

## The Rewrite

I asked Claude to read the TypeScript source and write Rust. Not port my
existing projects, not combine anything. A clean rewrite from the source.

It took one session to get a compiling binary. 16 files, about 1,200 lines
of Rust. Here's the structure:

```
claux/src/
  main.rs          # CLI entrypoint (clap)
  cli.rs           # Arg parsing
  config.rs        # Layered TOML config + API key resolution
  api/
    mod.rs         # Claude Messages API client
    types.rs       # Message, ContentBlock, ToolDefinition
    stream.rs      # SSE parser → async channel
  tools/
    mod.rs         # Tool trait + registry
    read.rs        # Read file with line numbers
    write.rs       # Write file
    edit.rs        # Find-and-replace
    glob.rs        # File search by pattern
    grep.rs        # Content search (ripgrep)
    bash.rs        # Shell execution with timeout
  query.rs         # Conversation loop (stream → tools → loop)
  permissions.rs   # Permission modes
  context.rs       # System prompt assembly
  cost.rs          # Token + cost tracking
  commands.rs      # Slash commands (/help, /cost, /exit)
  session.rs       # JSONL session persistence
  repl.rs          # Interactive REPL
```

The core loop in Rust looks like this:

```rust
pub async fn submit(&mut self, user_input: &str) -> Result<String> {
    self.messages.push(Message::user(user_input));

    loop {
        let tool_defs = self.tools.definitions();
        let mut rx = self.client
            .stream(&self.messages, &self.system_prompt, &tool_defs, self.max_tokens)
            .await?;

        let mut text_buf = String::new();
        let mut tool_uses = Vec::new();

        while let Some(event) = rx.recv().await {
            match event {
                ApiEvent::Text(t) => text_buf.push_str(&t),
                ApiEvent::ToolUse { id, name, input } => {
                    tool_uses.push((id, name, input));
                }
                ApiEvent::Usage(usage) => self.cost.add_usage(&usage),
                ApiEvent::Done => break,
                ApiEvent::Error(e) => return Err(anyhow!("API error: {}", e)),
            }
        }

        // Record assistant message
        // ...

        if tool_uses.is_empty() {
            break; // No tools requested, we're done
        }

        // Execute tools, push results, loop back
        // ...
    }

    Ok(full_response)
}
```

Compare to the TypeScript, which is a 1,700-line async generator with
compaction pipelines, reactive recovery, fallback model support, and thinking
block handling. The Rust version is the skeleton. But it works.

## What Maps Cleanly

**Tool trait.** TypeScript's structural tool type becomes a Rust trait:

```rust
#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn input_schema(&self) -> serde_json::Value;
    fn is_read_only(&self) -> bool;
    async fn execute(&self, input: Value) -> Result<ToolOutput>;
}
```

Each tool is its own file, its own struct. The registry holds
`Vec<Box<dyn Tool>>`. Clean.

**SSE streaming.** The TypeScript reads lines from a `BufReader`. The Rust
version reads from a `reqwest` byte stream, splits on newlines, parses JSON
events. Same logic, async instead of blocking.

**Config layering.** Global `~/.config/claux/config.toml` plus project
`.claux.toml`. API key resolution: direct value → command → environment
variable. This pattern appears in both the Claude Code source and my own
projects. It's just correct.

**Permission modes.** The TypeScript has five modes. I started with four. The
mapping is direct.

## What Doesn't Map

**React/Ink.** The entire UI layer is React components rendered to the
terminal via Ink. None of this carries over. The Rust version is an inline
REPL for now. A ratatui TUI comes later.

**Async generators.** The TypeScript query loop is an `AsyncGenerator` that
yields events as they occur. Rust doesn't have generators. I used
`tokio::sync::mpsc` channels instead. Same pattern, different mechanism.

**Feature flags.** Claude Code uses Bun's `feature()` for compile-time dead
code elimination. Different builds for internal vs external, coordinator mode
vs normal. Rust has `cfg!` and cargo features but I'm not shipping multiple
builds.

**The permission UI.** Claude Code's interactive permission prompt is deeply
integrated with the React UI. The Rust version currently auto-approves
everything. Interactive prompts are Phase 3.

## Numbers

| | TypeScript | Rust |
|---|---|---|
| Files | ~1,900 | 16 |
| Lines | ~512,000 | ~1,200 |
| Tools | 44 | 6 |
| Slash commands | 80+ | 4 |
| Dependencies | npm (huge) | 20 crates |
| Build time | instant (Bun) | ~60s first build |

The line count comparison is misleading. The TypeScript includes the full UI,
plugin system, MCP integration, multi-agent coordinator, voice mode, and every
feature Anthropic has shipped over years of development. The Rust version is
Phase 1: chat, tools, and persistence.

But 1,200 lines for a working Claude Code clone that can stream responses,
execute tools, track costs, and persist sessions? That's a decent foundation.

## What's Next

Phase 2 adds slash commands: `/compact` for conversation summarization,
`/resume` for session management. Phase 3 is the permission system with
interactive prompts. Phase 4 is a proper ratatui TUI.

The interesting part isn't the rewrite itself. It's what you learn about
production AI tooling by reading someone else's source and rebuilding it from
scratch. Part 2 will cover the design patterns worth stealing.

---

Source: [github.com/ducks/claux](https://github.com/ducks/claux)
