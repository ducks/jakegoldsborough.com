---
title: "Building a JSON Parser with Multi-LLM Orchestration (Part 1)"
date: 2026-02-07
description: "Using lok to orchestrate four LLMs debating design decisions,
  then synthesizing specs for a Rust JSON parser. The debate phase surfaced
  edge cases no single model would have caught."
taxonomies:
  tags:
    - ai
    - tools
    - rust
    - dev
---

I've been building lok, a multi-LLM orchestration tool, and I wanted to put it
through its paces on a real project. What better than a JSON parser? It's a
classic learning project with enough nuance to surface interesting design
decisions.

Here's the premise: instead of just diving into code, what if I let multiple
LLMs debate the design first? Then synthesize their consensus into specs. Then
have them collaboratively implement it.

## The Setup

I started with a simple question:

```bash
lok debate "We want to write a JSON parser from scratch as a learning project.
Debate: What language should we use? What features should it support?
What should the architecture look like?"
```

Four models participated: Claude, Codex (GPT-5.2), Gemini, and Qwen 3 Coder
(running locally via Ollama).

## Round 1: Surprising Agreement

All four converged on Rust. The reasoning varied:

**Claude** focused on the learning angle: "Forces you to think about ownership
and memory layout. You'll learn more writing a parser in Rust than in Python/JS
where you can be sloppy."

**Codex** got practical: "Ownership semantics force you to think about buffer
management. `Result<T, E>` makes error handling explicit."

**Gemini** went for performance: "Zero-cost abstractions mean clean code
compiles to efficient machine code."

**Qwen** hit safety: "Enums with exhaustive matching prevent invalid parser
states."

On architecture, unanimous: lexer + recursive descent parser. No surprises
there.

## Round 2: The Interesting Bits

Numbers sparked actual debate. The naive approach stores JSON numbers as `f64`:

```rust
Number(f64)  // Simple but WRONG
```

Codex caught it: "Treating numbers as f64 is not spec-correct. JSON allows
arbitrary precision. The safest approach is storing the original string."

```rust
Number(&'a str)  // Preserves original, validates grammar
```

This is why multi-model debate works. I might have defaulted to f64 and hit
precision bugs later.

Another good catch from Gemini: recursive descent needs depth limits. Without
them, an adversarial input like `[[[[[[[[...` blows the stack. Simple fix, easy
to forget.

## The Consensus

After three rounds, the models settled on:

1. **Language**: Rust
2. **Architecture**: Lexer (iterator-based) + Recursive Descent Parser
3. **Number handling**: Store as string, not f64
4. **Zero-copy**: Use `Cow<'a, str>` where possible
5. **Safety**: Configurable depth limits
6. **Features**: RFC 8259 strict first, extensions later

## Generating Specs

With design decisions locked, I fed the debate conclusions into `lok spec`:

```bash
lok spec "Build a JSON parser in Rust with these design decisions:
- Lexer + Recursive Descent Parser
- Numbers stored as string, not f64
- Zero-copy with Cow<'a, str>
- Depth limits for safety
- RFC 8259 strict compliance"
```

This queries multiple backends, synthesizes a consensus roadmap, then breaks
each step into subtasks. The output:

```
.arf/specs/
  roadmap.arf
  01-core_types/     (5 subtasks) - Span, Error, Token, Value
  02-lexer/          (5 subtasks) - Iterator-based tokenizer
  03-parser/         (4 subtasks) - Recursive descent
  04-number_validation/ (2 subtasks) - RFC 8259 number format
  05-error_reporting/   (4 subtasks) - Line/column errors
  06-test_suite/        (3 subtasks) - JSONTestSuite compliance
  07-extension_hooks/   (4 subtasks) - Future comments/trailing commas
```

Each subtask is an `.arf` file (Agent Reasoning Format) with structured fields:

```toml
order = 1
what = "Core Lexer struct implementing Iterator over tokens"
file = "src/lexer/lexer.rs"
why = "Main lexing logic that transforms input bytes into token stream"
how = """
Struct Lexer<'a> with input: &'a str, pos: usize. Implement
Iterator<Item = Result<Token<'a>, LexError>>. Dispatch on current
byte: punctuation returns immediately, keywords verify literals,
strings handle escapes, numbers capture as slice.
"""

[context]
inputs = "Raw JSON string"
outputs = "Stream of Token results"
```

These specs become the contract for implementation.

## What Multi-Model Debate Surfaces

**Edge cases no single model catches.** The f64 precision issue came from Codex.
The depth limit vulnerability came from Gemini. Each model has blind spots.
Claude focused on educational value, Codex on spec correctness, Gemini on
performance, Qwen on safety.

**Consensus beats any single model.** Not because the average is smarter, but
because different models catch different things. Three rounds of debate with
four models surfaced issues I'd have hit weeks into implementation.

## What's Next

Part 2 will cover `lok implement`, which takes these specs and:

1. Queries multiple backends in parallel for each subtask
2. Synthesizes consensus code from the proposals
3. Writes the file and verifies it compiles
4. Commits each file with an atomic git commit
5. Records structured reasoning traces (ARF) alongside the code

The implementation phase is where things get interesting. Backends disagree on
details, synthesis has to resolve conflicts, and verification catches when the
generated code doesn't actually compile.

Stay tuned.
