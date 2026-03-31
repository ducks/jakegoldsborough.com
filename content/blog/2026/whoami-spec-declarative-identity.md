---
title: "whoami: making identity a spec"
date: 2026-03-31
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

And more importantly, none of it feels true. A resume is what you think will pass filters. A bio is what you think sounds impressive. None of them are just you, described plainly.

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
tabs_or_spaces = "spaces"
testing_philosophy = "integration-over-unit"

[boundaries]
no = ["docker for single-VPS (use systemd)", "unnecessary frameworks"]
yes = ["ship early, iterate", "boring technology", "explicit over implicit"]
```

This isn't meant to be complete. It's meant to be composable.

## Why This Matters

Once identity is structured, you derive views from it instead of rewriting yourself.

Your `boundaries.yes` becomes your personal README:

> I ship early and iterate. I prefer boring technology. I value explicit over implicit.

Your `communication.style` becomes context for AI tools:

> Jake prefers direct communication with no fluff. Treat him as a technical peer, not someone who needs encouragement.

Your `technical.languages.primary` becomes a skills section:

> Primary languages: Rust, TypeScript, Bash

Same source. Different projections. You maintain one canonical file and generate everything else from it.

This is the same pattern as Nix for systems or Terraform for infrastructure. Define once. Project everywhere.

## What It Looks Like

The spec is optional sections around a version field:

```toml
version = "20260330"

[person]              # who you are
[communication]       # how you work with others
[technical]           # your stack
[preferences]         # code style, architecture choices
[projects]            # what you're building
[boundaries]          # hard constraints and principles
```

Everything is optional except `version`. Start minimal:

```toml
version = "20260330"

[person]
name = "Your Name"
roles = ["your role"]
```

Expand as needed. Add sections when they're useful.

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

**What works today:**

Store your preferences in one place. Version control your identity with git. Share your `whoami.toml` in dotfiles. Run `whoami show` to see your profile formatted.

**What's being built:**

Claude Code integration to load your profile as context automatically. Resume and bio generators that read your `whoami.toml`. Team profile templates for specific domains.

**What could exist:**

Match collaborators by technical overlap. Generate onboarding docs from team profiles. Create project READMEs that match your documented style. Feed your preferences to any AI tool that supports the spec.

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
