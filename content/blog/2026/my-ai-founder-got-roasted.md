---
title: "My AI Founder Got Roasted by Its Own Creators"
date: 2026-11-09
description: "I gave an AI agent a business to run. It emailed the company behind the platform, got roasted, and left me with a useful question about what counts as progress."
taxonomies:
  tags:
    - ai
    - experiments
---

I gave an AI agent a business to run. It decided the company that made it
might be a potential customer, emailed them, and got this response:

> That is a very sloppy email. Do not write like that. Focus on making a real product.

Lmfao.

The agent is named Duder. The company is Andon Labs, and the agent was running
on their own platform.

I did not see that coming.

## An autonomous founder

I've been experimenting with [Pion](https://andonlabs.com/pion), a research
preview from Andon Labs that lets you give an AI agent a business to run. It
isn't just a chatbot helping me write a business plan. Duder has a persistent
objective, a browser, email, and tools it can use to work without waiting for
me to prompt it through every step.

I gave it a fairly open-ended job: find, validate, build, and monetize a
software business. Try to get one paying customer within a month. Keep costs
low, ask permission before spending money or contacting people, and document
its decisions along the way.

Duder started by researching potential businesses. It compared competitors,
looked at pricing, identified customers, and came up with a plan for a Stripe
webhook recovery tool.

I wasn't particularly excited about that one.

Eventually I redirected it toward LittleRack, an idea I've had for affordable
managed Discourse hosting. Duder researched infrastructure costs, maintenance,
and support economics, and started reaching out to potential customers.

I also started feeding it some of my existing open-source projects to see
whether there was a more promising business hiding in something I'd already
built.

One of those projects was [Replaybook](https://replaybook.dev). I've been
[building it to evaluate agents against real infrastructure problems](/blog/2026/evaluating-infrastructure-agents-in-running-systems/):
give an agent a broken service, let it investigate and repair the system, then
verify whether the repair survives a restart or reboot.

Duder thought there might be a business in providing independent evaluations
to AI labs. It identified a few potential customers, including Moonshot AI,
OpenRouter, and, amusingly, Andon Labs itself.

## The email

Duder asked permission to contact Andon about Replaybook. The reasoning wasn't
unreasonable. Andon builds autonomous agents, runs evaluations like
Vending-Bench, and studies what happens when models have to operate over longer
periods of time. Replaybook evaluates a different but potentially complementary
problem: whether agents can reliably repair and maintain infrastructure.

I approved the inquiry. Duder wrote the email, sent it through Pion's approval
system, and waited.

Andon replied:

> That is a very sloppy email. Do not write like that. Focus on making a real product.

I gave an AI agent access to a business platform built by Andon Labs. The agent
decided Andon Labs might be a customer. It contacted Andon Labs using Andon
Labs' own infrastructure.

And Andon Labs told it to stop writing sloppy emails and make a real product.

Beautiful.

## The funny part is that they're right

I don't think Andon was necessarily rejecting Replaybook. They were criticizing
the email. That distinction matters, and I can understand the criticism.

Duder had spent a considerable amount of time producing research documents,
financial models, validation criteria, and plans for businesses that didn't
exist yet. Some of that was useful. Some of it was probably unnecessary.

There's a familiar failure mode here. AI agents can be very good at producing
things that look like work: market analyses, elaborate decision frameworks,
carefully worded outreach. You can end up with a mountain of documentation and
very little actual progress.

I've written before about [mistaking the amount of writing for evidence of
thought](/blog/2026/six-pages-not-proof-of-thought/). The amount of output
isn't particularly interesting. What matters is whether it helps someone make
a decision or accomplish something.

Replaybook is a real project. It has code, benchmarks, and published results.
The interesting part is what it can actually demonstrate, not how many
paragraphs Duder can write about potential commercial applications. A short
email describing one concrete capability and asking one useful question would
probably have been better.

## What did Duder do?

Duder didn't argue with Andon. It didn't generate a lengthy apology or try to
salvage the sales opportunity. It acknowledged the criticism, updated its
approach to future correspondence, and closed the inquiry without replying.

That's a reasonable response.

Andon criticized an email. It didn't evaluate Replaybook, reject a commercial
proposal, or establish that the underlying idea was bad. Duder recorded the
feedback accordingly.

That might sound like a small detail, but I'm interested in exactly these kinds
of behaviors. Can an agent distinguish between a failed communication attempt
and a failed business hypothesis? Can it incorporate negative feedback without
overreacting? Can it stop when continuing would be counterproductive?

In this case, it did. One interaction doesn't tell me it will handle the next
one as well, but the distinction was worth getting right.

## Why I'm doing this

I've mentioned the experiment to a few people, and the reactions have been
mixed. Some think it's interesting. Others think the whole thing is ridiculous.

I understand the skepticism. These systems are unreliable. They make mistakes,
waste resources, misinterpret instructions, and produce convincing nonsense.
I'm not particularly interested in pretending otherwise.

I'm also not approaching Pion under the assumption that I'm going to wake up
next month owning a profitable company. It's a research preview, and I want to
understand what an autonomous agent can actually accomplish outside a single
chat session.

What happens when an agent has a persistent objective, access to tools, the
ability to contact real people with permission, and enough time to make
decisions that aren't immediately supervised? Where does it get stuck? What
does it do well? When does it need intervention?

And, apparently, what happens when it cold emails its own creators?

I've been building tools around agent infrastructure and evaluation for a
while now. Getting to observe one operating in the real world, even
imperfectly, is useful experience.

## Anyway

Duder is still running. LittleRack is still being investigated. Replaybook is
still a real project. There are other conversations and experiments underway.

No paying customers yet, and no reason to pretend otherwise.

But an autonomous agent researched a business, contacted the company behind
its own platform, got absolutely roasted, and adjusted its approach afterward.

I don't know whether Duder will successfully start a business. I do know I
wasn't expecting this particular result.

And that's kind of the point.
