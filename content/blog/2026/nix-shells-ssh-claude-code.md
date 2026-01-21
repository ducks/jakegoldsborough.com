---
title: "The Unholy Trinity: Nix Shells, SSH Config, and Claude Code"
date: 2026-01-21
description: "How proper environment setup turns AI coding assistants from novelty into genuine infrastructure. Nix makes everything reproducible. SSH makes everything reachable. Claude ties it together."
taxonomies:
  tags:
    - ai
    - nixos
    - tools
    - dev
---

I wrote about [using Claude Code for daily development](/blog/2025/how-i-am-using-claude-code/)
a few months ago. That post was about workflow and mindset. This one is about
infrastructure.

Turns out, the real multiplier isn't how you prompt the AI. It's what you let
it touch.

## The Problem With AI Coding Assistants

Most AI coding tools work in a sandbox. They can read your code, suggest
changes, maybe run a linter. But the moment you need to actually test
something, build something, deploy something? You're back to copy-pasting
commands.

"Here's how you'd run the tests" is not the same as running the tests.

Claude Code is different because it has shell access. It can run commands,
read output, iterate. But that only matters if the environment is set up for
it.

## Nix Shells: Run Anything, Anytime

Every project I work on has a `shell.nix`. When Claude needs to run something,
the command is:

```bash
nix-shell --run "bundle exec rspec"
```

That's it. No "first install Rust nightly, then set up ALSA, then configure
pkg-config paths." The shell.nix declares everything. Claude doesn't need to
know how to set up a Rust audio environment. It just needs to know `nix-shell`.

Here's what my [shelltrax](https://github.com/ducks/shelltrax) shell looks like:

```nix
{ pkgs ? import <nixpkgs> {} }:
let
  rust-overlay = import (builtins.fetchTarball
    "https://github.com/oxalica/rust-overlay/archive/master.tar.gz");
  pkgs' = import <nixpkgs> { overlays = [ rust-overlay ]; };
  rust = pkgs'.rust-bin.nightly.latest.default;
in
pkgs'.mkShell {
  buildInputs = with pkgs'; [
    rust rust-analyzer
    pkg-config alsa-lib openssl gcc
  ];
}
```

Claude can run tests, build releases, check for warnings. All without me
explaining how to install Rust nightly or configure audio libraries.

The pattern works everywhere. Rust project? `nix-shell --run "cargo test"`.
Ruby project? `nix-shell --run "bundle exec rspec"`. Node? Same deal. The AI
doesn't need to understand package managers. It just needs one command that
always works.

## SSH Config: The Revelation

I've had SSH config set up for years. `Host pond` instead of typing IPs,
key-based auth, the usual. Standard stuff for anyone who manages servers.

```
Host pond
    HostName 199.68.196.244
    User ducks
    IdentityFile ~/.ssh/pond_ed25519
```

What I hadn't considered: Claude can use it too.

I was debugging why my analytics service was down. Normally I'd open another
terminal tab, SSH in, check logs, come back and describe what I found. The
usual dance.

Instead, on a whim, I just asked Claude to check the logs. And it did.

```bash
ssh pond "journalctl -u goatcounter -n 50"
```

It found the error, suggested the fix, and I approved the command to restart
the service. I never left the conversation.

That was the moment it clicked. My SSH config wasn't just for me anymore. Any
host I can reach, Claude can reach. Any command I can run remotely, Claude can
run remotely.

## The Combination

Here's where it gets interesting. These two things compound.

Locally, nix-shell means Claude can build, test, and run anything in any of my
projects. Remotely, SSH config means Claude can check, restart, and deploy
anything on my servers.

The AI goes from "helpful for writing code" to "helpful for everything."

Example from this week: I was debugging why a webhook wasn't firing. Claude:
1. Read the local webhook handler code
2. SSH'd to the server to check the logs
3. Found the error (SSL cert issue on callback URL)
4. Suggested the fix
5. I approved, it deployed
6. SSH'd back to verify the fix worked

That's five context switches I didn't have to make. Five terminal tabs I
didn't have to open. And I stayed focused on understanding the problem instead
of typing commands.

## What This Enables

With proper setup, Claude becomes useful for:

**Local development** - Run tests, check linting, build assets. Not "here's
how to run tests" but actually running them and reading the output.

**Server management** - Check service status, read logs, restart processes.
Actual ops work, not just suggesting commands.

**Debugging across boundaries** - Read local code, check remote logs,
correlate the two. The AI can see both sides of the problem.

**Deployments** - On my NixOS server, `nixos-rebuild switch` is the entire
deploy process. Claude can run it.

## The Trust Question

"But do you really want AI SSH'd into your production server?"

Fair question. My answer: it's my personal VPS running hobby projects. The
worst case is I rebuild it from my NixOS config. If this were production
infrastructure at work, I'd be more careful.

But for personal stuff? The productivity gain is massive. And honestly,
Claude is less likely to `rm -rf /` than I am after a long day.

## Setting It Up

If you want to try this:

**1. Create shell.nix files for your projects**

Even a minimal one helps:

```nix
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = with pkgs; [ ruby nodejs yarn ];
}
```

**2. Set up SSH config with key auth**

```
Host myserver
    HostName your.ip.here
    User youruser
    IdentityFile ~/.ssh/your_key
```

**3. Tell Claude about it**

In your CLAUDE.md or context file:
- "Use `nix-shell --run` for commands in projects with shell.nix"
- "SSH host `myserver` is available for server operations"

That's it. Now your AI assistant has actual hands instead of just a mouth.

## The Multiplier Effect

Good tools multiply your output. AI is a good tool. But AI with proper
environment access? That's a different category.

I'm not faster because the AI writes better code. I'm faster because the AI
can actually verify what it writes. It can run tests, check logs, and iterate
without me being the middleman.

The unholy trinity: Nix makes everything reproducible. SSH makes everything
reachable. Claude ties it together.

Set up your environment right, and AI coding assistants stop being a novelty.
They become infrastructure.
