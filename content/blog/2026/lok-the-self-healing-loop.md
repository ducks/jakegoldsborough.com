---
title: "Lok Part 4: The Self-Healing Loop"
date: 2026-01-28
description: "Lok gains agentic workflows, fixes its own bugs, and finds a real bug in Discourse that I just pushed upstream."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

Last time I showed lok finding 25 bugs in itself and creating GitHub issues
automatically. Today it fixed one of those bugs, submitted a PR, and then
found a real bug in Discourse that I just pushed upstream.

## Agentic Workflows

The missing piece was letting lok actually do things, not just talk about them.
I added a few fields to the workflow TOML:

```toml
[[steps]]
name = "fix"
backend = "claude"
apply_edits = true
verify = "cargo build"
prompt = """
Fix this issue. Output JSON:
{"edits": [{"file": "src/main.rs", "old": "...", "new": "..."}], "summary": "..."}
"""

[[steps]]
name = "commit"
shell = "git add -A && git commit -m '{{ steps.fix.summary }}'"
depends_on = ["fix"]
```

Three new things:

1. `shell` runs a command instead of querying an LLM
2. `apply_edits` parses JSON from the LLM and patches files
3. `verify` runs after edits to make sure they work

The `{{ steps.fix.summary }}` bit extracts a field from the JSON output. You
can also do `{{ arg.1 }}` for positional arguments, so `lok run fix-issue 42`
passes 42 into the workflow.

## Lok Fixes Itself

[Issue #25](https://github.com/ducks/lok/issues/25) was about a redundant `Clone` implementation. The `Delegator` struct
already derives Clone, but there was a manual impl at the bottom of the file
doing the same thing.

I ran the fix workflow:

```bash
lok run fix-issue 25
```

It analyzed the issue, generated an edit to delete the redundant impl, applied
it, ran `cargo build` to verify, committed with a message based on the fix
summary, pushed the branch, and opened a PR.

The whole loop took maybe 30 seconds. I reviewed the diff, looked reasonable,
merged it.

## Finding Bugs in Discourse

Feeling confident, I pointed lok at the main Discourse codebase:

```bash
lok hunt ~/discourse/discourse
```

Both Codex and Claude found issues. Most were minor (confusing patterns, style
things) but two stood out:

1. A chat job with a TODO saying "delete after 2025-01-01" that was still there
   in January 2026. Pure dead code.

2. A bug in the thread serializer. It had this pattern:

```ruby
@opts[:include_thread_original_message].presence || true
```

The problem is `.presence` on `false` returns `nil`. So if you explicitly pass
`include_thread_original_message: false`, it gets converted to `nil`, then
`|| true` kicks in, and your option is ignored.

One controller was passing `false` and getting `true` back. Nobody noticed
because the behavior difference is subtle, but it was definitely wrong.

I created two PRs:
[#37333](https://github.com/discourse/discourse/pull/37333)
[#37334](https://github.com/discourse/discourse/pull/37334)

## The Vision

The pieces are coming together for a fully autonomous loop:

1. `lok hunt --issues` finds bugs and creates GitHub issues
2. `lok run fix-issue 42` analyzes, fixes, verifies, commits, opens PR
3. `lok run review-pr 43` has multiple backends review the diff
4. If they agree, merge

Humans become exception handlers. You get pinged when the LLMs disagree or
flag something they are not confident about. Otherwise the codebase quietly
improves itself.

We are not there yet. The fix workflow needs better error recovery, the review
workflow needs the debate mode integrated, and I want confidence scores on
the merge decision. But the foundation is solid.

## What's Next

Honestly, I'm not 100% sure. I plan to just keep using it and adding/fixing things
that I want or need. Stay tuned to see how the project evolves.

Next stop: unknown. But the tracks are laid.
