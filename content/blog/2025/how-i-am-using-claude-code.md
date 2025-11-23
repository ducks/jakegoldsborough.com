---
title: "How I'm Using Claude Code for Daily Development Work"
date: 2025-10-24
description: "Real-world AI pair programming: what works, what doesn't, and how to avoid the traps"
taxonomies:
  tags:
    - ai
    - dev
    - tools
---

I've been using Claude Code for a few months now as my primary development assistant. Not as a replacement for thinking, but as a way to move faster on the boring stuff while keeping the interesting problems for myself.

## What It's Actually Good At

### The Grunt Work

Testing infrastructure is where Claude shines. Today, I needed to test SMTP error logging improvements. Instead of manually setting up [mail-relay-simulator](https://github.com/Supermathie/mail-relay-simulator), configuring different failure scenarios, and writing test cases, I described what I needed and got a complete Ruby script that:

- Manages docker-compose lifecycle
- Switches between 4 test scenarios (auth failures, wrong credentials, etc.)
- Writes proper config files with correct syntax
- Handles cleanup

The script works. It's maintainable. It saved me 2-3 hours of tedious setup work.

### Research and Discovery

"Find all the places in this codebase where we do X" - this is tedious grep work that Claude excels at. It can search, cross-reference, and explain patterns without me needing to open 20 files.

Example: When investigating AWS SDK credential chain bugs, I had Claude trace through the entire credential provider chain, find where it was failing, and document the root cause. That kind of code archaeology is perfect for AI assistance.

### Documentation

Writing test results documentation, commit messages, technical proposals - Claude can take my rough notes and produce clean markdown that I'd never bother writing myself. The writeup exists because the AI made it low-effort, not because I suddenly got better at documentation.

## Where It Could Improve

### Understanding Intent

If I'm not specific about what I want, Claude will give me something that technically works but misses the point. Example: I asked for markdown rendering in Neovim. Got three different failed attempts at split-window rendering before I just said "fuck it, just hard-wrap at 80 characters."

The AI doesn't know when to stop. It will keep trying increasingly complex solutions when the answer is "do less."

### Production Debugging

When real production issues happen, Claude's knowledge cutoff and lack of access to live systems means it's guessing. I can describe symptoms and it'll suggest things to check, but it's not replacing actual debugging experience.

### Knowing What It Doesn't Know

The worst thing Claude does is hallucinate with confidence. It'll make up photographer names for Unsplash images when WebFetch fails to parse the page. It'll suggest APIs that don't exist. It'll confidently explain behavior that's completely wrong.

You have to verify everything. Trust but verify isn't optional.

## How I Actually Use It

### 1. Explicit Context

I maintain a CONTEXT.md file with my preferences:
- Code style (no emoji, wrap at 80 chars, prefer `if !` over `unless`)
- Project patterns (date-based versioning, git workflow preferences)
- Common pitfalls (Ruby openssl gem vs extension, Discourse auth patterns)

This cuts down on back-and-forth. Claude knows I want `--no-ff` merges without me explaining it every time.

### 2. Incremental Validation

I don't let Claude write 500 lines without checking. Small changes, validate, next change. When it starts going off track, I stop and correct immediately.

If tests fail, I read the error myself. If code looks weird, I ask "why did you do it this way?" and often realize there's a better approach.

### 3. Use It For What It's Built For

Good uses:
- File operations (read, edit, search)
- Repetitive code changes
- Documentation generation
- Test script creation
- Config file management

Bad uses:
- Anything requiring judgment calls
- Performance optimization without profiling
- Security-sensitive code review
- "Just make it work" prompts

### 4. Keep Notes

I have Claude maintain daily notes of what we worked on. Not as todo tracking, but as a context refresh. When I come back tomorrow, I can read yesterday's notes and pick up where we left off.

The notes also catch when Claude forgets something or contradicts earlier decisions.

## The Workflow

Typical session:

1. **Me**: "I need to test SMTP error logging with mail-relay-simulator"
2. **Claude**: Reads existing code, finds simulator location, proposes script structure
3. **Me**: "Yeah but make it modular, don't hardcode paths"
4. **Claude**: Updates script with env var + path discovery
5. **Me**: Runs script, hits error
6. **Claude**: "That error means X, here's the fix"
7. **Me**: Applies fix, tests, moves on

It's not magic. It's a very fast junior developer who never gets tired but also never learns from mistakes unless you tell it explicitly.

## The Trap

The trap is letting the AI do your thinking. It's really easy to just accept the first solution that looks reasonable. But "looks reasonable" and "is correct" aren't the same thing.

I caught Claude trying to use `Dir.chdir` in a script today. RuboCop flagged it as not thread-safe. The "correct" solution was `system(..., chdir: path)`. Claude didn't know that until the linter told it.

If I'm not reading the code and understanding the changes, I'm just a very expensive copy-paste machine.

## Should You Use It?

If you're junior: Maybe not yet. You need to build pattern recognition before you can effectively verify AI output. You won't know when it's bullshitting.

If you're mid-level: Useful for grunt work, but keep it on a short leash. You should be reading and understanding every change.

If you're senior: This is productivity steroids. You already know what good code looks like. AI just makes it faster to write.

## Final Thoughts

Claude Code isn't replacing developers. It's replacing the boring parts of development. The parts where you know exactly what needs to happen but it's going to take an hour of tedious typing.

I'm not using less brain power. I'm using it on the problems that actually matter instead of fighting with test harness boilerplate.

That's the win.
