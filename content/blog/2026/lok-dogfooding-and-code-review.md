---
title: "Lok Part 3: Dogfooding and Code Review"
date: 2026-01-27
description: "PR review, codebase explanation, and lok opening 25 GitHub issues on itself. Plus parallel workflows and context detection."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

Part 2 ended with two promises: parallel workflow execution and dead code cleanup.
Both happened. But the more interesting development was lok creating GitHub issues
for bugs it found in itself.

## Hunt with Issues

The `lok hunt` command scans for bugs using multiple LLM backends. The new
`--issues` flag takes it further: parse the findings and create GitHub issues
automatically.

```bash
lok hunt --issues                    # Find bugs, create issues
lok hunt --issues -y                 # Skip confirmation prompt
lok hunt --issues --issue-backend gitlab  # Force GitLab instead of GitHub
```

The implementation auto-detects whether to use `gh` (GitHub CLI) or `glab`
(GitLab CLI) by checking the git remote URL:

```rust
fn detect_from_remote(dir: &Path) -> Option<Self> {
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(dir)
        .output()
        .ok()?;

    let url = String::from_utf8_lossy(&output.stdout).to_lowercase();

    if url.contains("github.com") {
        Some(IssueBackend::GitHub)
    } else if url.contains("gitlab.com") || url.contains("gitlab.") {
        Some(IssueBackend::GitLab)
    } else {
        // Fall back to checking which CLI is installed
        // ...
    }
}
```

Self-hosted GitLab instances work too (the `gitlab.` check catches
`gitlab.mycompany.com`).

## Lok Reviews Itself

The real test: run `lok hunt --issues -y` on the lok repository itself.

```bash
$ lok hunt --issues -y

Task: hunt
Find bugs and code issues
==================================================

[errors]

=== CLAUDE ===

1. **Unchecked path canonicalization** - `src/main.rs:271`
   - Uses `unwrap_or_else` to silently fall back on failure
   - Backends expecting absolute paths may behave unexpectedly

2. **Unvalidated PR URL parsing** - `src/main.rs:1320-1323`
   - No validation that URL has enough path segments
   - Malformed URLs like `https://github.com/foo` will panic
...

=== CODEX ===

1) src/cache.rs:121 — `read_to_string(...).ok()?` silently drops IO errors
2) src/workflow.rs:241 — `find(...).unwrap()` can panic on duplicate steps
...

[perf]

=== CLAUDE ===

1. **O(n×m) consensus checking** - `src/debate.rs:176-189`
2. **Regex compiled per interpolation call** - `src/workflow.rs:282-294`
...

=== CODEX ===

1. `src/workflow.rs:89` — Linear `.find` over steps, O(n^2) with many steps
2. `src/workflow.rs:279` — Regex recompiled on every `interpolate` call
...

[dead-code]

=== CLAUDE ===

1. **src/backend/mod.rs:1-9** - Bedrock module feature-gated but never enabled
2. **src/cache.rs** - `Cache::clear()` method defined but never called
...
```

Both backends found real issues. Claude and Codex agreed on several (the regex
recompilation, the O(n^2) workflow lookups) and each caught things the other
missed.

Then the issues got created:

```
==================================================
issues: Creating GitHub issues in ducks/lok

Found 25 potential issues:
  1. src/cache.rs:121 — silently drops IO errors
  2. src/workflow.rs:241 — find(...).unwrap() can panic
  3. Regex compiled per interpolation call
  ...

Creating issue: src/cache.rs:121...  ✓ https://github.com/ducks/lok/issues/1
Creating issue: src/workflow.rs:241... ✓ https://github.com/ducks/lok/issues/2
...
Creating issue: src/spawn.rs:381-384... ✓ https://github.com/ducks/lok/issues/25

✓ Created 25 issues
```

25 GitHub issues from a single command. The tool found bugs in itself and opened
tickets to track them. Each issue body includes the full finding context and
which backend reported it.

## PR Review

The `lok pr` command reviews GitHub pull requests:

```bash
lok pr 123                              # Current repo
lok pr owner/repo#123                   # Specific repo
lok pr https://github.com/o/r/pull/123  # From URL
```

It fetches PR metadata and diff via `gh`, constructs a review prompt, and sends
it to the configured backends. Feedback is organized by severity (critical,
important, minor, nitpick).

The value is having it as a single command instead of copy-pasting diffs into
chat windows. Run `lok pr` on your own PRs before requesting review. It catches
the obvious stuff so human reviewers can focus on architecture.

## Explain Mode

The `lok explain` command explains codebases:

```bash
lok explain                         # Current directory
lok explain /path/to/project        # Specific project
lok explain --focus auth            # Focus on specific aspect
```

It gathers context automatically: README, package manifests (Cargo.toml,
package.json, etc.), and a two-level directory tree. Then asks the backend to
explain purpose, architecture, key files, and entry points.

The `--focus` flag is useful for large codebases. Instead of explaining
everything, ask specifically about auth, database access, or API structure.

```bash
lok explain ~/work/discourse --focus "background jobs"
```

## Context Detection

Part 2 mentioned false positives from lok flagging N+1 queries in codebases that
use auto-eager-loading. Context detection fixes this.

Lok scans for framework and tooling markers before constructing prompts:

```rust
pub struct CodebaseContext {
    pub detected_language: Option<String>,
    pub is_rails: bool,
    pub has_goldiloader: bool,
    pub has_bullet: bool,
    pub has_brakeman: bool,
    // ...
}
```

When running N+1 detection on a Rails app with Goldiloader, the prompt includes:

> Note: This codebase uses Goldiloader for automatic eager loading. Many
> apparent N+1 patterns may be handled automatically. Focus on cases where
> Goldiloader wouldn't help.

This reduced false positives significantly. Check what lok detects with:

```bash
lok context .
```

## Parallel Workflows

Steps without dependencies now run in parallel:

```toml
[[steps]]
name = "patterns"
backend = "codex"
prompt = "Find code patterns"

[[steps]]
name = "dead-code"
backend = "codex"
prompt = "Find dead code"

# These two run in parallel (no dependencies)

[[steps]]
name = "synthesize"
backend = "claude"
depends_on = ["patterns", "dead-code"]
prompt = "Combine: {{ steps.patterns.output }} {{ steps.dead-code.output }}"
```

For workflows that hit multiple backends, this cuts total time significantly.
A three-backend scan that took 15 seconds sequentially now takes 6 seconds.

## Diff Review

`lok diff` reviews local changes before committing:

```bash
lok diff                    # Staged changes
lok diff --unstaged         # All uncommitted changes
lok diff main..HEAD         # Branch vs main
lok diff HEAD~3             # Last 3 commits
```

Same idea as PR review, but catches issues before they become PR comments.

## The Pattern

A few days in, a usage pattern has emerged:

1. **Exploratory work**: Let Claude Code call `lok ask` with different backends
   as needed. The LLM decides when to get second opinions.

2. **Repeatable analysis**: Define workflows in TOML. Run with `lok run`.
   Parallel execution makes multi-backend scans fast.

3. **Code review**: `lok diff` before committing, `lok pr` before requesting
   review. Catches obvious issues early.

4. **Bug tracking**: `lok hunt --issues` to find bugs and create tickets in one
   command.

Lok isn't trying to replace your LLM session. It's a tool your LLM session can
use. The orchestration intelligence stays in the conductor (Claude, GPT,
whatever you're chatting with). Lok just provides the interface to multiple
specialized backends.

## What's Next

Those 25 issues on the lok repo need fixing. The O(n^2) workflow lookups and
regex recompilation are the most impactful. The silent error swallowing in the
cache layer should probably at least log warnings.

The PR review could be smarter about large diffs. Right now it truncates at 50k
characters. Chunking with overlap would preserve context better.

And the issue creation could get smarter about deduplication. Right now it
dedupes by title within a single run, but doesn't check for existing open
issues with similar titles.

The source is at [github.com/ducks/lok](https://github.com/ducks/lok).
