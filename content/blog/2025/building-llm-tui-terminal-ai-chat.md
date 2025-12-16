---
title: "Building LLM-TUI: Never Lose Context Again"
date: 2025-12-16
description: "Built a terminal AI chat that remembers everything. File context persists across sessions, tools execute with confirmation, and you never lose your place."
---

I am loving CLI agentic LLM apps except for one thing... and that's losing context.

You're working on a feature. You've shown the AI five files. You've explained
your architecture. You're making progress. Then Claude crashes. Or you switch
to a different project.

When you come back tomorrow, you start over. Re-explain everything. Re-share
the files. Re-establish context.

I was taking daily notes but I got tired of that. So I built llm-tui.

It's a terminal interface for AI chat, but that's not the main feature. The
main feature is it remembers. File context persists across sessions. Tool
results get cached. You can close it, come back a week later, and pick up
exactly where you left off.

## What It Does

You launch it, pick a model, and chat. But the devil's in the details.

**Multi-Provider Support**

Switch between Ollama (local models on your
machine), Claude API (Anthropic's hosted models), and AWS Bedrock (Claude via
AWS). One interface, multiple backends.

**Tool System**

When using Claude or Bedrock, the AI can Read files, Write
files, Edit existing code, search with Glob and Grep, and run Bash commands.
All sandboxed to your home directory. Every tool execution requires
confirmation (y/n/q).

**File Context Persistence**

Files read during a session get cached. When you
reopen that session later, those files are already loaded. The AI remembers
what it was looking at.

**Session Management**

Create named sessions, organize them by project, rename
and delete them. SQLite storage means everything persists and loads instantly.

**Vim Keybindings**

Modal editing. Normal mode for navigation, insert mode for
typing, command mode for session management. j/k to scroll, i to insert, Esc to
escape. Feels natural.

**Token Tracking**

Real-time display of token usage (Tokens: 1250/200000).
When conversations get long, automatic context compaction kicks in at 75%
capacity. Old messages get summarized, recent ones stay intact.

## Why I Built It

Context loss kills productivity. You're building a feature, the AI understands
your codebase, and then you lose it all. Browser tabs close. Sessions expire.
You switch projects and forget to save the conversation.

Starting over means minutes of setup every time. Copy file contents. Explain
your architecture again. Re-establish what the AI already knew.

I needed persistence. Sessions that survive restarts. File context that doesn't
disappear. A tool that picks up where you left off without re-explaining
everything.

And I wanted control over which model handles the task. Local models for quick
iteration. Claude when I need reasoning. Bedrock for AWS work. One interface,
no lost context when switching.

## The Tool System

Context persistence only works if the AI can actually interact with your files.
Browser-based chat requires copying code back and forth. Every file you want
the AI to see means another copy-paste. Every change it suggests means manually
applying edits.

The tool system fixes this. When using Claude or Bedrock, the AI can Read
files, Write files, Edit code, search with Glob and Grep, and run Bash
commands. All sandboxed to your home directory with explicit confirmation.

When the AI wants to read a file, it calls the Read tool. You see: `Read
/home/user/project/foo.rs? (y/n/q)`. Same for writes and edits. You approve or
reject each action.

The key part: tool results get cached per session. If the AI reads
`config.toml`, that result stays in the session history. Next time you open
that session, it already knows what was in that file. No re-reading. No
re-explaining. The context persists.

## The Future Is Weird

As you can probably tell, I love and prefer open source software. Unfortunately,
Claude does not fall into that category so I could not look at it for inspiration.
So, I tried a wild idea. I simply asked Claude how it's tools worked and what the API
response looked like. And you know what, it worked! I had Claude help me basically
rebuild it's tools by internal reflection. The future is a trip, man.

## Session Management

This is where context persistence actually lives. Each session is a separate
context with its own history, files, and conversation state. Work on multiple
projects without mixing contexts. Switch between them without losing anything.

```
:new my-feature                # New session with custom name
:project discourse-yaks        # Set current project
:rename better-name            # Rename current session
```

Sessions are stored in SQLite at `~/.local/share/llm-tui/sessions.db`. Close
the app, come back tomorrow, and every session is exactly as you left it. The
AI still has all the files loaded. The conversation picks up mid-thought.

You can even load context from other sessions with `:load session-name`. Pull
in file context from a different project without manually re-sharing
everything.

## Provider Management

Switch providers with a command:

```
:provider ollama    # Local models
:provider claude    # Claude API (requires ANTHROPIC_API_KEY)
:provider bedrock   # AWS Bedrock (requires AWS credentials)
```

The models screen (press `3`) shows all available models across all providers.
Installed Ollama models marked with `[installed]`. Current active model marked
with `[current]`.

You can download Ollama models directly from the TUI. Navigate to a
non-installed model, hit Enter, and it pulls from the Ollama library. One
keypress.

## Automatic Context Compaction

Long conversations hit context window limits. Most chat interfaces handle this
by truncating old messages. You lose the early context that established your
architecture decisions and project structure.

llm-tui summarizes old messages instead of dropping them. At 75% capacity, it
sends old messages to the LLM for summarization. The summary replaces the
original messages, keeping under 500 tokens. Recent messages (default: 10)
always stay uncompacted.

You keep the context. The AI still knows what happened at the start of the
conversation. You just use fewer tokens to maintain it.

## The Stack

Written in Rust. The UI is built with ratatui (terminal UI library). SQLite for
storage via rusqlite and crossterm for terminal handling.

Three API clients: reqwest for Ollama's HTTP API, anthropic-sdk-rust for
Claude, and AWS SDK for Bedrock.

Tool execution uses ripgrep (grep crate) for fast content search, glob for
pattern matching, and walkdir for file traversal.

Built my own vim-navigator-rs library for the modal keybindings. Normal, insert,
and command modes with proper vim-style navigation.

## Configuration

Config file at `~/.config/llm-tui/config.toml`:

```toml
autosave_mode = "onsend"              # disabled/onsend/timer
ollama_model = "llama2"
ollama_context_window = 4096
claude_model = "claude-3-5-sonnet-20241022"
claude_context_window = 200000
bedrock_model = "us.anthropic.claude-sonnet-4-20250514-v1:0"
bedrock_context_window = 200000
autocompact_threshold = 0.75          # Compact at 75% capacity
autocompact_keep_recent = 10          # Keep last 10 messages uncompacted
```

Autosave modes: disabled (manual `:w` only), onsend (save immediately when
sending messages), or timer (save every N seconds).

Auto-start Ollama if not running (configurable). Set default provider. Pick
your context window sizes.

## Roadmap

Still building. Next up:
- OpenAI API integration
- Setup wizard for API keys
- Daily notes integration (load from my claude-notes directory)
- Search functionality across sessions
- Session export
- Code block syntax highlighting

## Final Thoughts

Browser-based chat interfaces are fine for casual use. But when you're deep in
development work, context loss becomes the bottleneck. Re-explaining
architecture. Re-sharing files. Starting conversations from scratch.

llm-tui fixes that. Sessions persist. File context survives restarts. You pick
up exactly where you left off. The AI remembers what it knew yesterday.
