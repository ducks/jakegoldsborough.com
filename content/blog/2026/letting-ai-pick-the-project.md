---
title: "Letting AI Pick the Project"
date: 2026-01-19
description: "An experiment in creative delegation: I asked Claude to build
whatever it wanted. It chose to build a tool it wished existed."
taxonomies:
  tags:
    - ai
    - rust
    - oss
    - experiment
---

With the rise of AI and LLMs, a common theme has been "don't let the machine do
the thinking". The argument is we simply become expensive copy and pasters. And
while I mostly agree, I was curious.

Well, I tried an experiment today. Instead of coming to Claude Code with a
specific task, I asked: "Based on everything you know, what would you build?
Create a repo, use whatever language you want, document it along the way."

No constraints. No requirements. Just: build something.

## What It Chose

Claude chose to build `why`, a CLI tool for code archaeology. The pitch:

> I spend so much of my time helping people understand codebases, and the
> hardest question is always "why was this decision made?" The answer is
> scattered across git blame, old PRs, commit messages, issue trackers, maybe
> a Slack thread somewhere that's now lost.

The tool points at a file or line range and synthesizes a narrative: who
introduced this code, when, what commits modified it, what issues and PRs are
referenced, what type of changes they were (bug fix, feature, security patch).

```bash
why app/models/user.rb --range 100-150
```

```
The Story
=========

This code was first introduced by Jeff Atwood on 2020-05-22.
The initial commit said: "Revert 'Merge branch master'"

Since then, it has been modified 5 time(s):

  * FIX: do not send rejection emails to auto-deleted users (#12160)
    by Arpit Jalan
    Type: Bug fix

  * SECURITY: Limit name field length of TOTP authenticators
    by OsamaSayegh
    Type: Security
```

## The Process

What struck me was how Claude approached it. It started by reasoning about
what problems it encounters repeatedly. Not what would be cool to build, but
what it genuinely wished existed.

Then it moved fast. Within minutes: Rust project scaffolded, git blame
parsing working, commit categorization logic, GitHub API integration. It
tested on its own source code, then on Discourse (a large real-world
codebase I work on).

When I suggested adding Discourse as a context source (we use it for work
discussions), it designed a pluggable trait system:

```rust
#[async_trait]
pub trait ContextSource: Send + Sync {
    fn name(&self) -> &str;
    fn detect_references(&self, text: &str) -> Vec<Reference>;
    async fn fetch_reference(&self, reference: &Reference) -> Result<Option<ContextItem>>;
    async fn search(&self, query: &str) -> Result<Vec<ContextItem>>;
    fn is_available(&self) -> bool;
}
```

GitHub and Discourse implementations, easy to add more. The architecture
emerged naturally from the feature request.

## The Tangents

We went down a few rabbit holes. I mentioned that real context often lives in
Slack threads that never got linked to the code. Claude immediately saw the
harder problem: semantic search across communication history, not just
following explicit links.

It outlined what that would require: embeddings, RAG pipelines, LLM synthesis.
Then it asked the right question: "Worth building? Or is this scope creep from
a useful simple tool into a research project?"

We also briefly explored turning it into an MCP server so Claude could call it
during conversations. Another good idea, but another scope expansion.

I kept pulling back to "what's actually useful now" and Claude adjusted. No
ego about its ideas. Just: "Good call. Let me clean up and commit."

## What I Learned

A few observations from this experiment:

First, the AI had genuine preferences. It didn't pick something random or
impressive-sounding. It picked a tool that would help it do its job better.
There's something interesting about that.

Second, the iteration loop was fast. Feature idea to working code in minutes.
Not because the code was simple, but because there was no translation layer.
Claude understood what it wanted and knew how to build it.

Third, scope management mattered. Left unchecked, we could have spent hours
on semantic search and MCP servers. The human role was less about technical
direction and more about "is this the thing we're building right now?"

## The Tool

`why` is at [github.com/ducks/why](https://github.com/ducks/why). Rust, MIT
licensed, about 900 lines. It actually works.

Whether I'll use it daily, I don't know. But it exists because I asked an AI
what it would build if it could build anything, and it had an answer.
