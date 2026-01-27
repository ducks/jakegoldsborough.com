---
title: "Lok Part 3: Dogfooding and Code Review"
date: 2026-01-27
description: "PR review, codebase explanation, and using lok to review its own PRs. Plus parallel workflows and context detection."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

Part 2 ended with two promises: parallel workflow execution and dead code cleanup.
Both happened. But the more interesting development was using lok to review its
own pull requests.

## PR Review

The feature started simple: I wanted to run `lok pr 123` and get a code review.

```bash
lok pr 123                              # Current repo
lok pr owner/repo#123                   # Specific repo
lok pr https://github.com/o/r/pull/123  # From URL
```

The implementation shells out to `gh` (GitHub CLI) for the heavy lifting. It
fetches PR metadata and the diff, constructs a review prompt, and sends it to
the configured backends.

```rust
let pr_json = Command::new("gh")
    .args([
        "pr", "view", &pr_number,
        "--repo", &owner_repo,
        "--json", "title,body,state,additions,deletions,..."
    ])
    .output()?;

let diff = Command::new("gh")
    .args(["pr", "diff", &pr_number, "--repo", &owner_repo])
    .output()?;
```

The prompt template asks for severity-organized feedback:

```
Review this GitHub Pull Request.

## PR Info
- Title: {title}
- Branch: {head_ref} -> {base_ref}
- Changes: {changed_files} files, +{additions}/-{deletions} lines

## Description
{body}

## Diff
{diff}

## Review Instructions
Provide a thorough code review. Look for:
1. Bugs or logic errors
2. Security vulnerabilities
3. Performance issues
...

Organize by severity (critical, important, minor, nitpick).
```

Nothing revolutionary. The value is having it as a single command instead of
copy-pasting diffs into chat windows.

## Dogfooding

The real test was using it on work PRs. Within a day of implementing `lok pr`,
I ran it against a PR for an S3 hardlink rotation fix:

```bash
lok pr https://github.com/discourse/discourse/pull/37293 -b claude
```

The review caught a mismatch: the PR title said "proactively rotate" but the
code was reactive (catching `EMLINK` after hitting the limit, not tracking
counts beforehand). Title and implementation didn't match.

Quick fix via `gh api` to update the description, and the PR was accurate. But
the pattern stuck. Now I run `lok pr` on my own PRs before requesting review.
It catches the obvious stuff so human reviewers can focus on architecture and
design.

## Explain Mode

The other new command explains codebases:

```bash
lok explain                         # Current directory
lok explain /path/to/project        # Specific project
lok explain --focus auth            # Focus on specific aspect
```

It gathers context automatically: README, package manifests (Cargo.toml,
package.json, etc.), and a two-level directory tree. Then asks the backend to
explain purpose, architecture, key files, and entry points.

```rust
// Check for README variants
let readme_variants = ["README.md", "README", "readme.md", "README.txt"];
for readme in readme_variants {
    let path = cwd.join(readme);
    if path.exists() {
        // Include in context...
    }
}

// Check for package manifests
let manifests = [
    ("Cargo.toml", "Rust"),
    ("package.json", "Node.js"),
    ("pyproject.toml", "Python"),
    // ...
];
```

The `--focus` flag is useful for large codebases. Instead of explaining
everything, ask specifically about auth, database access, or API structure.

```bash
lok explain ~/work/discourse --focus "background jobs"
```

## Context Detection

Part 2 mentioned false positives from lok flagging N+1 queries in codebases that
use auto-eager-loading. Context detection fixes this.

Lok now scans for framework and tooling markers before constructing prompts:

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
> Goldiloader wouldn't help (e.g., conditional associations, polymorphic
> queries).

This reduced false positives significantly. The same pattern applies to security
audits (noting Brakeman usage), linting (noting RuboCop/ESLint), and other
analysis types.

Check what lok detects with:

```bash
lok context .
```

```
Detected Codebase Context
========================================
Language: Ruby

Ruby/Rails:
  + Rails
  + Goldiloader (auto N+1 prevention)
  + Brakeman (security)
  + RuboCop (linting)
  + RSpec (testing)
  + Sidekiq (background jobs)

Infrastructure:
  + Docker
  + GitHub Actions

Prompt Adjustments:
  * N+1 prompts will note Goldiloader/Bullet usage
  * Security prompts will note existing security tooling
```

## Parallel Workflows

Part 2's workflow engine ran steps sequentially. Now steps without dependencies
run in parallel:

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

The implementation groups steps by dependency depth and runs each group
concurrently:

```rust
// Group steps by execution order
let mut depth_map: HashMap<usize, Vec<&Step>> = HashMap::new();
for step in &workflow.steps {
    let depth = calculate_depth(step, &workflow.steps);
    depth_map.entry(depth).or_default().push(step);
}

// Execute each depth level
for depth in 0..max_depth {
    let steps_at_depth = &depth_map[&depth];
    let futures: Vec<_> = steps_at_depth
        .iter()
        .map(|step| execute_step(step, &context))
        .collect();

    let results = futures::future::join_all(futures).await;
    // ...
}
```

For workflows that hit multiple backends, this cuts total time significantly.
A three-backend scan that took 15 seconds sequentially now takes 6 seconds.

## Diff Review

Before `lok pr` existed, I added `lok diff` for reviewing local changes:

```bash
lok diff                    # Staged changes
lok diff --unstaged         # All uncommitted changes
lok diff main..HEAD         # Branch vs main
lok diff HEAD~3             # Last 3 commits
```

Same idea as PR review, but for local work before committing. Catches issues
before they become PR comments.

```bash
# Pre-commit workflow
git add -p                  # Stage changes
lok diff                    # Review what you're about to commit
git commit                  # Commit if review looks good
```

## Security Hardening

While running `lok audit` on lok itself, it flagged two issues:

**API keys stored as plain String.** Fixed by adding the `secrecy` crate:

```rust
use secrecy::{ExposeSecret, SecretString};

pub struct ClaudeBackend {
    api_key: SecretString,  // Zeroed on drop, redacted in Debug
    // ...
}
```

**No argument separator before prompts.** A prompt starting with `-` could be
interpreted as a flag. Fixed by adding `--` before user input in all CLI
backends:

```rust
cmd.args(["--", &prompt]);  // Everything after -- is literal
```

Both were real issues that lok found in itself. Dogfooding works.

## The Pattern

A few days in, a usage pattern has emerged:

1. **Exploratory work**: Let Claude Code call `lok ask` with different backends
   as needed. The LLM decides when to get second opinions.

2. **Repeatable analysis**: Define workflows in TOML. Run with `lok run`.
   Parallel execution makes multi-backend scans fast.

3. **Code review**: `lok diff` before committing, `lok pr` before requesting
   review. Catches obvious issues early.

4. **Onboarding**: `lok explain --focus X` to understand unfamiliar codebases
   quickly.

Lok isn't trying to replace your LLM session. It's a tool your LLM session can
use. The orchestration intelligence stays in the conductor (Claude, GPT,
whatever you're chatting with). Lok just provides the interface to multiple
specialized backends.

## What's Next

The PR review could be smarter about large diffs. Right now it truncates at 50k
characters. Chunking with overlap would preserve context better.

Context detection could expand to more frameworks. Django, FastAPI, and Go
tooling are partially covered but could be deeper.

And there's always more dead code to find. `lok hunt` keeps finding things.

The source is at [github.com/ducks/lok](https://github.com/ducks/lok).
