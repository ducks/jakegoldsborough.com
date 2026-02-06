---
title: "Lok Part 5: Multi-Agent Planning with lok spec"
date: 2026-02-06
description: "Lok gains a spec command that turns task descriptions into
  structured implementation plans. Multiple LLMs propose, debate, and converge
  on a roadmap before any code gets written."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

The hardest part of building software isn't writing code. It's figuring out what
to build and in what order. LLMs are great at generating code, but they're also
great at generating the wrong code because they started implementing before
thinking through the structure.

That's what `lok spec` solves.

## The Problem with "Just Build It"

When you give an LLM a big task like "build a C compiler," it starts coding
immediately. Maybe it picks the lexer first, maybe the parser. Maybe it designs
types that won't work for later phases. By the time you realize the architecture
is wrong, you've burned tokens and time.

The fix is obvious in retrospect: plan before you build. But not just any plan.
A plan that multiple models have debated and converged on.

## Propose, Refine, Pick

`lok spec` uses a three-step process:

1. **Propose**: All backends generate roadmaps in parallel
2. **Refine**: Synthesize roadmaps into a consensus plan
3. **Pick**: Generate detailed specs from the consensus

This is the same pattern as debate mode, but applied to planning instead of
analysis. Each backend proposes how they'd structure the project. Then we
synthesize the best ideas and resolve contradictions. Finally, we generate
specs that capture the agreed approach.

```bash
lok spec "Build a C compiler in Rust. Take C source as input, produce x86-64
  assembly output. Include lexer, parser, semantic analysis, and code
  generation. Focus on correctness over optimization."
```

```
spec: Planning: Build a C compiler in Rust...

spec: Step 1/3: Getting roadmaps from 4 backends...
  ✓ 4/4 backends responded
spec: Step 2/3: Synthesizing consensus roadmap...
  ✓ Consensus reached
spec: Step 3/3: Generating detailed specs...
spec: Step 4/4: Breaking specs into subtasks...
  ✓ lexer → 4 subtasks
  ✓ ast → 5 subtasks
  ✓ parser → 5 subtasks
  ✓ semantic → 5 subtasks
  ✓ ir → 5 subtasks
  ✓ codegen → 5 subtasks
  ✓ driver → 4 subtasks

==================================================
spec: Generated 7 specs in .arf/specs/:

  + roadmap.arf
  + 01-lexer/spec.arf
  + 01-lexer/01-token.arf
  + 01-lexer/02-cursor.arf
  + 01-lexer/03-scanner.arf
  + 01-lexer/04-keywords.arf
  + 02-ast/spec.arf
  ...
```

Four backends looked at "build a C compiler" and each proposed a roadmap. Claude
synthesized them into a unified plan. Then we generated specs for each step, and
broke each step into subtasks (individual files).

## The Output Structure

Specs land in `.arf/specs/` with a nested structure:

```
.arf/specs/
  roadmap.arf
  01-lexer/
    spec.arf
    01-token.arf
    02-cursor.arf
    03-scanner.arf
    04-keywords.arf
  02-ast/
    spec.arf
    01-types.arf
    02-expr.arf
    ...
```

The roadmap is the high-level plan. Each numbered directory is a step. Inside
each step is a `spec.arf` with the overall component spec, plus subtask files
for individual pieces.

A spec file looks like this:

```toml
order = 1
what = "Build the lexer to tokenize C source code"
why = "Parser needs a stream of tokens, not raw characters"
how = "Hand-written scanner with keyword trie, handles preprocessor directives"
backup = "Fall back to regex-based tokenizer if performance is acceptable"

[context]
inputs = "C source code as string or file path"
outputs = "Iterator of Token structs with location info"
dependencies = []
tests = "Tokenize test files, compare against expected token sequences"
```

A subtask file adds a `file` field:

```toml
order = 1
what = "Define token types and structures"
file = "src/lexer/token.rs"
why = "All other lexer components depend on token definitions"
how = "Enum for token kinds, struct for token with span and value"

[context]
inputs = "None - foundational types"
outputs = "Token enum, TokenKind enum, Span struct"
tests = "Unit tests for token construction and display"
```

## Why This Matters

The spec files are [ARF](https://github.com/ducks/arf) format. That means
they're structured, parseable, and auditable. When you review a spec, you're
reviewing the plan before any code exists. If the approach is wrong, you catch
it here, not after 10,000 lines of generated code.

The subtask breakdown is what enables parallel execution. Once you have specs
for `01-token.arf`, `02-cursor.arf`, `03-scanner.arf`, and `04-keywords.arf`,
different agents can work on different files simultaneously. They're not
stepping on each other because each owns their file.

The pattern is recursive. `lok spec` on a project gives you steps. Each step
has subtasks. If a subtask is still too big, you could spec it again. Same
process, different scale.

## Single Backend Fallback

If you only have one backend configured, `lok spec` skips the multi-model
consensus and just asks that backend to plan and spec directly. You still get
the structured output, just without the debate.

```bash
lok spec --backend claude "Build a REST API"
```

The value of multi-backend consensus is catching blind spots. One model might
over-engineer the auth system while another keeps it simple. Synthesis finds
the middle ground. But if you're just exploring or don't have multiple backends
set up, single-model works fine.

## Token Conservation

The multi-agent pattern has a cost: API calls. Four backends generating roadmaps
is four API calls. Synthesis is another. Spec generation is another. Subtask
generation is one per step.

For a 7-step project, that's roughly: 4 (roadmaps) + 1 (synthesize) + 1 (specs)
+ 7 (subtasks) = 13 API calls. Not cheap if you're using expensive models.

But here's the key: every backend's contribution gets used. We're not querying
four models and throwing away three responses. We're synthesizing all four into
something better than any single response.

This is the rule I've been following: if you fire off multiple agents, they
must debate or synthesize. Never query N backends just to pick one.

## What's Next

The specs exist. The next step is execution: read the specs, assign agents to
subtasks, run them in parallel, integrate the results. That's a bigger piece of
machinery, but the foundation is here.

For now, `lok spec` gives you a structured plan that multiple models have
agreed on. Review it, tweak it if needed, then start building with confidence
that the architecture makes sense.

The source is at [github.com/ducks/lok](https://github.com/ducks/lok).

---

Previous: [Part 4: The Self-Healing Loop](/blog/2026/lok-the-self-healing-loop)
