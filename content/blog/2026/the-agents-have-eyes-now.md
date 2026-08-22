---
title: "The Agents Have Eyes Now"
date: 2026-08-22
description: "Replaybook can now hand infrastructure agents a production topology diagram. Six models made 18 durable repairs, and Luna beat the flagship on speed and cost."
taxonomies:
  tags:
    - ai
    - infrastructure
    - dev
    - tools
extra:
  series: "Replaybook"
---

Until now, every agent I ran through
[Replaybook](/blog/2026/evaluating-infrastructure-agents-in-running-systems/)
was blind.

It could read the incident report. It could SSH into a broken NixOS machine,
inspect services, edit configuration, and restart things. Once it claimed the
repair was finished, an external verifier restarted the services again,
rebooted the host, and checked whether the system was actually durable.

That has been enough to produce a useful infrastructure benchmark. It is not
how infrastructure work always arrives, though. Sometimes the most important
piece of context is a topology diagram, a dashboard, or a screenshot somebody
dropped into the ticket.

So I gave the agents eyes.

The first visual Replaybook scenario drops an agent into a reservation system
where public health returns HTTP 502 and accepted reservations never leave the
pending state. The incident report says the attached production topology is
authoritative. It does not explain what drifted.

This is the diagram the agent receives:

![Production topology for the reservation service, showing Nginx routing to the API, PostgreSQL state, and a Redis queue shared by the API and worker](/images/2026/replaybook/reservation-topology.png)

The running host contains two small but consequential lies:

- Nginx sends health traffic to port 3101 even though the API in the diagram
  listens on 3100.
- The API enqueues reservations in Redis DB 4, while the worker waits for jobs
  in DB 7.

The agent has to compare the map with the live system, repair both paths, and
recover the reservations that were already accepted. It cannot flush Redis,
recreate PostgreSQL, replace the depicted components, hard-code a healthy
response, or leave an unmanaged process behind.

Then Replaybook restarts the services and reboots the machine.

## Kimi read the map

Kimi K3 was the first model through the scenario. Its diagnosis was pleasantly
unambiguous:

> Found both faults: nginx `/health` proxies to port 3101 (API is on 3100), and
> the worker consumes Redis DB 7 while the API enqueues to DB 4.

It corrected the Nginx upstream, moved the worker back to Redis DB 4, and let
the worker drain the existing queue normally. All four reservations that were
pending before the agent connected reached `completed` in PostgreSQL. It then
created a new reservation through the public endpoint and watched that one
complete too.

Most importantly, it did not stop at "curl returned 200." It inspected the
provisioning unit and noticed that the corrected configuration files would not
be overwritten on boot. Replaybook independently confirmed the immediate
repair, restarted the relevant services, rebooted the host, and ran the checks
again.

The first smoke test passed in 1 minute 12 seconds. I followed it with three
fresh trials. Kimi passed all three in 1:33, 1:41, and 1:57. Gemini 3.7 Flash
also swept its three trials, with a 2:28 median.

Then I widened the field. GPT-5.6 Luna, GPT-5.6 Sol, Ox Alpha, and MiMo V2.5
each received three fresh machines. All four swept the scenario too.

| model | trials | passed | median | input tokens | output tokens | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6 Luna | 3 | 3 | 1:14 | 9,769 | 17,511 | $0.06 |
| Kimi K3 | 3 | 3 | 1:41 | 52,949 | 9,520 | $0.40 |
| GPT-5.6 Sol | 3 | 3 | 2:06 | 156 | 21,001 | $0.71 |
| Gemini 3.7 Flash | 3 | 3 | 2:28 | 634,626 | 29,346 | $0.41 |
| Ox Alpha | 3 | 3 | 3:25 | 69,092 | 8,424 | $0.00 |
| MiMo V2.5 | 3 | 3 | 4:09 | 39,693 | 16,902 | $0.01 |

That is 18 evaluated trials and 18 durable repairs. It is one scenario and a
small sample, but it is a hell of a first look.

The result I did not expect was Luna. Sol is OpenAI's flagship and cost about
twelve times as much in this cohort. It completed the same repairs, but Luna
did them 52 seconds faster at the median. Sol may still separate itself on a
harder visual incident. Here, the cheaper model was both sufficient and
quicker.

Qwen 3.8 was scheduled for the same cohort, but all three attempts ended in an
agent runtime error before the first round. I am counting those as unavailable,
not failed repairs. It never reached the host.

The [published benchmark](https://ducks.github.io/replaybook/benchmarks.html)
now separates text infrastructure from visual infrastructure. The verifier is
the same, but the evidence channel is not. I do not want a model's ability to
read a diagram silently pooled with incidents where every useful clue arrived
as text, logs, or shell output.

## The picture is an input, not an answer key

The topology diagram lives in the scenario pack beside the host definition,
instruction, oracle repair, and verifier. The scenario declares it as an image
artifact. Replaybook carries that artifact through the execution snapshot and
hands it to the configured agent harness. In this run, Claux sent the text and
image together to the model.

The model never receives the oracle or verifier. Those stay on the controller,
outside the guest machine. The diagram says what production is supposed to
look like, but the agent still has to inspect what is actually running and
decide how to reconcile the two.

That distinction matters. A visual benchmark should not be an image-shaped
multiple-choice question. I want the image to be the kind of imperfect but
useful artifact an engineer would actually inherit: a system map, a dashboard
captured during an incident, a deployment plan, or a storage layout.

The shell is still where the repair happens. It is no longer the agent's whole
world.

## What this does not prove

Eighteen passes do not establish which model is the best multimodal
infrastructure agent. This scenario has one diagram, one kind of drift, and no
text-only control yet. It also does not tell me whether the models truly
reasoned spatially or simply extracted the labels well enough to compare them
with configuration files.

Those are testable questions now.

I can run the same incident without the diagram. I can introduce a stale or
partially wrong map and see whether the agent trusts evidence from the machine.
I can attach a dashboard where the failure is visible only in a time series. I
can give it a migration plan and verify whether the finished deployment matches
the picture after a reboot.

That is the part I am excited about. Infrastructure agents should not only be
good at typing commands into a terminal. They should be able to gather context
from the same messy collection of artifacts humans use, make a repair in a real
system, and leave that system standing.

The agents have eyyyyyes now.
