---
title: Agent assisted Changelog - 35/52
date: '2026-09-04'
description: Replaybook grew from a benchmark into a provider-aware evidence
  system, Agent Zen Garden became a real WebMCP submission, and Claux spent
  the week learning how to fail more honestly.
taxonomies:
  tags:
    - agents
    - changelog
    - weekly summary
---

Two weeks since the last changelog. The numbering is still pretending this is
one week, but the work did not take the hint. I spent the gap running model
matrices, building a WebMCP project, recording a demo, and waiting for enough
provider outages to make the word "unavailable" feel like a product feature.

Last time, Replaybook had become a benchmark system and Agent Zen Garden was a
promising little experiment. This time both projects had to survive contact
with other people: other providers, other browsers, other machines, and a
submission form with a hard deadline.

## Replaybook stopped pretending every run was the same

[Replaybook](https://github.com/ducks/replaybook) got a more honest shape.

The benchmark site now separates text and visual inputs, groups models by
provider, shows the scenario set and harness behind each result, and keeps
comparison boundaries visible. Provider identity is part of an invocation, not
something inferred from a model name after the fact. A Luna run through
OpenRouter, OpenCode Go, or Vercel is now three distinct pieces of evidence.

That sounds obvious. It took several rounds of pages, publisher assertions,
backfilled provenance, and one afternoon of asking why a model page only showed
six models when I had run many more.

The scenario catalog grew too. The visual set now includes topology drift,
metrics regression, and a deployment timeline. The last one gives the agent a
timeline image and asks it to reconcile the observed sequence with a live
system. The image is evidence, not an answer key. The repair still has to work,
survive service restart, and survive a host reboot.

The planner now knows about providers and can describe coverage gaps without
quietly mixing incompatible cohorts. The publisher can compose independently
run matrices when their harness, scenario, attempt, and verifier boundaries
match. Missing provider attempts can be resumed instead of forcing a complete
matrix to start over. Failure inspection became a report rather than a pile of
paths in a terminal.

The numbers are finally interesting because the boundaries are explicit. A
36-trial OpenCode visual cohort finished with 34 evaluated repairs. DeepSeek,
Kimi, and MiniMax each went 9/9; Qwen finished 7/9. A Vercel cohort across
Luna, Sol, and GLM 5.3 Flash went 27/27 after I added credits; the earlier free
endpoint mostly taught me what a provider interruption looks like. OpenRouter
Luna's 24-trial core run went 22/24. HY4 preview went 8/9. The same visual
timeline gave Sonnet 3/3, Opus 1/3 after two timeouts, and Terra 3/3.

None of those is a universal model ranking. They are slices with different
providers, prices, and failure surfaces. That is the point. The benchmark can
now say which slice it is showing instead of printing one confident table over
the top of all of them.

The larger OpenCode run also demonstrated why this matters. A 120-trial
command started with the wrong adapter flags, then met a day when several
providers were unavailable. I stopped it rather than count empty sessions as
failed repairs. A benchmark that records its own orchestration failure is more
useful than one that turns every red line into a model verdict.

## Claux learned to leave better evidence

[Claux](https://github.com/ducks/claux) spent this stretch becoming less
dramatic and more dependable.

Image input crossed the boundary from a prompt description into the agent
protocol, which is what made the visual Replaybook scenarios possible. Context
limits now come from provider model metadata where available, so compaction no
longer depends on a stale hand-maintained number. Tokenizer fingerprinting can
resume and emit a Markdown report, which is useful when a model's public name
does not tell me whether two endpoints share an actual tokenizer.

Then came the boring failures that are only boring after they are fixed:

- streamed output is cleared before a provider retry;
- cancelled Responses streams clear their cursor;
- compacted history stays available for continuation;
- child processes cannot inherit credentials accidentally; and
- TUI resume switches sessions without leaving the old one attached.

Provider API-key login flows, usage status, and adapter setup also became
first-class commands. The usage command reports what the authenticated key
actually exposes and says "unavailable" when the provider does not expose a
remaining balance. It does not invent a monthly subscription price from thin
air.

The current release is `v20260902.0.1`. The crate passed 1,000 downloads while
I was busy chasing a retry bug, which is a nice reminder that software can find
users while its author is still arguing with a terminal. The release also
closed the most severe open issues around cancellation, compaction, retries,
credential leakage, and session recovery.

The useful Claux feature this week was not a new model integration. It was the
ability to tell the difference between a model making a bad operational choice,
a provider refusing a request, and the harness losing its own state. Those
three things all look like "the agent failed" if the recording is too small.

## Agent Zen Garden went from experiment to submission

I built [Agent Zen Garden](https://github.com/ducks/agent-zen-garden) because I
wanted to see what WebMCP felt like when attached to something more useful than
a button that says hello. It is now a small design sandbox where an agent can
select a layout, inspect its named slots, change copy and styles, add an image,
and save the result for a human to judge.

The important loop is:

```
list_layouts
select_layout
examine_layout
set_style
set_copy
add_font
add_image
```

The native browser tools are thin. The server owns validation and persistence,
and an HTTP fallback keeps the project usable when a browser does not support
WebMCP yet. A selected layout gets its own workspace. SQLite stores the design
name and optional agent/provider/model metadata, so a share link still works
after a restart. A public Designs page makes the results visible to people who
are not running an agent.

The project is running at [agentzen.garden](https://agentzen.garden), with the
API behind Caddy on stream. It has persistence, rate limiting, social metadata,
an ISC license, and GoatCounter tracking. The first useful event was a design
called “Signal After Dark” appearing in the preview and share paths. That was
the moment the site stopped being a demo I had to explain and became a place
where somebody else could leave evidence.

I wrote [I Let an Agent Design a Portfolio
Page](/blog/2026/letting-an-agent-design-a-portfolio-page/) about the first
session, then recorded a short demo with an agent operating the tools in the
browser. The video was submitted to the WebMCP Challenge before the extended
deadline. It is a small project, but the interaction is a different shape from
“generate me a website”: the human supplies direction and taste, while the
agent makes precise changes against a constrained, inspectable design surface.

The font-generator experiment taught the companion lesson. Passing an SVG path
to a model is not the same thing as letting it see a glyph and infer a style.
The first versions produced twenty-six copies of A, then paths in the wrong
Bezier format, then an alphabet that technically existed but looked nothing
like the input. The failure was not that agents cannot understand an alphabet.
It was that the app kept asking a backend function to manufacture an answer
instead of actually sending the visual evidence to a vision-capable model.

## Agents of Empires got a real build race

[Agents of Empires](https://github.com/ducks/agents-of-empires) finally has a
visual Blueprint Build arena. Three agents receive a service contract and a
blank machine, then compete to build a deployment that survives the referee's
checks. The map is driven by the same milestone events that decide the match;
it is not an animation pasted over a terminal log.

The first version had a humiliating bug: the arena called agents with no vision
while asking them to work from a diagram. Once the fleet used vision-capable
models, the match became legible. The live terminal now shows the model for each
territory, the controller fails fast on harness outages, and adapter process
groups are cleaned up instead of continuing after the match ends.

Luna won repeated three-round series by reaching a durable deployment first.
Ox and Kimi produced useful attempts, but several rounds never reached the
gateway verification milestone. That is not a conclusion about their general
ability. It is a reminder that an arena needs to show whether an agent failed
the system, the provider, or the starting conditions before anyone starts
calling it a strategy game.

## Small projects kept becoming systems

[gym-jams](https://github.com/ducks/gym-jams) shipped publicly and got its own
post. It turns an album into a workout by letting deterministic audio analysis
provide duration, tempo arcs, energy, and pulse stability, then asking a model
to map that structure onto one sentence of intent. The model never needed to
hear the music. It needed an honest description of what the music was doing.

The app also gave me a nice refusal: when I requested a twenty-minute recovery
session from a record containing fourteen and a half minutes of calm, it
reported the mismatch instead of padding the plan with imaginary easy sections.
That is a small example of the same rule Replaybook keeps teaching me: a
plausible answer is not necessarily an accurate one.

I kept working on Heart Eyes Tattoo as a tiny mobile-first studio site. It now
has About, Artists, and individual artist pages, with booking routed from each
artist rather than pretending the studio shares one calendar. The artist index
is intentionally just names over a rotating set of the SVG shapes from my icon
collection. A yellow-and-coral frame, flowing stripes, pink burst, and coral
starburst cycle through the five artists. The cards are visual indexes, not
five copies of the same biography waiting to be filled in.

The Discourse instance on stream also became less theoretical: the directory
plugin was rebuilt behind Caddy, Mailgun handled the first successful login
mail, and the directory's DNS and service records are now part of the same
deployment conversation as the rest of the little sites. Arch Linux remains
perfectly capable of hosting Discourse, provided Docker, DNS, SMTP, and the
operator all agree on what day it is.

## The through-line

The last two weeks were mostly about turning agent output into something another
person can inspect.

Replaybook now shows the provider, harness, scenario, and evidence boundary
instead of making a leaderboard do all the storytelling. Claux keeps enough
state to explain whether a continuation really continued. Agent Zen Garden
stores the design that an agent made instead of leaving it in a browser tab.
Agents of Empires puts the model and verifier events on the same map. Even
gym-jams works because the model gets a measurable description rather than a
request to pretend it heard something.

The easy version of all these projects is a clever response in a terminal. The
harder version is the one that survives a restart, a provider outage, a second
person clicking the link, or a skeptical look at the artifact afterward.

That is where the interesting work keeps ending up: not in making the agent say
more, but in making the boundary around what it did harder to misunderstand.
