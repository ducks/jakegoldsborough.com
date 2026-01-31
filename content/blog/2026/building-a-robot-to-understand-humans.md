---
title: "I Built a Robot to Help Me Understand People"
date: 2026-01-31
description: "I'm good with machines but bad with people. So I built a tool that reads what my coworkers write and helps me understand them better."
taxonomies:
  tags:
    - ai
    - tools
    - work
---

I am good with machines and bad with people.

This is not false modesty. I can trace a request through twelve microservices and
find the one misconfigured timeout. I can read a stack trace and know which
library is lying. I can debug race conditions that only happen on Tuesdays.

But ask me to read a room? To pick up on what someone is really saying in a
meeting? To notice when a coworker is frustrated before they explicitly say so?
That is where I struggle.

## Writing Is Easier

I do better with written communication. Forum posts, Slack messages, pull
request descriptions. When people write, they leave a trail I can actually
follow. I can re-read it. I can search it. I can take my time.

In person, the signal moves too fast. By the time I have processed what someone
said, we have moved on. I miss the subtext because I am still working on the
text.

This is probably why I ended up in infrastructure. Machines do not have subtext.
A 502 error is a 502 error.

## Graham Duncan's Question

A coworker recently wrote about Graham Duncan's framework for evaluating people.
I had never heard of it, so I did some research. Duncan is an investor
known for his approach to assessing people. His core question is:

"What's going on here, with this human?"

Not "are they qualified?" or "do they have the right experience?" but something
deeper. What patterns show up in how they communicate? What do they care about?
How do they handle disagreement? What are they not saying?

Duncan's framework breaks this down into dimensions:

- Self-awareness and blind spots
- Hidden motivations and fears
- How they respond to stress and uncertainty
- Contextual fit (right person, wrong role?)

I realized this is exactly what I struggle to do in real-time with coworkers.
But what if I could do it asynchronously, with written artifacts, with a
machine's help?

## The Data Is Already There

At Discourse, we use our own product internally. Years of forum posts, technical
discussions, weekly updates, casual banter. A written record of how people
think, communicate, and collaborate.

This is the kind of data I can actually work with.

So I built a tool. It pulls someone's forum activity, reads through their posts,
and generates a structured evaluation. Communication style. Areas of expertise.
How they handle disagreement. Patterns that emerge over time.

It is not a replacement for actually talking to people. But it gives me a
starting point. A cheat sheet for understanding someone before I walk into a
1:1 or try to give feedback.

## What It Actually Produces

The output is a structured report:

- Executive summary (what stands out about this person?)
- Core strengths with evidence from actual posts
- Growth areas, framed constructively
- Communication profile (tone, clarity, patterns)
- Collaboration dynamics (how do they work with others?)
- Representative quotes that capture their voice
- Discussion prompts for 1:1s

That last section is the most useful for me. Specific questions I can ask based
on what someone has actually written about. Not generic "how's it going?" but
"you mentioned being frustrated with X last month, how's that going?"

## The Uncomfortable Part

There is something uncomfortable about using a machine to understand people.
It feels like cheating. Or like admitting a deficiency that maybe I should just
work on directly.

But I have been "working on it directly" for decades and I am still bad at it.
At some point you have to accept your constraints and build around them.

I use a calendar because I cannot remember appointments. I use a todo list
because I cannot hold tasks in my head. I use version control because I cannot
trust myself to not break things.

Why not use a tool to help me understand people?

## Not a Replacement

This does not replace actual human interaction. It is prep work. The same way
you might review someone's recent commits before a code review, or skim their
last few PRs before a 1:1.

The conversations still happen. The relationship still matters. I just show up
slightly less clueless about what is going on with this human.

## Try It

The tool is open source if you want to try it:

```bash
claude plugin marketplace add ducks/person-eval
claude plugin install person-eval@person-eval --scope user
```

Then in Claude Code:

```
/person-eval username https://your-discourse-site.com
```

Or with a timeframe for yearly reviews:

```
/person-eval username https://your-discourse-site.com 2025
```

It requires the discourse-mcp server to be configured, which gives Claude Code
access to Discourse data.

## The Irony

The irony is not lost on me. I built a machine to help me understand humans
because I understand machines better than humans.

But maybe that is fine. We all have different strengths. Mine happen to involve
making robots do things. If I can make a robot help me be a better coworker,
that seems like a reasonable trade.

The goal is not to replace human connection with machine analysis. The goal is
to show up more prepared, more aware, more able to actually connect when the
moment comes.

I am still bad with people. But I am getting better at compensating for it.
