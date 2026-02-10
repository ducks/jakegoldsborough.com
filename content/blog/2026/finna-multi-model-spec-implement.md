---
title: "finna: Multi-Model Debate, Spec, and Implement"
date: 2026-02-10
description: "A standalone tool that takes an idea, debates it across Claude,
  Codex, and Gemini, creates a roadmap, writes specs, and implements. Planning
  and execution in one pipeline."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

Lok's `spec` command was useful but felt too coupled to the rest of the tool.
I wanted something standalone: give it an idea, get specs and code. No
configuration files, no backend setup, just a single binary that orchestrates
the models I already have installed.

That's finna.

## The Problem with "Just Build It"

When you ask an LLM to build something, it starts coding immediately. Maybe it
picks a good architecture, maybe it doesn't. By the time you see the output,
you're committed to whatever approach it chose. If the foundation is wrong,
you're either refactoring generated code or starting over.

The fix is to separate planning from execution. But not just any planning. A
plan that multiple models have debated and agreed on, written down in files you
can review before any code gets generated.

## The Pipeline

finna runs four stages:

```
idea → debate → roadmap → spec → implement
```

1. **Debate**: Claude, Codex, and Gemini independently analyze the idea
2. **Consensus**: Claude synthesizes the proposals into a unified approach
3. **Roadmap**: Break the consensus into ordered, dependency-aware steps
4. **Spec**: Write detailed implementation specs for each step
5. **Implement**: Models propose edits, Claude synthesizes, changes applied

Each stage reads from the previous stage's output. Everything lands in `.finna/`
so you can review, edit, or re-run individual stages.

## Usage

```bash
# Run all stages
finna "Add JWT authentication to the API"

# Or run stages separately
finna debate "Add JWT authentication"    # debate → roadmap
finna spec                                # roadmap → specs
finna implement                           # specs → code

# Target specific steps
finna spec --step auth-middleware
finna implement --step auth-middleware
```

## A Real Example: TOML Parser

I ran finna on building a TOML parser from scratch:

```bash
finna debate "write a toml parser in rust from scratch, no dependencies"
```

Three models debated the architecture. They converged on a lexer-first approach
with recursive descent parsing. The roadmap came out as 30 steps with proper
dependency ordering:

```
.finna/
├── consensus.json
├── roadmap.arf
└── specs/
    ├── 01-project-scaffold/spec.arf
    ├── 02-error-types/spec.arf
    ├── 03-token-types/spec.arf
    ...
    ├── 16-lexer-integration/spec.arf
    ├── 17-parser-core/spec.arf
    ...
    └── 30-edge-cases/spec.arf
```

The roadmap groups work into phases: scaffold and types (1-5), lexer (6-16),
parser (17-25), public API and tests (26-30). Each step declares its
dependencies so they can't run out of order.

Running `finna spec` generates detailed ARF specs for each step. Here's the
spec for lexing basic strings:

```toml
order = 10
what = "Implement lexing for double-quoted basic strings with full escape support"
why = "Basic strings are TOML's primary string format. The lexer must process
  escapes at lex time and detect unterminated strings with precise error
  locations."
how = """
1. Add lex_basic_string() method
2. Main loop: consume until closing quote or error
3. Implement lex_escape_sequence() for \t, \n, \r, \\, \", \uXXXX, \UXXXXXXXX
4. Implement lex_unicode_escape() with validation
5. Wire into lex_token() dispatch
6. Add unit tests for all escape sequences and error cases
"""
backup = "Defer escape processing to post-lex pass if implementation is error-prone"

[context]
files = ["src/lexer.rs", "src/error.rs"]
dependencies = []
```

The specs include test cases. The basic strings spec lists 25+ scenarios:
simple strings, escape sequences, unicode handling, error conditions. The
models know what to test because they debated it during planning.

The 30 specs totaled 2.1k lines. That's not wasted tokens. It's a contract you
can review before any code exists.

## The ARF Format

Specs use TOML with a standard structure:

```toml
order = 1
what = "one sentence description"
why = "context and motivation"
how = """
Step-by-step implementation plan
"""
backup = "fallback approach if primary fails"

[context]
files = ["paths/to/files"]
dependencies = ["step names this depends on"]
```

The format is simple on purpose. No special tooling needed to read or edit.
Any text editor works. The structure enforces that every step has a rationale,
a plan, and a fallback.

## Why Separate Stages

The stages are separate because you need intervention points.

After debate, review the roadmap. Does the architecture make sense? Are the
steps in the right order? Edit `.finna/roadmap.arf` if not.

After spec, review the specs. Is the implementation plan correct? Are the test
cases comprehensive? Edit the spec files or re-run `finna spec --step X`.

After implement, review the changes. Did the edits apply cleanly? Is the code
what you expected? The specs told you what would happen; now verify it did.

If you run `finna "idea"` without the subcommands, it runs all stages in
sequence. That's fine for exploration. But for real work, you probably want
the review gates.

## Multi-Model Consensus

The debate phase isn't just asking three models and picking one. All three
responses get synthesized:

1. Claude, Codex, and Gemini each propose an approach in parallel
2. Claude sees all three proposals and synthesizes consensus
3. Disagreements become explicit tradeoffs in the final plan

One model might over-engineer authentication. Another might skip edge cases.
The synthesis catches both failure modes. You get architecture that multiple
models have pressure-tested.

## Implementation

finna is ~500 lines of Rust. It shells out to `claude`, `codex`, and `npx
@google/gemini-cli` for the actual model calls. No API keys in the binary,
no config files. If you have the CLIs installed, finna works.

The implementation phase runs models in parallel for each step, synthesizes
their edit proposals, and applies the changes. Edits are JSON with `path`,
`old`, and `new` fields. Simple find-and-replace, no AST manipulation.

```rust
#[derive(Debug, serde::Deserialize)]
struct Edit {
    path: String,
    old: String,
    new: String,
}
```

If an edit can't find the target text, it warns and continues. If the file
doesn't exist, it creates it. The implementation is deliberately simple
because the specs already contain the complexity.

## What finna Is Not

finna is not a replacement for writing code. It's a planning tool that happens
to also generate code. The value is in the specs, not the implementation.

If the generated code is wrong, you fix the spec and re-run. If the
architecture is wrong, you fix the roadmap and re-spec. The code is a
side effect of getting the plan right.

finna is also not trying to be general-purpose. It solves one problem: turn an
idea into a structured plan with implementation. No plugins, no extensibility,
no configuration. One tool, one job.

## Getting Started

```bash
# Clone and build
git clone https://github.com/ducks/finna
cd finna
nix-shell
cargo build --release

# Run on your idea
./target/release/finna "your idea here"
```

Requires `claude`, `codex`, and `npx @google/gemini-cli` to be installed and
authenticated. If a model fails, finna continues with the others.

The source is at [github.com/ducks/finna](https://github.com/ducks/finna).

---

The test project (TOML parser specs) is at
[github.com/ducks/finna-toml-parser](https://github.com/ducks/finna-toml-parser).
