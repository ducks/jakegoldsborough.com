---
title: "Rewriting Claude Code in Rust, Part 4: From Clone to Harness"
date: 2026-08-01
description: "Four months of dogfooding turned claux from a 4,000-line Claude Code rewrite into a sandboxed, multi-provider agent harness with 350 tests and isolated evaluations."
taxonomies:
  tags:
    - ai
    - rust
    - tools
    - dev
---

At the end of [Part 3](/blog/2026/rewriting-claude-code-in-rust-part-3/),
I described everything claux still needed as "polish."

I was wrong.

The agent loop was done. It could stream tokens, call tools, spawn sub-agents,
and talk to multiple providers. That took about 4,000 lines of Rust.

Four months later, claux is over 21,000 lines and has 350 passing tests. Most
of that growth was not glamorous. It was cancellation, session isolation,
malformed streaming events, filesystem boundaries, provider state, cost
accounting, and discovering all the ways a tool-using language model can leave
a conversation subtly invalid.

In other words, it was the work that turned a rewrite into a harness.

## The Human Can Change Their Mind

The most useful feature I added is mid-turn steering.

Say the model starts running a long test suite, or you notice it has
misunderstood the problem after the third tool call. Most agent interfaces make
you wait, kill the entire turn, or queue a message that the model will read
after it finishes doing the wrong thing.

In claux, you type while the tools are running and press Enter. The running
tool is cancelled, the rest of the queued batch is skipped, and your message
goes to the model immediately.

The skipped calls still receive synthetic tool results. That detail matters.
Both Anthropic and OpenAI require every tool call in the conversation to have
a matching result. Dropping one makes the next API request invalid.

The same idea works at a permission prompt. Instead of answering `y`, `n`, or
`a`, you can type:

```
don't edit that file, fix this in the parser instead
```

claux denies the pending tool and sends the text back as steering. It is one
motion instead of deny, wait, prompt again.

Ctrl+C uses the same machinery. It cancels the provider request or running
tool, pairs any dangling tool calls with interrupted results, and leaves the
session resumable. Press it twice to quit.

The larger principle is that the human is still participating during an agent
turn. I do not want to become a spectator just because the model started using
tools.

## It Stopped Pretending to Be Claude Code

The original system prompt was modeled closely after Claude Code. That made
sense when the project was an architecture exercise. It made less sense once I
started using it as its own tool.

claux now has a native, readable system prompt that describes the tools and
permission boundaries it actually has. What you read is what the model gets.

Authentication changed too. Early versions could reuse credentials from a
Claude subscription. That was convenient, but it was not an API integration I
could responsibly build around. claux now expects a real provider API key.

Using OpenRouter forced the configuration model to grow up. Instead of one
global model string, providers and model profiles are named separately:

```toml
[providers.openrouter]
type = "openai"
base_url = "https://openrouter.ai/api/v1"
protocol = "chat_completions"
api_key_env = "OPENROUTER_API_KEY"

[model_profiles.deepseek]
provider = "openrouter"
model = "deepseek/deepseek-v4-flash"
```

The TUI opens on a session browser. Starting a chat asks which configured model
to use. Opening an old chat restores the provider, endpoint, protocol, and
model that created it. That prevents a resumed conversation from silently
sending an OpenAI model ID to Anthropic.

This was the point where claux stopped being "Claude Code in Rust" and became a
multi-provider harness with opinions of its own.

## Undo Without Erasing Human Work

Agent harnesses are good at changing six files when you expected one. Git can
undo that, but `git reset` is too blunt when you have unrelated work in the
same tree.

claux now captures a safe checkpoint around every turn:

```text
/diff
/undo-turn
```

`/diff` shows exactly what the last turn changed. `/undo-turn` restores those
files only if they still match the state at the end of the turn. If I edited
one afterward, the entire undo refuses to run rather than overwriting my newer
work.

The checkpoints are read-only with respect to Git. claux does not create
commits or stash the repository behind my back. It snapshots tracked and
non-ignored files itself, including modes and symlinks.

Session storage moved from JSONL to SQLite along the way. Full conversations
are persisted now, including tool calls and results. Switching sessions clears
provider continuation cursors, cost counters, todo state, and temporary
permission grants. That sounds obvious. It was several separate bugs.

## Permission Is Not Containment

A permission prompt answers whether the model is allowed to try an operation.
It does not constrain what the process can physically do after I click yes.

Those need to be separate layers.

The built-in Read, Write, Edit, Glob, and Grep tools now default to the
workspace where claux started. Paths and symlinks are resolved before access,
so `workspace/link-to-home/.ssh` does not become an escape hatch.

Bash is harder. A compiler needs temporary directories. Git needs its metadata.
A test may start child processes. On Linux, claux uses Landlock to let commands
read the system while restricting writes to:

- The workspace
- System temporary directories
- `/dev/null`
- The repository's Git metadata

Approving `cargo test` should not implicitly authorize writes to the rest of
my home directory.

The default `auto` policy enables that containment when the kernel supports it
and warns when it cannot. `workspace_write` fails closed. `unrestricted` is an
explicit escape hatch. A project-local config can always tighten the policy,
but cannot loosen it unless I trust that project.

For the same reason, Bash cancellation kills the whole subprocess tree. A
cancelled compiler should not leave its child processes running after the
conversation has moved on.

Sub-agents inherit the parent session's permission mode too. A worker cannot
quietly acquire more authority than the conversation that spawned it.

## The Protocol Edge Cases Are the Harness

The happy-path loop from Part 1 still fits on a screen: send messages, stream a
response, run tools, send results, repeat. The production version is mostly
answers to "what if?"

What if an SSE network chunk splits a multibyte UTF-8 character? The decoder
has to buffer incomplete bytes instead of corrupting the response.

What if compaction rewrites history while the OpenAI Responses API has a
continuation cursor? claux used to retain the cursor from the old history. The
next request could combine that stale response ID with a newly summarized
conversation. Resetting provider state when history changes fixed a failure
that only appeared after a long session.

What if cancellation arrives between a tool call and its result? Steering can
skip half a parallel batch, and a malformed tool response can be retried. Every
path still has to produce a matching result before the next provider request.
Dropping one makes the conversation invalid.

These are not independent polish fixes. An agent harness is a protocol state
machine attached to a filesystem. Either side can punish small mistakes.

## Stop Evaluating on Vibes

350 tests is useful, but most of them still test pieces: config resolution,
stream decoding, permissions, storage, tool behavior.

I added fixture-driven behavioral evaluations for complete multi-round turns.
They use fake provider streams but real tools in isolated workspaces. An eval
can assert that the model read the right file, received the right permission
result, recovered from an interrupted tool, and left the expected files on
disk. They run without credentials or a network connection.

Then I connected claux to
[replaybook](/blog/2026/replaybook-incident-replay-trainer/), my infrastructure
incident trainer.

Replaybook already knew how to start a genuinely broken service and verify an
objective recovery condition. I converted its nginx 502 incident into a Harbor
task, then ran three coding agents against the same prompt:

- Codex with GPT-5.6 Sol
- Claude Code with Sonnet 5
- claux with DeepSeek V4 Flash through OpenRouter

The first run was nine trials. All nine fixed the incident. That was
interesting, but they shared too much host state, so I built disposable NixOS
workers. Each trial now gets a fresh VM, a fresh Docker environment, its own
SSH port, and only the credential needed by that agent.

The isolated runs also went nine for nine.

The next problem was embarrassingly practical: Harbor reported cost for Claude
but showed claux as zero. claux tracked the usage internally, but did not expose
it in a machine-readable form. One-shot mode now emits versioned JSON with the
model, token counts, cache usage, and provider-reported or estimated cost.

OpenRouter reports the real request cost when it is available. If neither the
provider nor the configured pricing knows the model, claux reports unavailable
instead of inventing zero.

The full isolated matrix looked like this:

| Harness | Model | Result | Median agent time | Input tokens | Output tokens | Cost |
|---|---|---:|---:|---:|---:|---:|
| Codex | GPT-5.6 Sol | 3/3 | 1:05 | 557,861 | 6,813 | unavailable |
| Claude Code | Sonnet 5 | 3/3 | 1:04 | 1,214,607 | 12,653 | $0.77257 |
| claux | DeepSeek V4 Flash | 3/3 | 0:59 | 615,789 | 23,790 | $0.02396 |

DeepSeek completed the same three verified recoveries for about 2.4 cents
total. Claude/Sonnet cost about 77 cents. The median times were similar, but
one DeepSeek run took 7:11 and generated 15,751 output tokens; its other runs
took 0:40 and 0:59. Repeated trials expose that variance. A single run would
have hidden it.

This is still one incident. A model going three for three on an nginx typo does
not prove it is generally better at infrastructure work. But the machinery is
real now: same task, fresh machines, objective verifier, repeated trials,
tokens, runtime, and cost.

## Where We Are Now

There is plenty left. The Replaybook suite needs more than one scenario. MCP
tools are not covered by the native filesystem sandbox, and Landlock
containment is Linux-specific. The eval numbers need more tasks before anyone
should read model rankings into them.

But claux is no longer a weekend rewrite of leaked TypeScript. I can start it,
pick a cheap model, interrupt it when it heads the wrong direction, inspect or
undo its work, and measure what the turn cost.

The rewrite taught me how Claude Code was built. Dogfooding taught me why the
last 17,000 lines exist.

---

Previous: [Part 3: TUI, Agents, and Multi-Provider](/blog/2026/rewriting-claude-code-in-rust-part-3/)

Source: [github.com/ducks/claux](https://github.com/ducks/claux)
