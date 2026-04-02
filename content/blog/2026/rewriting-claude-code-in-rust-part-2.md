---
title: "Rewriting Claude Code in Rust, Part 2: Sessions, Commands, and Permissions"
date: 2026-04-02
description: "claux gets session management, compaction, model switching, and an interactive permission system. Three phases in one sitting."
taxonomies:
  tags:
    - ai
    - rust
    - tools
    - dev
---

[Part 1](/blog/2026/rewriting-claude-code-in-rust-with-claude/) got a working
binary. Streaming chat, six tools, cost tracking, JSONL persistence. 1,200
lines of Rust that could talk to Claude and execute Read, Write, Edit, Glob,
Grep, and Bash.

But it was missing the parts that make Claude Code actually usable day-to-day:
session resume, context compaction, model switching, and the permission system
that asks before writing to your filesystem.

This post covers three phases built in one session.

## Phase 2: Commands That Need the Engine

Phase 1's slash commands were simple: `/help` returns a string, `/cost` reads
a counter, `/exit` breaks the loop. They didn't need to touch the conversation
state.

The new commands do. `/compact` rewrites the message history. `/resume` loads
a different session into the engine. `/model` swaps the API model mid-conversation.

The solution was splitting commands into sync and async:

```rust
pub enum CommandResult {
    Text(String),
    Exit,
    Async(AsyncCommand),
}

pub enum AsyncCommand {
    Compact,
    Resume(Option<String>),
    Model(Option<String>),
}
```

Sync commands return text immediately. Async commands get `&mut Engine` and can
do whatever they need.

### Compaction

Claude Code's compaction is elaborate. Multiple strategies: reactive compact,
context collapse, history snip, autocompact. A pipeline that runs sequentially
with fallbacks.

For claux I did the simple version: send the full conversation to Claude
with "summarize this," then replace the history with the summary.

```rust
pub async fn compact(&mut self) -> Result<String> {
    let mut summary_messages = self.messages.clone();
    summary_messages.push(Message::user(
        "Summarize the conversation so far..."
    ));

    // Stream the summary from Claude
    let mut rx = self.client
        .stream(&summary_messages, &self.system_prompt, &[], self.max_tokens)
        .await?;

    let mut summary = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            ApiEvent::Text(t) => summary.push_str(&t),
            ApiEvent::Done => break,
            // ...
        }
    }

    let old_count = self.messages.len();

    // Replace conversation with summary
    self.messages = vec![
        Message::user("Here is a summary of our conversation so far:"),
        Message::assistant_text(&summary),
    ];

    Ok(format!("Compacted {} messages into summary.", old_count))
}
```

It costs one API call but frees the entire context window. Good enough for now.
The fancy multi-strategy pipeline from the TypeScript source is a future
optimization.

### Session Resume

Sessions are JSONL files in `~/.local/share/claux/sessions/`. Each line is
either metadata or a message. `/resume` lists them:

```
Recent sessions:
  20260401-143022  claude-sonnet-4-20250514  12 msgs  /home/ducks/dev/claux
  20260401-141855  claude-sonnet-4-20250514   4 msgs  /home/ducks/dev/llm-tui
```

`/resume 2026` prefix-matches and loads the session back into the engine.
`--resume` on the CLI does the same at startup.

### Model Switching

`/model claude-opus-4-20250514` swaps the model mid-conversation. The engine
updates the API client and resets the cost tracker. Your existing conversation
continues with the new model.

This is one line in Claude Code's TypeScript:
`setMainLoopModelOverride(model)`. In Rust it's a method on the engine that
propagates to the client. Same thing, more explicit.

## Phase 3: The Permission System

This is the one that matters. Phase 1 auto-approved every tool call. That's
fine for testing but you don't want an LLM running `rm -rf` without asking.

Claude Code has five permission modes and a complex rule matching system with
denial tracking, pattern-based matchers, and a classifier for auto mode. The
TypeScript is hundreds of lines across multiple files.

The Rust version has four modes and does the important thing: actually prompts
the user.

### The Flow

When the engine wants to execute a write tool, the permission checker returns
`Ask(summary)`. The engine sends a `PermissionRequest` event through the
stream channel with a oneshot response channel:

```rust
PermissionResult::Ask(summary) => {
    let (resp_tx, resp_rx) = oneshot::channel();
    let _ = tx.send(StreamEvent::PermissionRequest {
        tool_name: name.clone(),
        summary,
        respond: resp_tx,
    }).await;

    match resp_rx.await {
        Ok(PermissionResponse::Allow) => {
            self.tools.execute(name, input.clone()).await?
        }
        Ok(PermissionResponse::AlwaysAllow) => {
            self.permissions.always_allow(name);
            self.tools.execute(name, input.clone()).await?
        }
        Ok(PermissionResponse::Deny) | Err(_) => ToolOutput {
            content: "Permission denied by user.".to_string(),
            is_error: true,
        },
    }
}
```

The REPL catches the event and shows:

```
  ⚡ bash: cargo test  (y)es / (n)o / (a)lways
```

Three options:
- **y** — allow this once
- **n** — deny, tool returns an error to Claude
- **a** — always allow this tool for the rest of the session

"Always allow" is stored in a `HashSet<String>` on the permission checker.
Session-scoped, not persisted. If you restart, you're back to prompting.

### The Modes

```rust
pub enum PermissionMode {
    Default,      // reads auto-allow, writes prompt
    AcceptEdits,  // file edits auto-allow, bash prompts
    Bypass,       // everything allowed
    Plan,         // writes denied entirely
}
```

Default is what you want for normal use. AcceptEdits is for when you trust the
model with files but not shell commands. Plan is read-only exploration. Bypass
is for when you're feeling reckless.

### What's Missing

Claude Code has pattern-based rules: "allow Bash when the command matches
`git *`." The Rust version doesn't have this yet. It's tool-level granularity,
not input-level.

The auto mode classifier is also missing. Claude Code can automatically
classify tool uses as safe/unsafe based on the input. That's a nice-to-have
but the manual prompt covers the same ground.

## Where We Are

Three phases, one session. The diff:

| Phase | Files Changed | Lines Added |
|-------|--------------|-------------|
| 1 (initial) | 16 new | +1,200 |
| 2 (commands) | 5 modified | +235 |
| 3 (permissions) | 3 modified | +94 |

Total: ~1,530 lines of Rust. The binary can:

- Stream chat with Claude
- Execute 6 tools (Read, Write, Edit, Glob, Grep, Bash)
- **Prompt before write operations** (y/n/always)
- **Compact conversation** to free context
- **Resume past sessions**
- **Switch models** mid-conversation
- Track token usage and cost
- Persist sessions as JSONL
- One-shot mode (`-p "prompt"`)

For comparison, the TypeScript source we're porting from is 512,000 lines
across 1,900 files. We're at 1,530 lines across 18 files and have the core
loop working.

## What's Next

Phase 4 is the ratatui TUI — replacing the inline REPL with a proper
alternate-screen terminal UI. That's where it starts looking like Claude Code
instead of just behaving like it.

Phase 5 is the Agent tool — spawning sub-conversations with scoped tool access.
That's the feature that makes Claude Code feel like it has workers.

But honestly, the inline REPL with permissions is already usable. The
permission prompt was the last thing blocking daily use.

---

Previous: [Part 1: Rewriting Claude Code in Rust, With Claude](/blog/2026/rewriting-claude-code-in-rust-with-claude/)

Source: [github.com/ducks/claux](https://github.com/ducks/claux)
