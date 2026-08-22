---
title: "What $25 of AI Inference Bought Me"
date: 2026-08-10
description: "I spent $25 sending models into broken Linux hosts. It bought more experimentation than I expected, but the tokens were never the scarce part."
taxonomies:
  tags:
    - ai
    - infrastructure
    - dev
    - tools
extra:
  series: "Replaybook"
---

This weekend my OpenRouter bill crossed twenty-five dollars.

For that money, I sent a small fleet of language models into disposable Linux
hosts and asked them to repair broken production systems. They debugged Nginx,
PostgreSQL, Redis, Sidekiq, Rails migrations, poisoned jobs, and exhausted
connection pools. Every attempt got a clean machine. Every repair had to survive
a service restart and a host reboot.

Some models fixed the incident. Some timed out. Some deleted customer work while
investigating. One spent nearly three hours doing absolutely nothing useful
before I added a timeout.

I paid twenty-five dollars for the whole experiment.

That number does not include my time, my computer, or the years of experience
that told me when a result smelled wrong. It does not mean I built a research
project for the price of lunch.

It does mean one curious engineer can now run an amount of experimentation that
would have sounded ridiculous to me a few years ago.

## I did not start with a benchmark

[Replaybook](https://github.com/ducks/replaybook) started as an incident-response
trainer for humans. It created a broken service, dropped you into a workstation,
and asked you to fix it.

Then I wanted to know how agents would do.

That question turned into disposable NixOS machines, agent adapters, declarative
scenarios, restart and reboot verification, transcript recording, failure
categories, cost tracking, and a public benchmark site. A second repository,
[replaybook-infra](https://github.com/ducks/replaybook-infra), now describes the
public scenario pack separately from the evaluation harness.

I did not sit down with a plan for any of that. I ran one model against one
broken Nginx configuration. It passed. I ran another. Then I wanted three
attempts. Then multiple models. Then real Linux hosts instead of Docker
containers. Then Rails and Sidekiq incidents that looked more like systems I
actually work on.

The cheap inference made each next question easy to ask.

## A tiny research loop

The loop now looks like this:

1. Build a broken but realistic system.
2. Give several models the same incident report.
3. Let each one investigate a fresh copy of the host.
4. Verify the user-facing behavior.
5. Restart the services and verify again.
6. Reboot the machine and verify one more time.
7. Compare success, time, cost, tool use, and failure mode.

That is not frontier model research. I am not training a foundation model or
running a cluster full of GPUs. I am measuring how existing agents behave in a
small operational environment.

But it is still research in the ordinary sense. I form a question, build an
experiment, run it repeatedly, find out that my experiment is wrong, fix it,
and run it again.

The last part happens a lot.

## The agents found the holes

An early Sidekiq verifier checked that the queue was empty and that the expected
number of jobs had completed. That sounded reasonable.

Then an agent used `BRPOP` while inspecting Redis. `BRPOP` does not inspect a
job. It removes one.

The agent repaired the Redis configuration, processed the remaining work, and
created its own test job. The final completion count looked right. The queue was
empty. The service was healthy.

One original customer job was gone.

The model had not merely failed the benchmark. It had shown me that the
benchmark was incapable of measuring what I claimed it measured.

I changed the verifier to create opaque job IDs before the agent entered the
host and require those exact IDs to appear in durable storage afterward. The
same behavior now fails as `backlog_not_recovered`.

Another scenario leaked its answer through an agent-visible filename. Another
treated a provider rejection as a failed repair. Another let a temporary fix
pass until I added the reboot check. I learned to separate unavailable trials
from model failures, freeze verifier versions, and preserve old results without
mixing them into current ones.

The models were not only subjects. They were adversarial testers for the
evaluation itself.

## What twenty-five dollars actually bought

The obvious answer is tokens.

Those tokens became repeated trials across DeepSeek, GLM, HY3, Minimax, Kimi,
Laguna, Luna, Qwen, Codex, and a few others. They became long transcripts of
models reading logs, editing deployed configuration, restarting services, and
occasionally reasoning themselves into a circle.

The more useful answer is iteration.

Twenty-five dollars bought enough cheap attempts that I did not have to protect
my first idea. I could throw away a verifier, strengthen a scenario, rerun the
matrix, and see whether the result changed. I could compare reasoning levels. I
could discover that a discounted model repaired every incident in one suite,
while a much more expensive model reached the same score for several dollars.
I could spend fifty cents learning that a provider would not serve a request.

None of those individual observations is a scientific conclusion. The sample
sizes are small, the models change, and the harness is still evolving.

Together, though, they create a body of evidence I did not have before. I can
see which incidents produce loops, which models touch live state recklessly,
which repairs survive reboot, and what each durable repair costs.

I wrote more about that unit in [Infrastructure Agents, Priced Per
Repair](/blog/2026/infrastructure-agents-priced-per-repair/). Price per token is
interesting to whoever pays the API bill. Price per durable repair is
interesting to whoever owns the system.

## The expensive part was judgment

The twenty-five-dollar framing is fun, but it hides the important cost.

The agents could produce trajectories faster than I could read them. They could
run overnight while I walked away. They could generate far more behavior than I
could have produced by manually role-playing an infrastructure agent.

They could not decide what counted as a repair.

That required knowing that an empty queue is not the same thing as recovered
work. That manually adding a database column is not the same thing as applying
the deployed migration. That a second process listening on the right port is a
workaround if systemd brings the broken one back. That a provider returning 429
says nothing about the model's operational ability.

The tokens were cheap. Attention was not.

AI compressed the cost of generating experiments. It did not remove the need
to design them, inspect surprising results, or admit when the benchmark was
wrong.

That feels like the broader shift. The work did not disappear. It moved toward
choosing the question, defining the boundary, and recognizing when a plausible
answer is false.

## Research got more accessible

When people say AI is expensive, they are not wrong. Serving large models takes
real hardware and real energy. Costs get serious quickly at production scale.
One run with an expensive model consumed more than a quarter of my total
OpenRouter spend.

But cost is relative to what the tool makes possible.

Twenty-five dollars would not buy an hour from a research team. It bought me
enough model behavior to build and challenge an evaluation harness, compare a
wide range of agents, find several invalid measurements, and publish something
another person can run against their own harness.

The surprising part is not that AI made the project free. It did not.

The surprising part is that this class of experiment is available to one
person, at home, following a question because it is interesting.

I still do not know whether Replaybook will become a useful benchmark, a tool
other infrastructure teams adopt, or just the project that taught me how agent
evaluation actually works. That uncertainty is fine. The journey is the fun
part, not the destination.

AI did not make careful evaluation unnecessary. It made careful evaluation
affordable enough for one curious engineer to attempt.

That is a pretty good return on twenty-five dollars.

---

Source: [github.com/ducks/replaybook](https://github.com/ducks/replaybook)
