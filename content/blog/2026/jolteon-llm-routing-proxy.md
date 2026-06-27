---
title: "jolteon: An LLM Routing Proxy for Discourse"
date: 2026-06-27
description: "We run several vLLM backends for Discourse's AI features. Hardcoding which backend handles which feature was getting messy. jolteon is the Rust proxy we built to fix that - it shipped yesterday."
taxonomies:
  tags:
    - ai
    - rust
    - infrastructure
    - discourse
---

Two weeks ago, someone posted an internal proposal:

> My dream for the future is a good proxy that automatically sends requests to
> the most appropriate model, allowing us to run a heterogeneous AI inference,
> and have it routed to our customers automatically.

The concrete version of the problem: we'd deployed DeepSeek 4 Flash to a server
in one region. It's good for long-form generation - periodic reports, data
explorer summaries, dashboard highlights. But it's a single instance and has no
vision support. Meanwhile Qwen 3 handles title suggestions and translation just
fine on smaller, faster hardware. The gap between "we have these models" and "the
right request reaches the right model" was just config - but config scattered
across individual Discourse AI setups with no central health checking or fallback
logic.

The proposal asked for a centralized smart router that could:

- receive all LLM inference requests from hosted customers
- centralize health checking across all deployments
- route each request to the most appropriate model using context from Discourse -
  feature name, hosting tier, daily AI credit usage

jolteon is that proxy. It shipped yesterday. Here's how it works.

## Built with Fable

The proposal landed two weeks ago. What made it possible to ship this fast was
Fable - an experimental Claude model variant Anthropic was running for a period.
I used it to write the entire proxy in a few hours.

Fable was faster than Opus and reasoned differently - more willing to work through
intermediate steps explicitly. For a project like this, where you're sketching out
proxy architecture, async Rust, streaming SSE semantics, and per-pool config
schemas all at once, that mattered. It could hold the whole design in mind and
produce working code rather than plausible-looking scaffolding.

The reasoning adapter work especially - where jolteon rewrites OpenAI-style
`reasoning_effort` fields into vLLM-specific knobs before forwarding to Qwen3 and
DeepSeek backends - involved a lot of "here is the vLLM template behavior, here is
what the client sends, figure out the right rewrite" prompts. Fable worked through
the token budget math and template key conflicts step by step.

It's no longer available. But two weeks from proposal to production is the result.

## The routing problem

For jolteon to route intelligently, Discourse needed to tell it something about
each request. We added a set of headers that discourse-ai attaches when sending
inference requests - feature name, hosting tier, whether the site is on a trial,
quota usage, and whether the payload contains images:

```
X-Discourse-AI-Feature: ai_bot
X-Discourse-AI-Tier: standard
X-Discourse-AI-Trial: 1
X-Discourse-AI-Quota-Used: 87
X-Discourse-AI-Vision: 1
```

The routing logic combines these to land on a quality class: `fast`, `balanced`,
or `frontier`. Then it picks a backend pool from a preference ladder for that
class.

```yaml
classes:
  fast:
    ladder:
      - { qwen-small: 70, deepseek-flash: 30 }
  balanced:
    ladder:
      - { deepseek-flash: 80, qwen-large: 20 }
      - { qwen-small: 100 }          # fallback
  frontier:
    ladder:
      - { qwen-large: 100 }
      - { deepseek-flash: 100 }      # fallback
      - { qwen-small: 100 }          # fallback
```

Some features get a base class in config. `ai_bot` is frontier. `translate` is
fast with a hard cap so it can't escalate even if tier would normally push it
higher. Paid tiers get a +1 modifier. Trials get -1. Over 80% quota gets -1.
Over 150% gets -2. The modifiers stack, the result gets clamped, the cap gets
applied.

Within a pool, backends are selected least-connections. Vision requests drop
non-vision pools from the entire ladder. If a backend fails before the first
response byte, jolteon retries the next backend, then the next ladder step.
Once streaming starts, retries aren't possible.

## Why Rust

I wanted a single stateless binary with no runtime dependencies. Rust handles the
async proxying well - SSE streams run up to 300 seconds and the proxy can't touch
a single byte of the response body. The request body needs to be buffered (so
failed attempts can be replayed), but the response must stream through unchanged.

Rust's type system was also useful for the routing logic. The feature-to-class
mapping, the modifier math, the ladder walk - all of it is a pure function over
the policy and a snapshot of backend state. It's straightforward to test.

## Reasoning parameter adaptation

This is the weirdest part of jolteon and the part that took the most iteration.

Discourse is configured as an OpenAI Chat Completions client. It sends
`reasoning_effort: "medium"` when the user has reasoning enabled. But vLLM
doesn't implement that field the same way across models. Qwen3 needs
`thinking_token_budget` and `chat_template_kwargs.enable_thinking`. DeepSeek V4
needs `chat_template_kwargs.thinking` and its own `reasoning_effort` inside that
object.

jolteon handles this with per-pool reasoning adapters:

```yaml
pools:
  qwen-small:
    reasoning:
      adapter: qwen3
      forward_reasoning_effort: true
      effort_budgets:
        low: 512
        medium: 2048
        high: 8192
```

The adapter fires per attempt, not once per request. If a request fails over from
qwen-large to deepseek-flash, jolteon rewrites the body again using the DeepSeek
adapter before the second attempt. The client sent one request with
`reasoning_effort: medium`. Each backend got the right vLLM fields for its
template.

## Hot reload

The policy is a YAML file. Reload it without dropping connections:

```bash
kill -HUP $(pidof jolteon)
```

Backend health and in-flight counts survive the reload. The only thing that
requires a restart is changing the listen address. In practice, tuning weights or
adding a backend is a YAML edit, a commit, and a SIGHUP. No downtime.

The `--check` flag validates the policy without starting the proxy:

```bash
jolteon --check routing-policy.yml
```

Unknown fields are rejected, so misspelled keys fail fast rather than silently
doing nothing. That check is wired into our deploy pipeline.

## What it looks like in production

Every request produces one structured JSON log line:

```json
{
  "site": "example.com",
  "feature": "ai_bot",
  "tier": "standard",
  "trial": false,
  "quota_used": 0,
  "vision": false,
  "class": "frontier",
  "pool": "qwen-large",
  "backend": "dub-1",
  "attempts": 1,
  "status": 200,
  "ttft_ms": 142,
  "duration_ms": 9214,
  "bytes": 48211
}
```

`ttft_ms` is time from request arrival to first upstream body byte - the latency
number that matters for streaming responses. The line emits when the stream ends,
including on client disconnect.

Prometheus metrics on `/metrics` give you histograms for ttft and duration,
attempt failure counts by backend and reason, in-flight gauges. The status
endpoint at `/jolteon/status` shows every pool and backend in JSON.

## Open source plans

The proxy is Discourse-specific in one place: the `X-Discourse-AI-*` header
names. Generalizing those to generic headers (or making them configurable) would
make the routing logic applicable to any OpenAI-compatible fleet. I'd like to do
that and open source it - the ladder routing, vision handling, and reasoning
adaptation are useful beyond Discourse.

For now the source is in an internal repo. The architecture, full config schema,
and smoke/load/reload/reasoning test scripts are in the README. If you're building
something similar and want to compare notes, reach out.

## Links

- [discourse-ai](https://github.com/discourse/discourse/tree/main/plugins/discourse-ai) - the Discourse AI plugin jolteon fronts
- [vLLM](https://github.com/vllm-project/vllm) - the inference backend
