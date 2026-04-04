---
title: "Rewriting Claude Code in Rust, Part 3: TUI, Agents, and Multi-Provider"
date: 2026-04-04
description: "claux gets a ratatui TUI, sub-agents, and support for any OpenAI-compatible endpoint. One session, start to finish."
taxonomies:
  tags:
    - ai
    - rust
    - tools
    - dev
---

[Part 2](/blog/2026/rewriting-claude-code-in-rust-part-2/) left off at 1,530
lines with an inline REPL, permission prompts, session management, and
compaction. It worked, but it looked like a script, not a tool.

This post covers the rest: a proper TUI, the agent system, and breaking free
from Anthropic-only.

## Phase 4: The TUI

The inline REPL was functional but crude. Print prompt, read line, stream
tokens, repeat. No scroll, no layout, no visual distinction between you and
the assistant.

Claude Code's original UI is React + Ink — React components rendered to the
terminal. That's not happening in Rust. The equivalent is ratatui, which
gives you a layout engine, widgets, and an alternate-screen buffer.

The TUI runs behind `--tui`. The inline REPL stays as the default because
it's simpler and pipes better.

### Layout

Four zones, top to bottom:

```
┌─────────────────────────────────┐
│ claux v20260401.0.1             │  <- header
├─────────────────────────────────┤
│                                 │
│ You                             │
│ > read src/main.rs              │
│                                 │  <- scrollable message area
│ fn main() -> Result<()> {       │
│   let args = Cli::parse();      │
│ ...                             │
│                                 │
├─ > ────────────────────────────-┤  <- input box
│ explain the error handling      │
├─────────────────────────────────┤
│ claude-sonnet-4 | Cost: $0.02   │  <- status bar
└─────────────────────────────────┘
```

Messages are color-coded: blue for user, default for assistant, green for
streaming text, yellow for system messages and permission prompts. Gruvbox
palette because that's what I use everywhere.

### The Hard Part: Async + TUI

The challenge with a terminal UI and an async LLM client is that you can't
`await` the API call and poll terminal events at the same time from the same
thread. The inline REPL solved this by spawning the display as a tokio task
and driving the engine on the main thread. The TUI can't do that — it needs
to own the terminal.

The solution: drive the streaming loop manually with `tokio::select!`. One
arm reads API events, the other polls terminal input with a short timeout.
Ctrl+C during streaming cancels the request.

```rust
loop {
    tokio::select! {
        Some(event) = api_rx.recv() => {
            match event {
                ApiEvent::Text(t) => {
                    app.stream_buffer.push_str(&t);
                    terminal.draw(|f| ui::draw(f, app))?;
                }
                ApiEvent::ToolUse { id, name, input } => {
                    tool_uses.push((id, name, input));
                }
                ApiEvent::Done => break,
                // ...
            }
        }
        _ = tokio::time::sleep(Duration::from_millis(50)) => {
            if event::poll(Duration::from_millis(0))? {
                if let Event::Key(key) = event::read()? {
                    // Handle Ctrl+C, scroll, etc.
                }
            }
        }
    }
}
```

Permission prompts work inline in the TUI. When the engine needs approval,
the input box turns yellow and shows the tool name with `(y)es / (n)o /
(a)lways`. The engine blocks on a oneshot channel until you answer.

### What It Cost

928 lines for the TUI module. Two files: `tui/mod.rs` (app state, event loop,
streaming driver) and `tui/ui.rs` (layout and rendering). The rendering is
naive — no markdown parsing, no syntax highlighting, no word wrap. But it
works and it's fast.

Upgrading to Rust 1.88 was required because ratatui 0.29's dependencies
needed it. The `shell.nix` now uses rust-overlay instead of nixpkgs' rust.

## Phase 5: Agents

The Agent tool is what makes Claude Code feel like it has workers. You ask it
to do something complex, it spawns a sub-conversation with its own context
and a restricted tool set.

In claux, the Agent tool creates a child `Engine`:

```rust
async fn execute(&self, input: Value) -> Result<ToolOutput> {
    let params: Params = serde_json::from_value(input)?;

    let provider = (self.make_provider)();
    let tools = ToolRegistry::without_agent(); // no recursion
    let permissions = PermissionChecker::new(PermissionMode::Bypass);

    let mut engine = Engine::new(provider, tools, permissions, &self.model);
    engine.set_system_prompt(agent_prompt);

    match engine.submit(&params.prompt).await {
        Ok(response) => Ok(ToolOutput {
            content: response,
            is_error: false,
        }),
        // ...
    }
}
```

Three key decisions:

1. **No nested agents.** `ToolRegistry::without_agent()` excludes the Agent
   tool from sub-agents. Prevents infinite recursion.

2. **Bypass permissions.** Agents run unattended. If the parent conversation
   approved the Agent call, the sub-agent's tools don't need individual
   approval.

3. **Own context.** The sub-agent starts with a fresh message history and its
   own system prompt. It doesn't see the parent conversation.

Cost tracking flows back — the agent's token usage is appended to its output
so you can see what it spent.

### Auto-Compact

Phase 5 also added auto-compaction. Before each `submit`, the engine checks
if the message count exceeds 80. If so, it runs the same compaction logic as
`/compact` — summarizes the conversation via the API and replaces history with
the summary.

This is the dumb version of what Claude Code does. Their compaction pipeline
has multiple strategies: reactive compact, context collapse, history snip,
tool-use summaries. Ours is a threshold check and a summarization call. But it
prevents the context window from overflowing, which is the thing that actually
matters.

## Multi-Provider

Up to this point, claux only spoke Anthropic. That's fine for rewriting Claude
Code, but limiting for actual use.

The fix was a `Provider` trait:

```rust
#[async_trait]
pub trait Provider: Send + Sync {
    fn name(&self) -> &str;
    fn model(&self) -> &str;
    fn set_model(&mut self, model: &str);

    async fn stream(
        &self,
        messages: &[Message],
        system: &str,
        tools: &[ToolDefinition],
        max_tokens: u32,
    ) -> Result<mpsc::Receiver<ApiEvent>>;
}
```

Two implementations:

- **AnthropicProvider** — the existing client, extracted into its own file.
  Uses `x-api-key` or `Authorization: Bearer` depending on whether you're
  using an API key or OAuth from `claude login`.

- **OpenAICompatProvider** — speaks the `/v1/chat/completions` streaming
  format. Works with Ollama, vLLM, LMStudio, OpenAI, or any hosted endpoint.

The hard part was message format conversion. Anthropic and OpenAI structure
tool calls differently:

| | Anthropic | OpenAI |
|---|---|---|
| System prompt | Top-level `system` field | System message in array |
| Tool calls | `content_block` with `type: tool_use` | `tool_calls` array on assistant message |
| Tool results | `tool_result` content block | Separate `tool` role message |

The `OpenAICompatProvider` converts between formats on the fly. It also has
its own SSE parser since the streaming JSON structure is different
(`choices[0].delta.content` vs `content_block_delta`).

### Config

```toml
# Anthropic (default)
model = "claude-sonnet-4-20250514"
api_key_cmd = "op read 'op://vault/Anthropic/key'"

# Or any OpenAI-compatible endpoint
model = "Qwen/Qwen3.5-122B-A10B"
openai_base_url = "https://my-endpoint.com/v1"
openai_api_key_cmd = "op read 'op://vault/hosted/key'"
openai_provider_name = "hosted"
```

If `openai_base_url` is set, it uses the OpenAI-compatible provider. Otherwise
Anthropic. The `_cmd` fields run via `sh -c` and capture stdout — works with
1Password, Vault, or any secret manager that has a CLI.

I tested this against a hosted Qwen 3.5 122B model. Streaming, tool execution,
and the full turn loop all work. Same binary, different config, different model.

## Final Numbers

| | Phase 1 | + Phase 2-3 | + Phase 4-5 | + Multi-Provider |
|---|---|---|---|---|
| Files | 16 | 18 | 20 | 26 |
| Lines | 1,200 | 1,530 | 2,640 | 4,000+ |
| Tools | 6 | 6 | 7 (Agent) | 7 |
| Tests | 0 | 0 | 0 | 60 |
| Providers | 1 | 1 | 1 | Any |

All built in one session. The TypeScript original: 1,900 files, 512,000 lines.

## What I'd Do Differently

**Start with the Provider trait.** I hardcoded the Anthropic client in Phase 1
and had to refactor it later. If I'd started with `Box<dyn Provider>`, the
multi-provider change would have been a new file instead of a rewrite.

**Skip the inline REPL.** The TUI is strictly better. The inline REPL exists
because I built it first and kept it for pipe compatibility, but in practice
you'd always use `--tui` or `-p`.

**Add tests from Phase 1.** We bolted on 60 tests at the end. They all passed,
which means they weren't catching regressions — they were documenting existing
behavior. Tests written alongside the code would have caught the `$()` config
issue before it hit production.

## What's Missing

- **Markdown rendering** in the TUI (code blocks, bold, lists)
- **Input history** (up arrow for previous prompts)
- **Token refresh** for OAuth (currently just checks expiry, doesn't refresh)
- **Pattern-based permission rules** (allow `Bash(git *)` without prompting)
- **Retry logic** for rate limits and transient errors
- **Syntax highlighting** in code blocks

These are all polish. The architecture supports them. I'll add them as I use
the tool and hit the gaps.

---

Previous: [Part 2: Sessions, Commands, and Permissions](/blog/2026/rewriting-claude-code-in-rust-part-2/)

Source: [github.com/ducks/claux](https://github.com/ducks/claux)
