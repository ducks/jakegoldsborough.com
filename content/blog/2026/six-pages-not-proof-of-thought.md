---
title: "Six Pages Was Never Proof of Anything"
date: 2026-10-25
description: "The mourning for Amazon's writing culture confuses two claims. Writing
  as thinking is true and survives AI. Writing as evidence was always false. The
  successor to word count is not shorter documents, it is accountable ones."
taxonomies:
  tags:
    - ai
    - writing
    - craft
---

The article making the rounds argues that Amazon's writing culture was a filter
for half-formed ideas, and AI has gone and broken the filter. The passage doing
the emotional work is this one:

> A document used to be proof of thought. If you handed me six pages, I knew
> that you had spent significant time with the problem. Therefore, I knew that
> it would be worthwhile spending my time to understand your thoughts.

I understand the feeling behind it. But look at the structure of the claim,
because it is not one inference, it is two. Length proved time. Time proved
thought. Neither link is a law of nature. Both are economic assumptions: at an
hourly rate, six pages costs six hours of a life. When the price of pages
collapses to zero, the signal collapses with them. What people are mourning is
not broken trust. It is a dead proxy.

## The book report test

Almost everyone has, at some point, handed in a six-page report on a book they
did not read, written the night before.

Six pages. Proof of time. Zero thought.

The proof-of-time signal was always this noisy, and we tolerated it because
faking was expensive enough that most people only faked the boring parts. But
anyone who has sat through corporate document regimes knows the second link
was failing in both directions. Six-pagers got ghostwritten, team-rotated, and
recycled into what amounted to paperwork theater. If length were thought, the
internals wiki of every large company would be the most valuable literature on
earth.

Writing that forces thinking is real, but it was never the length doing the
forcing, and the six-pager was never as reliable a detector of thought as the
nostalgia claims.

## Two claims wearing one coat

The article, like most in this genre, runs together two propositions that
should be kept apart.

The first is about the author: writing is a tool for thought. Forcing vague
intent into sentences makes the incoherence surface, which is why the practice
produces better plans. This claim is roughly true, and it survives AI, because
the benefit comes from working through the ideas. If a model does the thinking
for you, the benefit disappears. If you use it to articulate, challenge, and
refine your own thinking, the benefit survives, even if the model generates
every sentence.

The second is about the reader: the document is evidence, a reason to spend
your hour. This claim was always false, as the book reports prove, and AI
merely made the falseness cheap to notice.

Once you separate them, the panic resolves into something smaller and more
fixable. The real loss is that a reader can no longer assume the author spent time.
Losing that matters. But you do not get it back by reverting to word counts,
because you never actually had word counts doing the work. You had the ritual
around the document.

## The ritual was never the paper

The Amazon ceremony is the tell. Thirty silent minutes of reading, red pens in
the margins, senior engineers interrogation-tested before a decision moved.
That room is where trust lived. The six pages were the ticket you bought to
get in.

Note what the article's own anecdote says about the room. A presenter reads
his document aloud for the first time in the meeting, it becomes obvious to
everyone, and nobody challenges him, because he is the most senior person
there. The ritual was already dead in that meeting. Hierarchy killed it, not
the model. The document culture survived the paper's death for years and did
not notice, which suggests the culture was more about the paper than about
the thinking all along.

The tell that the author does not see coming arrives in his own policy
section. He endorses a team rule that includes "Longer is not better. If you
have generated a long document from a short prompt, share the prompt
instead." You do not write that rule if length was the evidence. He is
legislating against the exact nostalgia he sells.

## What replaces the word count

If length was a proxy for thought, the successor has to be something that
costs a faker more than it costs a sincere author. Not volume. Accountability.

Stand behind every sentence. Generated or typed, if it is in your document,
the claims are yours, and you answer for them in the room. This is the best
line from the policies being written right now, and it works because it moves
the cost from producing text to defending it, which AI cannot take off your
table.

Make the thinking inspectable instead of inferred. Drafts, edits, revisions,
and decision logs can help a reader follow how an argument developed and where
to question it. They are supporting evidence, not proof: an agent can generate
a convincing history, and a person can think carefully before writing a single
draft. The useful part is being able to explain what changed, why it changed,
and what evidence would make you change your mind again.

Match the ritual to the risk. One-way doors deserve the slow ceremony,
humans reading humans with red pens. Two-way doors should ship, roll back,
and stop pretending the paperwork was the safety. Most of what died with the
six-pager was two-way-door writing that only looked serious.

Stay answerable. The test of a thought was never its length, it was the
ten-minute questioning afterward. If you can survive it, the format does not
matter. If you cannot, no format was going to save you.

## Six lines instead of six pages

I have been building toward this format without noticing. ARF is a small spec
for capturing agent reasoning: what, why, how, and backup, four fields, with
the rollback plan required before the action ships.

Six lines, not six pages. And the backup field is where the thinking becomes
testable. A model can produce a plausible rollback plan in seconds. The useful
questions are whether the plan works, whether you can execute it with the
access and state you will actually have, and whether you can explain what it
will and will not recover. A short plan you can validate and defend is worth
more than a document that takes a week and says nothing.

That is the same shift I wrote about in
[I Don't Type Every Word You Read](/blog/2026/no-i-dont-type-every-word-you-read/),
arriving on the reader's side of the page. The work moved. It lives in what
you decide, what you keep, what you can defend, and what you can undo. It
does not live in how long it took you to type.

The six-pager was never proof of anything. The people worth trusting did not
need it, and the people faking it were buying a ticket, not doing the work.
What AI actually ended was our excuse for counting pages instead of building
rooms where counting is unnecessary.
