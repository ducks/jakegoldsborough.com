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

## It Stopped Pretending to Be Claude Code

The original system prompt was modeled closely after Claude Code. That made
sense when the project was an architecture exercise. It made less sense once I
started using it as its own tool.

claux now has a native system prompt. It identifies itself as claux, describes
the tools and permission boundaries it actually has, and lives in one readable
Rust file. What you read is what the model gets. There is no hidden prompt
downloaded from somewhere else.

Authentication changed too. Early versions could reuse credentials from a
Claude subscription. That was convenient, but it was not an API integration I
could responsibly build around. claux now expects a real provider API key. I
ended up using OpenRouter, which also forced the configuration model to grow
up.

The old config described one provider and one model:

```toml
model = "claude-sonnet-4-20250514"
```

The current config has named providers and model profiles:

```toml
default_profile = "deepseek"

[providers.openrouter]
type = "openai"
base_url = "https://openrouter.ai/api/v1"
protocol = "chat_completions"
api_key_env = "OPENROUTER_API_KEY"

[model_profiles.deepseek]
provider = "openrouter"
model = "deepseek/deepseek-v4-flash"
display_name = "DeepSeek"

[model_profiles.kimi]
provider = "openrouter"
model = "moonshotai/kimi-k3"
display_name = "Kimi"
```

The TUI opens on a session browser now. Starting a chat asks which configured
model to use. Opening an old chat restores the provider, endpoint, protocol,
and model that created it. `/model` can switch profiles without accidentally
sending an OpenAI model ID to Anthropic or carrying provider state across the
boundary.

There is also `claux config init` for Anthropic, OpenAI, OpenRouter, and Ollama,
plus `claux doctor` to check the configuration before finding out it is wrong
halfway through a turn.

This was the point where claux stopped being "Claude Code in Rust" and became a
multi-provider harness with opinions of its own.

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
are persisted now, including tool calls and results, and old malformed
histories are repaired when they load. Switching sessions also clears all the
state that should not cross the boundary: messages, provider continuation
cursors, cost counters, todo state, and temporary permission grants.

That sounds obvious. It was several separate bugs.

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

The rest of the boundary got the same treatment: Bash cancellation kills the
whole subprocess tree, file reads are bounded and cancellable, binary command
output is suppressed instead of fed to the model as replacement characters,
WebFetch validates redirects against private-network access, and terminal
control characters from tools are sanitized before rendering.

Sub-agents inherit the parent session's permission mode too. A worker cannot
quietly acquire more authority than the conversation that spawned it.

## The Protocol Edge Cases Are the Harness

The happy-path loop from Part 1 still fits on a screen:

1. Send messages
2. Stream a response
3. Run tool calls
4. Send results
5. Repeat

The production version is mostly answers to "what if?"

What if an SSE network chunk splits a multibyte UTF-8 character? The decoder
has to buffer incomplete bytes instead of corrupting the response.

What if the model returns malformed tool-call JSON? claux classifies that
failure separately from an authentication or rate-limit error and retries the
response once instead of executing an ambiguous partial batch.

What if compaction rewrites history while the OpenAI Responses API has a
continuation cursor? The cursor must be reset or the next request continues
from a conversation that no longer exists.

What if the model hits its output limit? That is not the same as the prompt
being too large. One should increase the output allowance; the other should
compact the input.

What if cancellation arrives between a tool call and its result? What if
steering skips half a parallel batch? What if an unknown tool is requested?
Every one still needs a result before the next provider request.

There were dozens of fixes in this category:

- Typed API failures instead of matching strings in error messages
- Provider state resets after compaction and session changes
- Prompt caching breakpoints for Anthropic
- Transactional compaction that preserves history when summarization fails
- Unicode-safe TUI input and terminal paste handling
- Rate-limit errors that include the provider's actionable message
- Exact command-scoped "always allow" grants for Bash
- Cancellation checks immediately before file mutation
- Foreign keys and private permissions for the session database

This is the part I underestimated in April. An agent harness is a protocol
state machine attached to a filesystem. Either side can punish small mistakes.

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
it in a machine-readable form.

One-shot mode now has a versioned JSON contract:

```json
{
  "schema_version": 1,
  "result": "...",
  "model": "deepseek/deepseek-v4-flash",
  "usage": {
    "input_tokens": 123,
    "output_tokens": 45,
    "cache_read_tokens": 67,
    "cache_creation_tokens": 0,
    "cost_usd": 0.01
  }
}
```

OpenRouter reports the real request cost when it is available. Otherwise claux
uses configured or built-in model pricing. If neither exists, it says the cost
is unavailable instead of inventing zero.

The first isolated telemetry smoke test passed and cost one cent. Then I ran
the full matrix again:

| Harness | Model | Result | Input tokens | Cached | Output tokens | Cost |
|---|---|---:|---:|---:|---:|---:|
| Codex | GPT-5.6 Sol | 3/3 | 557,861 | 453,888 | 6,813 | unavailable |
| Claude Code | Sonnet 5 | 3/3 | 1,214,607 | 1,176,257 | 12,653 | $0.77257 |
| claux | DeepSeek V4 Flash | 3/3 | 615,789 | 495,360 | 23,790 | $0.02396 |

Codex did not report cost, so zero would be the wrong number. Claude Code and
claux did. DeepSeek completed the same three verified recoveries for about 2.4
cents total. Claude/Sonnet cost about 77 cents. That is not a model ranking --
the harnesses and models differ, and one easy scenario is nowhere near enough
data -- but it is exactly the kind of tradeoff I wanted the runner to expose.

This is still one incident. A model going three for three on an nginx typo does
not prove it is generally better at infrastructure work. But the machinery is
real now: same task, fresh machines, objective verifier, repeated trials,
tokens, cache usage, runtime, and cost.

That is enough to start asking better questions.

## Where We Are Now

| | Part 3 | Part 4 |
|---|---:|---:|
| Rust files | 26 | 56 |
| Rust lines | 4,000+ | 21,345 |
| Tests | 60 | 350 passing |
| Session storage | JSONL | SQLite |
| Model config | One active provider | Named provider/model profiles |
| Filesystem boundary | Permission prompts | Permissions + workspace containment |
| Evaluation | Unit tests | Behavioral evals + isolated agent trials |

There is plenty left. The Replaybook suite needs more than one scenario. MCP
tools are not covered by the native filesystem sandbox. Landlock containment
is Linux-specific. The eval numbers need many more tasks before anyone should
read model rankings into them.

But claux is no longer a weekend rewrite of leaked TypeScript. I can start it,
pick a cheap model, interrupt it when it heads the wrong direction, inspect or
undo its work, and measure what the turn cost.

The rewrite taught me how Claude Code was built. Dogfooding taught me why the
last 17,000 lines exist.

---

Previous: [Part 3: TUI, Agents, and Multi-Provider](/blog/2026/rewriting-claude-code-in-rust-part-3/)

Source: [github.com/ducks/claux](https://github.com/ducks/claux)
