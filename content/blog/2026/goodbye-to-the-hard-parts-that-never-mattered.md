---
title: "Goodbye to the Hard Parts That Never Mattered"
date: 2026-09-26
description: "AI is not burying the software engineer. It is removing layers of accidental complexity and giving us a much larger canvas."
taxonomies:
  tags:
    - ai
    - dev
    - craft
---

I read Dave Kiss's [eulogy for the software
engineer](https://davekiss.com/blog/eulogy-for-the-software-engineer/) and kept
coming back to one question.

What exactly are we saying goodbye to?

Shitty regex? Writing another one-off parser for terrible data? Memorizing some
weird syntax for no obvious reason? Losing an afternoon to the particular
incantation a build system expects before it will do the thing you already
understand?

If that is what died, I am not sure it needs a funeral.

Dave's argument is more hopeful than the title suggests. By the end, he opens
the casket back up. The skills are still ours. The engineer is still responsible
for what ships. Maybe, he writes, we put the wrong name on the headstone.

I agree with most of that. I just do not think we need the headstone at all.

This does not feel like the death of the software engineer to me. It feels like
a rebirth.

## The toll was never the destination

Software engineering has always contained a lot of work that is only loosely
related to the problem being solved.

You need to move a small pile of ugly data from one system to another, so you
spend half a day learning the edge cases of a CSV parser. You know exactly what
a service should do, but first you have to remember the syntax for a framework
you have not touched in six months. You understand the bug, but the fix is
buried behind an unfamiliar repository layout, three layers of indirection, and
a test command nobody wrote down.

We got good at this work because we had to. Some of it was even fun. There is a
real satisfaction in finally landing the regex or finding the one line that
made the whole system behave strangely.

But difficulty is not the same thing as value.

Most of this was a toll we paid between understanding a problem and changing
the system. It was never the destination. If an agent can take care of more of
that translation, I have not become less of an engineer. I have more time for
the part that required an engineer in the first place.

## The work moved

I use coding agents every day. They can move through a codebase faster than I
can, generate a parser in seconds, and usually remember the library call I
would have looked up anyway.

They also make bad assumptions, misunderstand local conventions, confidently
use an API that does not exist, and declare victory before testing the thing
they changed.

The typing got easier. The engineering did not disappear.

I still have to understand the system well enough to know where to look. I have
to recognize when a plausible answer is wrong. I have to decide whether a
change belongs in the application, a plugin, an operations repository, or
nowhere at all. I have to reproduce the failure, choose the tradeoff, test the
result, and stand behind what reaches production.

An agent can write the parser. Someone still has to explain the terrible data,
notice when a row silently disappears, and decide what should happen when
reality violates the format.

That is software engineering.

This is the same shift I wrote about in [I Don't Type Every Word You
Read](/blog/2026/no-I-dont-type-every-word-you-read/). The work did not vanish.
It moved. Less of it lives in producing every character by hand. More of it
lives in direction, judgment, verification, and responsibility.

## I am learning more, not less

One fear I understand is that removing the hard way also removes the learning.
If the machine writes the code, how does anyone develop the instincts needed to
know whether it is right?

That risk is real. You can accept whatever appears in the diff, run nothing,
learn nothing, and ship garbage at a speed that used to be impossible.

You can also use the same tools to walk into parts of computing that were
previously too expensive to explore.

I have used agents to rewrite a TypeScript program in Rust, trace production
infrastructure across repositories, understand unfamiliar database behavior,
build terminal tools, and test ideas that would never have justified a free
weekend. I did not emerge from those projects knowing less Rust, less Linux, or
less about the systems involved. The agent handled enough of the syntax and
scaffolding that I could keep pulling on the interesting thread.

The learning loop got tighter. Ask a question. Inspect the answer. Run the
code. Break it. Read the implementation. Correct the assumption. Try again.

That is not a replacement for understanding. It is an extremely fast way to
find the edge of your understanding.

The burden is on us to keep crossing that edge. If we use agents only to avoid
knowing things, we will become worse engineers. If we use them to reach the
next question faster, we can become much better ones.

## The canvas got bigger

The part I find most exciting is not that the same ticket takes fewer hours.
It is that entirely different projects now fit inside a human life.

Software has always had an unusually high cost between an idea and its first
working form. Even a small idea could demand a new language, a framework, an
authentication system, deployment, tests, and a pile of glue before you got to
find out whether the idea was any good.

That cost killed a lot of ideas before they became code.

Now I can follow more of the strange little "what if" thoughts that make
programming fun. What if forum software were a game engine? What if a terminal
audiobook player worked exactly like my music player? What if I rebuilt a tool
in another language just to understand how it worked?

These are not hypothetical examples. I built them. They taught me about
real-time state, media containers, terminal interfaces, systems programming,
and the boundaries of the tools helping me.

I do not see a shrinking profession in that. I see a creative medium becoming
available at a scale it has never had before.

## There are still reasons to worry

None of this means every consequence will be good.

Companies will use the productivity story as cover to cut people. Generated
code will create failures at a scale we are not prepared for. The traditional
path from junior engineer to experienced engineer is going to change, and I do
not think anyone honestly knows what replaces it yet. Access also matters. A
profession cannot call itself newly open if the best tools require hundreds of
dollars every month.

Those are serious problems. They deserve more than a slogan about AI being a
tool or a prediction that everyone will become ten times more productive.

But they are questions about who benefits from the technology, how we teach,
and how we organize the work. They are not evidence that software engineering
has ceased to exist.

If anything, faster generation makes engineering discipline more important.
When producing code was slow, bad decisions accumulated slowly too. Now a bad
assumption can become three thousand lines before lunch. Clear requirements,
tests, review, observability, and taste do not matter less in that world. They
are the only things keeping the increased output useful.

## No funeral

I understand the grief in Dave's piece. A way of working that many of us built
our identities around is changing very quickly. There are parts of it I will
miss too. Solving something the hard way can feel incredible, especially when
the hard way was how you learned that you were capable of solving it at all.

But I do not want to confuse the obstacles with the craft.

The craft was never remembering every method signature. It was never manually
typing every line or personally wrestling every malformed document into
submission. Those were the mechanics available to us at the time.

The craft is understanding a problem deeply enough to change it. It is making
tradeoffs with incomplete information. It is noticing the wrong note in a
system that technically works. It is taking responsibility for the result.

We still need all of that. Now we get to apply it to more problems, in more
domains, with a much larger set of tools.

So I am not ready to bury the software engineer.

We are learning a new way to work. We are building a new layer of technology
while learning how to use it, govern it, and teach it. We are shedding some
accidental complexity and discovering new kinds underneath. We can attempt
things that were impractical a year ago, and we are only beginning to
understand what that means.

This is not a eulogy.

The software engineer is just getting started.
