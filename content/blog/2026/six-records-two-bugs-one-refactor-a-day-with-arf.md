---
title: "Six records, two bugs, one refactor: a day with ARF"
date: 2026-06-07
description: "git blame tells you who wrote this line. arf why tells you what they were thinking. I shipped ARF earlier this year as a format for capturing agent reasoning alongside commits. Here's what happened when an agent actually used it for a session of real work."
taxonomies:
  tags:
    - rust
    - ai
    - oss
    - tools
---

`git blame` tells you who wrote this line. `arf why` tells you what they were thinking.

That's the one-line pitch. The longer version: in February I shipped [ARF](https://github.com/ducks/arf), a TOML schema and CLI for capturing agent reasoning alongside git commits. The original post made the case for the format. This one is about what happens when an agent actually uses it.

ARF stands for Agent Reasoning Format - it's meant to be populated by agents as a normal side effect of their tool-using behavior, not by humans typing TOML. So this week I loaded the [arf skill](https://github.com/ducks/arf-skill) into a Claude Code session and gave it a real task: add an `arf export` subcommand. The goal was to look at the resulting `.arf/` afterwards and ask whether the trail was useful or just noise. The session produced six records, surfaced two bugs, and ended with a refactor. Here's the report.

## The setup

`arf export` was a real gap. The format had been "TOML files in a parallel git branch" since v0.1, which is fine for storage but bad for anything downstream - CI scripts that check for missing reasoning, dashboards that visualize agent behavior, multi-agent handoffs. Without export, every consumer had to re-implement the record-walking logic that `arf log` already had.

Small feature, three branching design decisions worth recording (which fields to include, what format default, single-record vs newline-delimited). Bounded enough to fit in a session. Exactly the size where the question "do the records help, or do they just slow things down" has a clean answer.

The agent had the skill loaded. The repo had `arf init` run. Then: "add an `arf export` subcommand that dumps records as JSON."

## Record one: the strategy

Before writing any code, the agent emitted:

```toml
what = "Add 'arf export' subcommand that dumps records as JSON to stdout"
why = "Records are useful inputs to other tooling - CI scripts that check for missing reasoning, dashboards, multi-agent handoffs. TOML files in a parallel git branch are the storage form; JSON over stdout is the interchange form. Without export, anyone wanting to consume ARF data has to re-implement the record-walking logic."
how = "Extract record-loading from cmd_log into a shared load_records() helper. Add cmd_export using it with --commit/--since/--format flags. JSON via serde_json. Default emits a JSON array; --format jsonl emits newline-delimited JSON for streaming consumers."
backup = "If serde_json bloats the binary too much, fall back to hand-rolled JSON. Revert the commit if cmd_log regresses - the helper extraction is the riskier piece."
```

This is the part of ARF I find most valuable in practice. The agent had to commit to a plan before touching code. The `backup` field forced it to ask "what's the riskiest part of this change?" - and the answer "the helper extraction" wasn't obvious from the rest of the description.

The record went into `.arf/records/<commit-sha>/` and the actual implementation followed.

## Record two: the implementation

After the feature landed - extracted helper, new `cmd_export`, three output formats, optional `--since` filtering - the agent emitted an outcome record:

```toml
what = "Implement arf export per the earlier plan"
why = "Closing the loop on the previous record. JSON via serde_json was the right call - no hand-rolled fallback needed, the binary stayed small. Helper extraction landed cleanly; cmd_log behavior unchanged (verified manually)."
how = "Added serde_json dep, load_records() helper, Export variant + ExportFormat enum, cmd_export dispatch. --since accepts bare date OR rfc3339; widened bare date to 00:00:00Z so users don't have to format timezones. TOML output wraps records in a [[records]] array since TOML has no top-level array."
```

Less dramatic. Mostly captured a few small decisions that emerged during implementation: bare-date support for `--since` (so callers don't have to know RFC-3339), the TOML wrapper key (because TOML can't represent a top-level array). The kind of detail that would otherwise live in a commit message that nobody re-reads.

## Bug one: records colliding silently

After the feature worked, integration tests came next - thirteen of them, covering init, record, log, and export across happy and unhappy paths. The suite ran in 110ms. Twelve passed. The thirteenth - `export_jsonl_emits_one_record_per_line` - failed unexpectedly:

```
thread 'export_jsonl_emits_one_record_per_line' panicked:
assertion `left == right` failed
  left: 1
 right: 3
```

The test created three records back-to-back and expected three to be persisted. Only one showed up on disk.

Quick look at `cmd_record`: the filename for each record was constructed with second-resolution timestamps. Three records emitted in the same second collided on the filesystem, and the latest one silently overwrote the previous two. A real bug, latent in the code since the original commit five months ago, found in the first sixty seconds of running the test suite.

One-line fix: switch from `%Y%m%d-%H%M%S` to `%Y%m%d-%H%M%S%9f` (nanosecond precision). All thirteen tests passed afterwards.

Without that test, that bug would have lived in production indefinitely. Maybe forever - it only manifests when an agent emits records faster than once per second, which is exactly the regime ARF is designed for.

## Bug two: the CLI's own onboarding

Before any of this, the very first `arf record` call failed with `ARF not initialized. Run 'arf init' first.` But the repo *did* have an `arf` orphan branch with records from earlier work. The local clone just didn't have the worktree set up.

`arf init` is supposed to handle this, but its logic was "create a fresh branch" rather than "either create or attach to existing." A manual `git worktree add .arf arf` got things unstuck. Smaller than bug one, but worth noting: a new user's very first attempt would also hit this. Filed as a follow-up - `arf init` should detect an existing remote branch and attach to it.

## Record three through six: the refactor

After the feature shipped, the codebase had grown to 830 lines of `src/main.rs` mixing eight command implementations plus a TUI browser plus serialization types plus CLI parsing. With tests in place, this was the safest moment to refactor.

The agent emitted a pre-action record for that too:

```toml
what = "Split src/main.rs into focused modules"
why = "main.rs is ~830 lines mixing eight command implementations, the TUI browser, serialization types, and CLI parsing. Finding code requires scrolling; editing one command means navigating past unrelated context; the TUI alone is ~300 lines that has nothing to do with everything else. The integration test suite gives us a safety net (13 tests, ~110ms) so the refactor is verifiable in seconds."
how = "Carve into: record.rs (ArfRecord type), store.rs (load_records, .arf paths), commands/{init,record,log,sync,graph,diff,export,spec,browse}.rs, plus lib.rs that re-exports for tests. main.rs shrinks to CLI parsing + a dispatch match."
backup = "If something breaks subtly that the tests don't catch, git revert the merge commit. The refactor is purely structural - no behavior changes - so a revert is safe."
```

The refactor took about an hour. All 13 tests passed after the dust settled. `main.rs` went from 1264 lines to 149. The largest single file is now `browse.rs` at 436 lines, all of which is genuinely unavoidable TUI rendering.

## Reading back the trail

Here's what `arf graph` looks like for that session:

```
Git + ARF History:

|-* d139480 feat(export): add arf export subcommand
|  |-- what: Add 'arf export' subcommand
|  |    why: Records are useful inputs to other tooling...
|  |    how: Extract record-loading from cmd_log...
|  +-- what: Implement arf export per the earlier plan
|       why: Closing the loop on the previous record...
|-* ea70db3 test: integration tests + record-filename fix
|  +-- what: Implement integration test suite for the arf CLI
|       why: 13 tests covering init/record/log/export...
|-* ad20c4b refactor: split main.rs into per-command modules
   |-- what: Split src/main.rs into focused modules
   |    why: main.rs is ~830 lines mixing...
   +-- what: Land the module split per the earlier plan
        why: All 13 integration tests passed after the refactor...
```

Three commits, six records. Each commit has a "before" record (the plan) and an "after" record (the outcome). Reading this back the next day, the trail tells me:

- What the agent was trying to do (in its own structured voice)
- Why it made the specific design choices it made
- What it learned during implementation that wasn't visible in the diff
- Whether things went as planned, or where they deviated

The commit messages alone would have given me the *what*. The records give me the *why*.

## Where this points

ARF anchors reasoning to commit SHAs. The next natural step is anchoring to specific *files and line ranges* - "this record was about the change to src/store.rs:42-76." Once records are line-anchored, the format starts to look less like a sequential changelog and more like a queryable annotation layer over the codebase.

`arf why src/store.rs:42` would: resolve line 42 back to whichever commit last touched it (the `git blame` step), look up reasoning records for that commit, and print the ones that mentioned that file. Same metaphor as blame, different question. blame answers *who wrote this*. `arf why` answers *why does this exist*.

You can see the shape this points at if you keep pulling on it. Decision provenance for software. A queryable graph of `(commit, file, line, reasoning)` tuples accumulating over the life of a project. CI checks that fail when code changes without reasoning attached. "When was the last time anyone explained this function?" as a real question with a real answer.

The data model can become rich. The data won't be rich until the *emission* problem is solved across the agent ecosystem - until every coding agent (Claude Code, Cursor, Aider, the next thing) drops reasoning records as a normal part of their tool-use cycle, the way `git commit` writes to both `.git/refs/heads/main` and `.git/objects/` without anyone thinking about it.

## What didn't land

A few honest observations from a single session of real use:

**The skill prompted the agent reliably, but the granularity is debatable.** The agent emitted at the "feature" boundary - one record before, one after - but not at finer boundaries inside the implementation. A more interesting trail would have records when the agent tried something, hit a wall, and pivoted. Right now the skill's "when to emit" rules don't push hard enough on the mid-task decisions. Iteration on the skill text, not the format.

**There's no link from record to specific files or lines.** This is the gap that points toward `arf why`. The schema needs a `files` field; the CLI needs the `why` subcommand. About a hundred lines of work each.

**Pre and post records cluster on one commit.** Both pre-action and post-action records get attached to the same commit SHA, because the post-action record fires before the actual `git commit`. Not wrong, but not quite the model I want either - I'd like a clearer sense of "this record predicted this commit" vs "this record reports on this commit."

**The TUI browser is great, the CLI graph view is fine, neither is shareable.** If I wanted to send someone a URL showing the reasoning trail for a PR, I don't have that today. A web viewer is the obvious next thing.

## The takeaway

ARF the format works. The trail produced in a session of real agent use was specific, structured, and informative when I read it back. The bugs the integration tests caught (records silently overwriting each other) are the kind of thing that would have hurt real users before ever surfacing. The refactor went smoothly because the tests existed; doing it without that safety net would have been scarier and slower.

The remaining work isn't on the format - it's on getting agents to emit records at the right granularity automatically, and on the queryable layer (`arf why`, file/line anchoring, a web viewer) that turns records from a log into a graph.

I'm going to keep running real work through ARF for a few weeks and report back. The honest test is whether I find myself reaching for `arf graph` when I'm trying to remember what an agent did last Tuesday. If yes, the format earned its space. If no, it didn't.

`arf-cli` is on [crates.io](https://crates.io/crates/arf-cli). The format spec is at <https://github.com/ducks/arf>. The Claude Code skill is at <https://github.com/ducks/arf-skill>. Try it on a real session of agent work and see what your trail looks like.
