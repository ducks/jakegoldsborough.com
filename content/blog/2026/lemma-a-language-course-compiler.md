---
title: "lemma: A Compiler That Doesn't Know Any Languages"
date: 2026-08-02
description: "I'm learning Czech in the hope of moving to Czechia, and I wanted my course to be reproducible data instead of a pile of notes. Then I wanted Spanish and Swedish too - so the interesting part became building a lesson generator that contains no Czech, no Spanish, and no Swedish."
taxonomies:
  tags:
    - rust
    - languages
    - tools
    - oss
---

I'm hoping to move to Czechia, so I'm learning Czech.

The obvious way to do that is an app. Duolingo, Anki decks someone else made,
a textbook. I didn't want any of those. I wanted the course itself to be
*mine* - source data I own, that generates lessons and flashcards I can
regenerate, diff, and extend forever. A language course structured like a
software project.

So I started building one. A directory of YAML: a curriculum listing what each
lesson teaches, a lexicon of vocabulary, a bank of grammar points. A generator
that turns all of it into lesson markdown and Anki decks.

Then, a few lessons in, I said the sentence that starts every good project and
half the messy ones:

*I'd also like to do this for Spanish. And Swedish.*

That is where it got interesting, because the moment there are three languages,
the generator has a hard job: it has to know how to teach a language without
knowing which language it's teaching.

## The thing that isn't Czech

When you write a Czech lesson generator, Czech leaks into it everywhere and you
don't notice.

Czech stress always lands on the first syllable. Czech has seven grammatical
cases. Czech has the famous ř, the raised buzzing r that eats foreigners alive.
Czech splits "you" into formal *vy* and informal *ty*, and getting that wrong is
the fastest way to sound rude. Every one of those facts wants to become an
`if` somewhere in the code, or worse, an unspoken assumption baked into how the
lessons come out.

Spanish has none of those cases but a wall of verb conjugation and the
*ser*/*estar* trap. Swedish has pitch accent - two words spelled identically,
meaning different things depending on a rise or fall - and *en*/*ett* noun
gender, and word order that flips the verb to second position.

If I let each of those live in the generator, I don't have one tool. I have
three forks of a tool that will drift apart the first time I improve one of
them.

So the rule I gave the engine was: **it knows nothing about any language.**

Everything language-specific moves into a file the language owns. Each course
gets a `language.yaml` profile that declares its own rules as data:

```yaml
name: "Czech"
code: "cs"

pronunciation:
  stress_rule: "first-syllable"
  hard_sounds:
    - symbol: "ř"
      note: "A raised, buzzed trilled r. Roll an r and add a zh buzz..."

grammar_features:
  cases: 7
  noun_gender: ["m-anim", "m-inan", "f", "n"]

register:
  has_tv_distinction: true
  formal: "vy"
  informal: "ty"
  default_register: "formal"
```

The Swedish profile will say `cases: 0`, list `en`/`ett`, describe pitch accent
in its `hard_sounds`, and set its own register defaults. Same engine. The
engine reads the profile and does what it's told. It has no opinion about Czech
because it has never heard of Czech.

That is the whole design. One compiler, many languages, and the languages are
data.

## It didn't start as a compiler I was proud of

The first version of the generator was Python, and it worked. It read the YAML,
it produced a lesson, it produced an Anki CSV. Fine.

But I write my tools in Rust now - [raft](/blog/2026/raft-a-graph-over-the-plain-text-log/),
my agent harness, a pile of others - and a course compiler I'll run for the
next year and a half across three languages is exactly the kind of thing that
should be a small, fast, typed binary I trust. So I rewrote it.

The rewrite is the part I want to be honest about, because it's the part that's
easy to do badly. I did not start the Rust version from scratch and hope it
matched. I extracted it *from* the working Python, kept the exact same YAML
inputs, and then made the Rust prove itself against the thing it replaced.

I generated Czech lesson one with the old Python. I generated it with the new
Rust. Then I diffed them.

Every vocabulary card, every cloze, every pronunciation string: byte-identical.
The only differences were the two I wanted - the engine now tags cards with the
ISO code `cs` instead of the word "czech," and it emits a pronunciation section
built from the profile that the Python never had. Same output where it should
be the same, better output where the new design earned it.

Then I deleted the Python. A rewrite you can't diff against the original is just
a second thing you hope behaves like the first thing. A rewrite you can diff is
a fact.

## The generator refuses to make things up

The best small decision in the engine is that it will not generate a lesson it
can't back up.

A lesson in the curriculum lists the vocabulary and grammar it uses by id:

```yaml
- lesson: 2
  title: "At the Immigration Office"
  vocabulary_ids: ["pas", "viza", "povoleni-k-pobytu", "adresa", ...]
  grammar: ["accusative-singular-intro", "verb-mit-present", ...]
```

Those ids have to resolve to real entries in the lexicon and grammar files. If
lesson two names a word I haven't written yet, the engine doesn't guess, doesn't
stub, doesn't quietly skip it. It stops and tells me exactly what's missing:

```
lesson 2: 30 vocab id(s) missing from lexicon.yaml: pas, viza,
povoleni-k-pobytu, adresa, bydlim, bydlis, mam, mas…
```

That error is not a failure. It's the to-do list. "Authoring lesson two" isn't
writing prose - the engine writes the prose. It's filling in that list of
words, with their real gender, plural, pronunciation, and notes, until the
error goes away. `lemma status` walks the whole curriculum and shows me which
lessons are ready and which are still just a promise:

```
Czech (cs) — 8 lessons designed
  lesson 1: ready
  lesson 2: NEEDS DATA — 30 vocab id(s) missing...
```

I like tools that make the unfinished parts loud. The curriculum can dream about
lesson eight for months, but the compiler will keep calling it a promise until
the data exists.

## The name was harder than the compiler

Of course it was. It always is.

I wanted a name that meant "learn any language" without being a pile of
syllables. I went through the whole miserable list. `lingua` - generic, taken a
hundred times over. `omniglot` - perfect meaning, except omniglot.com has owned
that word since before some of my coworkers were born, so I'd be invisible
forever. Just `omni` - too vague, could be a hotel. `parrot` - the mimicry is
right, the repetition is right, but it reads like a toy.

I got as far as `Psittacus`, the scientific genus of parrots, which is a
genuinely great name until you try to type `cd ~/dev/psittacus` for the fourth
time with the silent P and give up.

The one I landed on was hiding in the domain the whole time.

A **lemma** is the canonical dictionary form of a word - the headword every
inflection lists under. *pracovat* is the lemma; *pracuji*, *pracuješ*,
*pracujeme* are its forms. My lexicon file is, quite literally, a list of
lemmas. And in math and logic, a lemma is a small proven result you use as a
stepping stone to a bigger theorem, which is exactly what each lesson is in a
course that spirals toward fluency.

Two meanings, both dead-on, one word, easy to type. I checked that the crates.io
name was free, which is the only namespace I actually cared about, and stopped
looking.

Naming a language tool after the atomic unit of a lexicon felt less like picking
a name and more like noticing one.

## What I actually have now

Two repositories.

One is `lemma`: the engine. It reads a language directory and emits lessons and
Anki decks, and it contains no Czech, no Spanish, no Swedish. Bump the engine
once and every language gets the improvement; each course pins the engine
version it trusts.

The other is `language-studies`: my courses, one directory per language, pure
data. Right now it holds Czech - a real curriculum aimed at the parts of Czech I
actually need, which is not ordering beer for tourists but talking to the
immigration office, renting a flat, reading the signs, and surviving a standup
in a second language. Spanish and Swedish are two empty directories and a
profile away.

I have exactly one lesson fully written. That is not much of a course yet, and
I'm not going to pretend the hard part is done - the hard part is sitting down
and writing real, correct vocabulary for a hundred more lessons, and no compiler
does that for me.

But the machine is built, and it's built right. When I write the words, the
lessons and the flashcards fall out the end, the same way every time, in a
format I own. And when I finally start Swedish, I don't build a Swedish course
generator. I write a profile, and the compiler that doesn't know any languages
learns one more.

Source: [github.com/ducks/lemma](https://github.com/ducks/lemma)
