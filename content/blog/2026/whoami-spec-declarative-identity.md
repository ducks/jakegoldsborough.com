---
title: "whoami: making identity a spec"
date: 2026-03-30
description: "We made infrastructure declarative. We made workflows declarative. Identity is next. A structured format for describing yourself as a source of truth, not a projection."
taxonomies:
  tags:
    - rust
    - tools
    - ai
    - specifications
---

There's a weird gap in how we describe ourselves.

We have resumes. We have GitHub profiles. We have bios. We have LinkedIn. We have random README files. We have scattered fragments of "who we are" across the internet.

But none of it is composable. None of it is structured in a way that machines can actually use.

And more importantly, none of it feels true.

## The Problem

Every system asks you the same question: "Who are you?"

And every time, you answer it slightly differently.

- A resume is optimized for hiring filters
- A bio is optimized for attention
- A README is optimized for developers
- A cover letter is optimized for a specific role

These are all projections. Views. Slices.

But there's no canonical source. There's no spec.

## What if Identity Was Declarative?

I've been thinking about this pattern lately.

Infrastructure became manageable when we made it declarative.

Instead of: "run these steps to set up a server"

We moved to: "this is what the server is"

That shift unlocked everything:
- Reproducibility
- Composability
- Tooling
- Automation

So what happens if we apply that to identity?

## Introducing whoami-spec

[whoami-spec](https://github.com/ducks/whoami-spec) is a simple idea: define yourself in a structured, declarative format.

Not for a platform. Not for a resume. But as a source of truth.

```toml
version = "20260330"

[person]
name = "Jake Goldsborough"
roles = ["backend engineer", "infrastructure engineer"]

[communication]
style = "direct, no fluff, technical peer not cheerleader"
emoji_in_code = false

[technical.languages]
primary = ["rust", "typescript", "bash"]

[technical.tools]
editor = "vim"
shell = "zsh"

[[projects.active]]
name = "skillz"
path = "~/dev/skillz"
description = "Claude Code skill package manager"
tech = ["rust", "clap"]

[preferences.code]
tabs_or_spaces = "tabs"
testing_philosophy = "integration-over-unit"

[boundaries]
no = ["docker for single-VPS (use systemd)", "unnecessary frameworks"]
yes = ["ship early, iterate", "boring technology", "explicit over implicit"]
```

This isn't meant to be complete. It's meant to be composable.

## Why This Matters

Once identity is structured, things get interesting.

You can:
- Generate a resume
- Generate a cover letter
- Generate a bio
- Generate a personal site
- Feed it into an LLM for context
- Match people based on shared traits

Instead of rewriting yourself every time, you derive different views from the same core.

This is the same idea as:
- JOBL for resumes
- ARF for reasoning
- Nix for systems

Define once. Project everywhere.

## What It Looks Like

The spec defines optional sections:

**Identity:**
- Person (name, roles, pronouns)
- Communication preferences
- Technical stack

**Work:**
- Active projects
- Domains of expertise
- Learning goals

**Preferences:**
- Code style
- Architecture choices
- Documentation approach

**Boundaries:**
- Hard constraints ("no")
- Guiding principles ("yes")

Everything is optional except the version field. Start minimal, expand as needed.

## The CLI Tool

The `whoami` CLI helps manage your profile:

```bash
# Create a profile interactively
whoami init

# Show your profile in readable format
whoami show

# Validate a profile
whoami ~/.config/agent/whoami.toml
```

The profile lives at `~/.config/agent/whoami.toml` by default. You can set `AGENT_WHOAMI` to point elsewhere.

Tools that support the spec can read it automatically. No copy/paste, no re-explaining context every time.

## Identity as Infrastructure

This is the part that clicked for me.

We treat infrastructure as something worth modeling precisely. But identity? We leave it fuzzy.

Yet identity is upstream of everything:
- What you build
- How you work
- Who you collaborate with
- What problems you care about

If anything deserves a spec, it's that.

## Not Another Profile

This isn't trying to compete with LinkedIn.

It's closer to:
- A `.gitconfig` for yourself
- A `flake.nix` for your identity
- A `Cargo.toml` for who you are

Something local-first. Something you own. Something you can version.

## Use Cases

**For developers:**
- Feed your profile to Claude Code as context
- Generate project READMEs that match your style
- Onboard to new teams faster (they can read your preferences)

**For AI workflows:**
- Give LLMs persistent context about how you work
- No more re-explaining your stack every conversation
- Skills can reference your technical preferences

**For teams:**
- Share profiles in dotfiles
- Match collaborators by technical overlap
- Understand communication styles upfront

**For yourself:**
- Version control your identity (see how you've changed)
- Generate different artifacts from one source
- Stop rewriting the same information everywhere

## Current Status

Right now, it's a spec and a CLI tool:

- Spec at v20260330 (date-based versioning)
- CLI for creating, validating, and displaying profiles
- Example profiles for reference
- Written in Rust, published to crates.io

What's missing:
- Tools that generate artifacts (resumes, bios, sites)
- Integration with Claude Code and other AI tools
- Matching/discovery systems
- Profile templates for specific domains

The foundation is there. Now it's about building on it.

## Where This Could Go

You can already imagine:

- Tools that generate artifacts from it
- Matching systems for collaborators
- Better onboarding into teams
- LLMs that actually understand context about you
- Portable identity across platforms

And more interestingly: you stop thinking of identity as something you write, and start thinking of it as something you model.

## Closing

This is a small idea. But it feels like one of those primitives that unlocks a lot.

We've made infrastructure declarative. We've started doing it for workflows and reasoning.

Identity feels like the next obvious step.

I don't think this is a product. It feels more like infrastructure.

And infrastructure tends to win quietly.

## Links

- [whoami-spec on GitHub](https://github.com/ducks/whoami-spec)
- [whoami-cli on crates.io](https://crates.io/crates/whoami-cli)
- [Specification](https://github.com/ducks/whoami-spec/blob/main/SPEC.md)
- [Examples](https://github.com/ducks/whoami-spec/tree/main/examples)
