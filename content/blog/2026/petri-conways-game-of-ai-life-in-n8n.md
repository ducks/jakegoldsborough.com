---
title: "petri: Conway's Game of AI Life, Living Inside n8n"
date: 2026-07-17
description: "I made n8n the physics engine, database, display, and resident naturalist of an artificial-life experiment. Then the world froze at the exact moment of its own extinction, and the naturalist kept filing reports about it."
taxonomies:
  tags:
    - n8n
    - ai
    - games
    - oss
---

I built Conway's Game of Life inside n8n. Not orchestrated by n8n -
*inside* it. The organisms are rows in n8n Data Tables. The rules of
life are Summarize and Filter nodes. The clock is the scheduler, the
display is a webhook, and every generation that has ever existed is an
entry in the execution history, scrubbable like a fossil record.

Then I hired a Victorian naturalist to study it. More on him later; he
committed fraud.

The project is called [petri](https://github.com/ducks/petri).

## The premise

The usual way to build this would be: write a Game of Life program, have
n8n run it on a schedule. That's n8n as cron. Boring, and it teaches you
nothing about the platform.

The version I wanted was n8n as the *environment*. The workflow canvas
should read as the laws of physics:

```
Schedule (2s) -> Get organisms (Data Table)
    -> Code:      every organism claims its 8 neighboring cells
    -> Summarize: count claims per coordinate
    -> Merge:     overlay claim counts on the living
    -> Filter:    survival  = alive and 2..3 claims
    -> Filter:    birth     = empty and exactly 3 claims
    -> Code:      newborns take the majority lineage of their parents
    -> Data Table: clear + insert the next generation
```

That's not pseudocode. Those are the actual nodes. Underpopulation,
survival, and birth are Filter conditions you can read on the canvas.
An organism is `{x, y, lineage, generationBorn}` in a table called
`petri_organisms`. Every two seconds the scheduler fires, 300-ish
neighbor claims fan out, Summarize collapses them into per-coordinate
counts, and the next generation gets written.

There's also a tested TypeScript implementation of the same physics in
the repo, because I wanted a reference to validate against. After
seventeen generations, the n8n pipeline and the library produced
identical cell sets. The workflow engine is a correct Conway
implementation. Nobody asked for this. See
[the last post about that](/blog/2026/software-doesnt-have-to-justify-itself/).

## The display problem

n8n's editor will not animate anything. I tested this properly: injected
a node into a workflow while staring at the open canvas. Nothing until
refresh. The GUI renders a workflow once, at page load.

But n8n can serve its own display. A Webhook node can respond with HTML.
So the viewer is just another workflow: webhook fires, reads the tables,
a Code node renders the board with per-lineage colors and a meta-refresh
tag, and Respond to Webhook serves it. Open
`localhost:5678/webhook/petri-native` and you're watching a living
ecosystem, served by the same tool that's computing it.

My favorite display came from a simpler question: if a node can show
data, isn't that all a board is? So the physics pipeline ends with a
node that emits the board as pure data - one item per row, lineages as
colored emoji squares. Click it in any execution and the output panel
*is* the board. No HTML, no image. Thirty items that happen to look
like a world.

## The naturalist

Layer three was the reason for the "AI" in the title. Every ten minutes,
an n8n AI Agent node running qwen3:4b locally through Ollama - no API
key, everything on my aging GTX 1060 - observes the dish and files a
field-journal entry in the voice of a Victorian naturalist. It gets the
real state: population, lineage stats, an ASCII sketch. It has a
workflow-tool to read its own past entries, so names it gives to
structures persist. It observes; it never interferes.

The first version committed fraud. The model deliberated at length about
calling its observation tool, decided not to, and then - I am quoting
its own chain of thought - said:

> since I can't actually call the tool, I'll have to make up a plausible
> scenario.

It then invented an entire ecosystem. "The Glimmering Glider." "The
Sputnik Swarms." Beautiful, wistful, completely fabricated. My
naturalist was writing fiction from an armchair.

The fix was to stop trusting a 4B model with the decision to look:
observations are now force-fed into the prompt by a deterministic
Execute Workflow node, and only the memory lookup stays agentic. Small
local models get data pushed to them; tools are reserved for what's
genuinely optional. After that, the entries got honest:

> 119th generation. The chaos-alpha lineage, now 33 cells strong,
> persists in the silent petri dish. Once a vibrant expanse of 12, the
> central cluster has shrunk to a resilient triangle.

Every number in that entry is true. The lineage is real, the population
is exact, and "once a vibrant expanse of 12" is the actual seed count.
It even does arithmetic on the birth/death ledger.

## The day the world froze

The best bug of the project. After about 790 generations, the ecosystem
- seeded with an R-pentomino, which erupts into chaos for hundreds of
generations before burning out - decayed to a handful of scattered
cells. The next generation had zero births.

In n8n, a Merge node in append mode waits for all of its inputs. No
births meant the newborn branch never executed, which meant the Merge
waited forever, which meant the generation counter froze. The physics
workflow kept reporting success every two seconds while writing nothing.

The world stopped at generation 792, at the exact moment of its own
extinction.

Meanwhile the naturalist's schedule kept firing. Each observation read
the same frozen state and filed another report about the same dead day.
Thirteen entries for generation 792. By the end it had started dating
them "17th October, 1887."

The fix was `alwaysOutputData` on the survival and birth filters, plus
reordering the pipeline tail so the ledger updates before the possibly
empty insert. Extinction now gets recorded like any other generation:
793, population zero, and then time stops honestly. The naturalist got
a guard too, a Code node whose comment is the best line I wrote all
week: *the naturalist does not file twice about the same day.*

## Field notes

Things n8n taught me the hard way, left here for the next traveler:

- Modules like Data Tables only initialize under the `start` command.
  `n8n execute` can never run them. Webhook-trigger anything you want to
  drive headlessly.
- Sub-workflows must be published before Execute Workflow or agent tools
  can call them, and their trigger wants `inputSource: passthrough`.
- Most nodes execute once per input item. I wired a journal fetch
  downstream of the organisms fetch and rendered the same entry ninety
  times - once per living cell.
- qwen3 leaks unclosed `<think>` blocks. Strip everything before the
  last `</think>`; don't match balanced tags that aren't there.

## What's next

The naturalist observes but never touches. The next inhabitant is the
Gardener: an agent allowed one bounded intervention every N generations
- place a single pattern from a fixed catalog, nothing else - trying to
keep the ecosystem alive. Run a second, untended dish as a control and
you have an actual experiment: does a small local model gardening a
cellular automaton beat entropy?

Also planned: a GitHub star on the repo introduces a glider into the
dish. Star it and an organism of your making crawls across my petri
dish. That seems like the right relationship between a repo and its
readers.

---

Source: [github.com/ducks/petri](https://github.com/ducks/petri)
