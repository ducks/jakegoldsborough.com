---
title: "Infrastructure Agents, Priced Per Repair"
date: 2026-08-08
description: "I sent several models into copies of the same broken Linux host. The useful number was not token price. It was the cost of a repair that survived restart and reboot."
taxonomies:
  tags:
    - ai
    - infrastructure
    - dev
    - tools
---

This morning I sent four language models into four copies of the same broken
production system.

Each got its own Linux host, the same missing Rails migration, and fifteen
minutes to repair it. They could inspect systemd, PostgreSQL, Redis, Sidekiq,
Nginx, logs, processes, and the deployed application. When they finished, an
external verifier tested the application, restarted the services, tested it
again, rebooted the host, and tested it one more time.

I paid by the token.

This is a strange sentence to type. It is also the direction
[Replaybook](https://github.com/ducks/replaybook) has been heading since I
started using it to evaluate infrastructure agents.

The question is no longer just whether a model is cheap, fast, or good at
coding. The question is how much it costs to produce a repair that actually
survives.

## The wrong unit

Model pricing is usually quoted per million tokens.

That is useful for estimating a bill. It does not tell me whether the model
fixed anything.

A model can be cheap per token and spend ten minutes repeatedly reading the
same logs. It can be expensive per token and diagnose the incident in two tool
calls. It can return a polished explanation while leaving the service broken.
It can make the health check green by starting a second process that disappears
as soon as systemd restarts the real one.

None of those outcomes fit cleanly into input price plus output price.

The unit I care about is a durable repair.

For Replaybook, that means:

- the user-facing behavior works;
- existing work was not lost;
- the expected services still exist;
- the repair survives service restart;
- the repair survives host reboot.

I wrote about why the restart matters in [Evaluating Infrastructure Agents in
Running Systems](/blog/2026/evaluating-infrastructure-agents-in-running-systems/).
The short version is that a passing health check is not evidence of a repair.
Restarting the system destroys temporary success.

Once the verifier can distinguish a repair from a workaround, cost becomes
more interesting. I can divide the total spend by the number of repairs that
survived the full lifecycle.

That is price per repair.

The first controlled comparison already changes when viewed this way. DeepSeek
V4 Flash 0731 completed nine durable repairs for $0.0592, or about 0.66 cents
per repair. The original revision completed eight for $0.0811, or about 1.01
cents per repair. The failed attempt still consumed time and tokens, so its
cost stays in the total spend.

That is not enough data to call either model universally better. It is enough
to show why the successful unit of work belongs in the calculation.

## Same incident, different brains

Replaybook used to be tied closely to one harness. Claux ran inside the worker,
called a model through OpenRouter, and emitted the result Replaybook expected.
That worked, but it mixed two separate questions:

1. Can this model repair the incident?
2. Can Replaybook run this particular harness?

The host evaluator now has a small adapter contract instead. Replaybook owns
the incident VM, instruction, timeout, restart sequence, reboot, and verifier.
The adapter owns one thing: invoke an agent and write a normalized result.

In simplified form, the adapter receives:

```text
REPLAYBOOK_INSTRUCTION_FILE
REPLAYBOOK_MODEL
REPLAYBOOK_WORKSPACE
REPLAYBOOK_RESULT_FILE
REPLAYBOOK_TRANSCRIPT_FILE
```

Claux uses that contract. I also wrote a Codex adapter and ran GPT-5.6 Sol
through the same Nginx incident. It repaired the host in 1:15 and passed both
restart checks. Codex reported token usage but not dollar cost because the run
used my ChatGPT subscription rather than a metered API request.

That missing number is part of the result. Replaybook records unavailable
instead of pretending the cost was zero.

The adapter boundary makes the benchmark about the deployed system rather than
the wrapper around the model. A new harness only needs to accept the incident,
run with the required authority inside the disposable VM, and normalize its
output. It does not get to redefine success.

## The incident is stateful

The migration scenario looks like a normal broken deploy.

The web service is healthy. PostgreSQL is healthy. Sidekiq is running. A
migration file shipped with the application, but the deployed database never
recorded or applied it. Jobs that need the new column fail and enter the retry
path.

The obvious repair is to apply the migration.

The benchmark does not ask the model to edit a fixture and make a test pass. It
starts the services, creates real failed jobs, and retains their exact IDs in
controller-owned state. A passing repair must update the schema, record the
migration, recover those specific jobs exactly once, process new work, and
keep doing all of that after restart and reboot.

This distinction has already caught a plausible but incomplete repair. One
DeepSeek V4 Flash attempt diagnosed the missing column and added it manually.
The application partly recovered, but the deployed migration was still
missing. Replaybook returned `migration_not_applied`.

The model understood the immediate database error. It did not repair the
deployment state.

That is useful failure data. A binary score says zero. The verifier says what
kind of zero it was.

## Buying a small incident-response team

[OpenRouter currently has several agent-oriented models on deep
discounts](https://openrouter.ai/collections/discounted-models). I added four
of them to Claux:

| Model | Input per million | Output per million | Context |
|---|---:|---:|---:|
| DeepSeek V4 Pro | $0.1096 | $0.2192 | 1M |
| GLM 5.2 | $0.182 | $0.572 | 1M |
| Tencent HY3 Preview | $0.063 | $0.21 | 262K |
| Ling 2.6 Flash | $0.01 | $0.03 | 262K |

Then I dispatched all four into the migration scenario:

```sh
python integrations/host/run_host_matrix.py \
  --scenario 014-missing-rails-migration \
  --models \
    deepseek/deepseek-v4-pro \
    z-ai/glm-5.2 \
    tencent/hy3-preview \
    inclusionai/ling-2.6-flash \
  --attempts 1 \
  --concurrency 2
```

Two disposable NixOS VMs run at a time. When one trial finishes, the next model
gets a newly built copy of the same incident. They share the instruction and
verifier, not a filesystem or conversation.

This is where it starts to feel less like prompting and more like a small lab.
The models are independent workers. Nix provides identical systems. Replaybook
owns the experiment. Claux is one possible runtime. The verifier decides
whether any of them did useful work.

## Four models, one migration

Three models repaired the incident on their first attempt. The fourth never
made it through the provider.

| Model | Result | Time | Input tokens | Output tokens | Reported cost |
|---|---:|---:|---:|---:|---:|
| DeepSeek V4 Pro | Durable repair | 2:41 | 377,758 | 6,549 | $0.0082 |
| Tencent HY3 Preview | Durable repair | 2:36 | 468,044 | 6,071 | $0.0144 |
| GLM 5.2 | Durable repair | 4:20 | 969,338 | 10,508 | $0.0618 |
| Ling 2.6 Flash | Provider rejected request | 0:04 | 0 | 0 | unavailable |

All three completed repairs applied and recorded the migration, recovered the
existing jobs, processed new work, and passed service restart and host reboot
verification.

HY3 was fastest by five seconds. DeepSeek was almost as fast, used the fewest
input tokens, and cost less than one cent. GLM also repaired the incident, but
it spent more time exploring how NixOS persistence worked. It considered
wrapping the provisioning service, discovered that the relevant unit files
were in the read-only Nix store, then returned to the simpler durable repair:
apply the migration to PostgreSQL's persistent data directory.

That route was reasonable, but expensive. GLM used about 2.6 times as many
input tokens and cost about 7.5 times as much as DeepSeek for the same verified
outcome.

Ling is not a failed repair. OpenRouter returned HTTP 429 before the model
processed a token. Replaybook currently records that row as an evaluation
failure with no failure category. That is a reporting bug. A provider refusing
to start a trial says nothing about whether the model can repair a Rails
deployment.

The smoke run therefore produced three passes and one unavailable trial, not a
75 percent model pass rate.

## One run is not a leaderboard

I have made this mistake already.

An early version of the Sidekiq scenario checked whether new jobs worked after
the repair. It did not retain the identity of jobs that were queued before the
agent started. A model could clear the old queue, repair future processing, and
pass.

The service was healthy. The customers' work was gone.

The verifier now creates opaque job IDs before the agent enters the host and
requires those exact IDs to reach PostgreSQL. In a later run, an agent used
`BRPOP` while inspecting Redis. That command removed one customer job. The
agent fixed the configuration, processed the remaining work, and saw the
expected number of completion rows because it had also created its own test
job.

The count looked right. One original ID was missing. Replaybook failed the
repair as `backlog_not_recovered`.

Agents test the benchmark while the benchmark tests the agents.

Every surprising trajectory is a chance to find a verifier hole, an answer-key
leak, an infrastructure failure being counted against the model, or a shortcut
that should not count as a repair. Results only become comparable after those
holes are fixed and the scenario version is frozen.

That is why the benchmark site keeps historical results instead of silently
rewriting them. Older runs can still explain model behavior. They should not be
mixed with results from a stronger verifier.

## Bring your own incident

The model matrix is only useful if the incidents resemble work someone cares
about.

Generic Nginx and PostgreSQL failures were enough to prove the evaluation loop.
The newer scenarios are closer to my actual world: Sidekiq watching the wrong
Redis database, a missing Rails migration, a poison job blocking a worker, and
an ActiveRecord pool that cannot support Puma's configured concurrency.

Replaybook now includes a skill for building more of them. It scaffolds the
NixOS service topology, instruction, oracle repair, and declarative verifier.
More importantly, it asks the annoying questions first:

- What exact state must survive?
- Which shortcuts should fail?
- Can the verifier distinguish an empty queue from recovered work?
- Does the repair survive reboot?
- Did an agent-visible filename give away the answer?

There is a matching skill for adding another agent harness.

Those are small features in code. Together they change what Replaybook is. It
is no longer only my collection of incidents running through my agent. Someone
else can bring the operational failure they care about and the harness they
want to test.

## What I want to know

I do not expect one model to be best at every incident.

The interesting result may be that a tiny, cheap model handles obvious
configuration mismatches but stalls on deployment state. A slower reasoning
model may cost more per token but need fewer attempts. A model with a large
context window may survive long investigations without compacting its history.
Another may be excellent at diagnosis and reckless with live queues.

Those are operational characteristics. They are hard to infer from a coding
benchmark and impossible to infer from a price sheet.

I want to know what a durable repair costs, how long it takes, and what gets
lost along the way.

We can measure that now.

---

Source: [github.com/ducks/replaybook](https://github.com/ducks/replaybook)
