---
title: "I Got Tired of gh Failing, So I Built Tongs"
date: 2026-08-20
description: "I wanted a GitHub CLI that agents could depend on: stable JSON, no prompts, safe mutations, and no giant GraphQL query standing between me and a pull request. So I built Tongs."
taxonomies:
  tags:
    - go
    - cli
    - ai
    - tools
    - github
---

I was trying to review a pull request. `gh` failed.

Not because the pull request was gone. Not because my token had expired. Not
because GitHub was down. A GraphQL query somewhere inside `gh` had failed, and
the ordinary pull request operation I wanted went down with it.

This was not the first time.

I had already started working around these failures with direct API calls. That
works, but now every agent has to rediscover the endpoint, authentication,
pagination, response shape, and whatever bit of GraphQL GitHub still requires
for review threads. I did not want a growing pile of one-off `curl` and `jq`
commands pretending to be a tool.

So I wrote another GitHub CLI.

It is called [Tongs](https://github.com/ducks/tongs), which retroactively stands
for **Typed Operations for Networked Git Services**.

## REST first, not REST only

The first design decision was simple: use REST for normal pull request work.

Creating a pull request does not need GraphQL. Neither does inspecting one,
editing its body, checking CI, submitting an approval, or merging it. Tongs uses
the smaller REST operation for each of those instead of asking GitHub one large
question and hoping every field remains available.

GitHub does reserve some review-thread operations for GraphQL. Replying to and
resolving a thread still use it, but those queries live inside that narrow part
of the GitHub adapter. If GitHub changes a review-thread field, `tongs inspect`
does not care.

The point is not that GraphQL is bad. The point is that unrelated surfaces
should fail independently.

## What agent-native means

Tongs calls itself agent-native. That does not mean it contains a model or asks
an LLM what command to run. It means the command behaves like something an
agent can safely build on.

Every successful command returns the same outer JSON shape:

```json
{"schema_version":"1","ok":true,"data":{}}
```

Failures have a stable error object and a useful exit code:

```json
{"schema_version":"1","ok":false,"error":{"code":"not_found","message":"Not Found","status_code":404}}
```

There are no tables to scrape, decorative status lines to strip, or prompts
waiting invisibly for input. Authentication checks environment variables, the
git credential helper, and an existing `gh` login as a migration fallback. If
none of those work, Tongs fails. It does not suddenly ask an unattended agent
for a username.

That last behavior required its own fix. My first credential-helper call could
still fall through to Git's interactive prompt. The CLI designed not to prompt
prompted on its first real authentication failure. Setting Git's terminal
prompt flag to false fixed it.

The useful distinction is not human CLI versus AI CLI. Humans also benefit from
commands that return predictable data and fail without theater. Agents just
make the sloppy parts impossible to ignore.

## Pull request work so far

Tongs detects the repository from the current git remote and, when possible,
finds the open pull request for the current branch. You can also be explicit:

```bash
tongs --repo discourse-org/mothership inspect 6620
tongs --repo discourse-org/mothership reviews 6620
tongs --repo discourse-org/mothership checks 6620
```

Review threads are first-class operations rather than a blob hidden somewhere
inside the pull request response. From inside the repository checkout:

```bash
tongs reply --thread PRRT_node_id --body-file reply.md 6620
tongs resolve --thread PRRT_node_id 6620
```

It can create and approve pull requests too:

```bash
tongs create --title "Add useful feature" --body-file description.md
tongs approve --body "Looks good" 6620
```

Mutations support `--dry-run`. Approval and merge requests include the pull
request's current head SHA, so an agent cannot inspect one revision and quietly
approve a different one after somebody pushes. Merge requires both an explicit
method and `--yes`:

```bash
tongs --dry-run merge --method squash 6620
tongs merge --method squash --yes 6620
```

These are small constraints. That is the point. A safe tool should make the
careful path the short path.

## GitHub is the first provider

I did not want to bake GitHub's nouns and response shapes through the whole
program, then discover later that adding GitLab meant rewriting it.

The command layer talks to a provider interface. Repository detection,
pull-request models, review threads, checks, and output schemas are shared.
GitHub-specific REST and GraphQL live in the GitHub adapter. GitLab, Gitea, and
Codeberg remotes can already be identified and parsed.

Their API adapters do not exist yet.

That boundary is deliberate. Tongs returns `provider_not_implemented` instead
of sending a GitLab repository to GitHub and producing a much more creative
error. The architecture is ready for more forges; the product is currently a
GitHub client. Those are different claims.

## Installing it

Tongs is written in Go and published at
[github.com/ducks/tongs](https://github.com/ducks/tongs). Install it with:

```bash
go install github.com/ducks/tongs/cmd/tongs@latest
```

There is also a Nix flake for development and packaging. CI runs the full test
suite with the race detector, `go vet`, and a clean build.

It is early. GitHub is the only implemented provider, the command set is still
smaller than `gh`, and I am sure the first other person to use it will find an
operation I assumed nobody needed. That is useful information. I would rather
grow it from actual agent workflows than clone every command in a mature CLI
before knowing which ones matter.

For now, Tongs does the part I built it for: inspect a pull request, understand
its review state, make a deliberate change, and return something a program can
trust.

No unrelated GraphQL field gets a vote.
