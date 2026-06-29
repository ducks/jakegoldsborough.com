---
title: "Software Doesn't Have to Justify Itself, or the Joy of Useless Programming"
date: 2026-06-29
description: "Software does not always have to justify itself as a product or a startup. Sometimes it is just a creative medium, and a silly Discourse plugin is the proof."
taxonomies:
  tags:
    - dev
    - writing
    - oss
    - craft
---

Last week I built a community management sim that runs inside Discourse. You
play as a moderator. Fake users post fake drama, fake flags pile up in the real
flag queue, and a fake outage tanks your response time while fake users complain
about it on a fake Twitter. The whole thing is rendered with real Discourse
components, so it reads as plausible at a glance. I called it
[discourse-manager](https://github.com/ducks/discourse-manager).

Nobody asked for this. There is no roadmap. There is no addressable market for
"forum jobs as a roguelike, but it's a plugin for the forum software itself."

I built it because the idea made me laugh, and then I wanted to see if it would
work.

## The justification reflex

There is a reflex a lot of programmers have, myself included, where every
project has to come with a defense.

Who is it for. How does it scale. What is the monetization path. Is this a
portfolio piece or a side business. Could it be a startup. Have you considered
the TAM.

I think we picked this up honestly. Most of us learned to program in a context
where the output was supposed to be useful to someone other than us. A ticket,
a feature, a deliverable. Code is expensive to write, so we convince ourselves
every line has to pay rent.

But that framing quietly smuggles in an assumption: that the only good reason to
make software is that someone else needs it.

I don't think that holds up.

## Nobody asks the potter

Nobody asks a musician why the world needs another song. There are tens of
millions of songs. The marginal song is not solving a shortage. A person writes
one anyway, because the writing is the point.

Nobody asks a potter why the world needs another mug. Your cabinet already has
mugs. The potter makes another one because their hands wanted to make it, and
because this one will be a little different from the last.

I have a few creative outlets like that. I make things out of clay and fiber and
wood under a name I keep separate from my engineering work. Nobody evaluates a
hand-built object by its growth potential. It is allowed to just exist because
someone enjoyed making it.

Software almost never gets that grace. It is held to a standard we would find
absurd in any other medium. We expect a weekend project to behave like a
business plan.

But software is also a medium. It is one of the most expressive ones we have. It
moves, it reacts, it can be funny, it can surprise you. A program can have a
voice. discourse-manager has a voice, and that voice is "this is a little too
real."

## What "what if" gets you

My favorite projects almost never start with a problem statement. They start
with "what if."

What if my audiobook player followed the same keybinds as my music player. That
turned into [shellbooks](https://github.com/ducks/shellbooks), which descends
directly from [shelltrax](https://github.com/ducks/shelltrax), my terminal music
player. The "what if" was small and a little indulgent. The result is something
I use almost every day.

What if I turned forum software into a game engine. That one became
discourse-manager. It started as a single dumb image in my head, a flag queue
that fights back, and I wanted to see it move badly enough to build the rest
around it.

What if I just automated the annoying thing instead of doing it by hand for the
hundredth time. Half my tiny scripts exist because of that sentence. None of
them have users. All of them earn their keep.

"What if" is not a worse starting point than "the market needs." It is often a
better one, because it comes from curiosity instead of obligation, and curiosity
tends to pull you somewhere you would not have planned to go.

## The silly project teaches the real thing

Here is the part that surprises people who think play and usefulness are
opposites.

discourse-manager looks like a joke, and it is, but building it made me learn
parts of Discourse I had managed to avoid for years. It runs real-time state
updates over MessageBus, the same pub/sub system Discourse uses for live
notifications. I had never wired that up from scratch. I had to, because a game
where the flags don't disappear as you clear them is not a game.

A joke project is still architecture. The fake forum needed generated users with
distinct behavioral profiles, a tick loop, an event system with weighted
outcomes, persistent game state, and a HUD that updates without a page reload.
None of that cares that the premise is silly. The wiring is exactly as real as
it would be in something I was paid to ship.

This keeps happening. The audiobook player taught me how `.m4b` chapter atoms
are stored. A throwaway script I wrote to
[audit a site before migrating it](/blog/2026/auditing-a-squarespace-site-before-migrating/)
taught me more about its actual structure than its documentation ever would.
[Debugging why Claude Code wouldn't run on NixOS](/blog/2026/patchelf-broke-claude-code/)
taught me things about dynamic linking I will never un-learn. Each one was a
means to some small end, and the end was never the point.

Play is just how I read a system closely. You poke at a thing long enough to
make it do something stupid, and somewhere in there you understand it.

## The line is thinner than people think

The thing I keep coming back to is that the line between silly and useful is
much thinner than the justification reflex wants you to believe.

discourse-manager is a bit. It is also, almost by accident, a labeled dataset
generator: every flag has a profile type and a human moderation decision
attached, so a few sessions produce real training data for spam detection. I did
not build it for that. It just fell out, the way useful things often fall out of
unserious ones.

I am not saying every project is secretly valuable, or that you should retrofit a
business case onto your toys to make them respectable. That is the same reflex
wearing a different coat. The toys do not need a business case. That is the whole
point.

I am saying the pressure to justify everything up front mostly just stops you
from starting. And the projects that start with "what if" are, in my experience,
the ones that teach me the most and the ones I am proudest of later.

## Programming is a creative outlet

For me, programming is not only the job. It is one of the ways I make things,
sitting on the same shelf as the clay and the fiber and the wood.

Most of what I make there is small. Some of it is silly. A fair amount of it
nobody will ever run but me. I am completely fine with that.

The next time I catch myself drafting a defense for a project before I have even
opened the editor, I want to remember the fake forum that runs inside the real
one, and the moment I decided the better question was not "is this worth it" but
just "what if."
