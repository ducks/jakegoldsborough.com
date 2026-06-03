---
title: "A tiny name.com CLI, and what nushell saves you"
date: 2026-06-03
description: "I needed to manage DNS records on a name.com domain from the command line. The tool ended up being about 150 lines of nushell. Here's what nushell does on the way that bash doesn't."
taxonomies:
  tags:
    - nushell
    - cli
    - tools
    - dns
---

I run a small VPS (pond-nix) that hosts a few personal services behind Caddy. Adding a new service means two things: a NixOS module that runs the service, and a DNS record on name.com pointing at the box. The NixOS side is declarative and versioned. The DNS side was "log into name.com, click Add Record, type the same thing I typed last time." I wanted to fix that.

What I built is [namecom-cli](https://github.com/ducks/namecom-cli), a small nushell wrapper around the [name.com Core API](https://docs.name.com/api/v1/overview). Three subcommands so far:

```nu
namecom login                            # interactive credential setup
namecom list jobl.dev                    # list every DNS record on a domain
namecom add  jobl.dev stats A 1.2.3.4    # add an A record
namecom del  jobl.dev 12345678           # delete by record id
```

About 150 lines including the README. I want to walk through three places nushell made the tool smaller than the bash equivalent would have been.

## JSON in, tables out

The name.com API returns JSON for everything. Listing records gives you back a structure like:

```json
{
  "records": [
    {"id": 1, "host": "stats", "type": "A", "answer": "1.2.3.4", "ttl": 300},
    {"id": 2, "host": "ci",    "type": "A", "answer": "1.2.3.4", "ttl": 300}
  ]
}
```

In bash, that's a `jq` pipeline away from being useful. In nushell, it's already a table. The whole `list-records` command is:

```nu
export def main [domain: string] {
  let result = (api-get $"/core/v1/domains/($domain)/records")
  $result.records? | default []
}
```

That return value is a real nushell table, which means a user can pipe it through anything else nushell knows about:

```nu
namecom list jobl.dev | where type == "A"
namecom list jobl.dev | sort-by host | select host type answer
namecom list jobl.dev | where answer == "1.2.3.4" | get id
```

I didn't write the `where`, `sort-by`, or `select` plumbing. Nushell brought it for free because the data shape is structured.

In bash you'd write all that as `jq` filters per call. The user has to know jq syntax. The errors come out as jq errors instead of shell errors. And every script that consumes the output has to reparse JSON. Here, the consumer is already in the language.

## Authentication without leaking the token to ps

name.com's API uses HTTP Basic Auth. The obvious thing is to pass the credentials to curl with `-u username:token`. The problem is that on shared hosts (or anywhere with multiple users), `ps aux` shows every running process's command line including arguments. The token shows up in plain text every time the tool runs.

The fix is to build the Authorization header explicitly and pass it via `--headers`:

```nu
export def auth-header [] {
  let creds = (load-credentials)
  let token = ($"($creds.username):($creds.token)" | encode base64)
  $"Basic ($token)"
}

export def api-get [path: string] {
  let url = $"(base-url)($path)"
  http get --headers [Authorization (auth-header)] $url
}
```

Two notes on this. First, nushell ships an `http get` builtin: no curl call needed, no separate Content-Type parsing, no manual JSON decode. The response comes back as a parsed record automatically. Second, `encode base64` is a builtin pipe stage, not a separate `base64` invocation. The whole auth helper is six lines and reads top-to-bottom.

The bash equivalent involves either `curl -H "Authorization: Basic $(echo -n "$user:$tok" | base64)"` (works, looks awful, hard to test independently) or factoring it into a helper function that's still doing the same thing with more ceremony.

## TOML is parsed for free

Credentials live in `~/.config/namecom/credentials.toml`:

```toml
username = "your-namecom-username"
token    = "your-api-token"
```

Loading them is literally:

```nu
export def load-credentials [] {
  let creds = (open $path)
  if ($creds.username? | is-empty) or ($creds.token? | is-empty) {
    error make { msg: $"credentials file ($path) is missing username or token" }
  }
  $creds
}
```

`open` looks at the extension, picks a parser, returns a record. No `toml-cli` install, no `yq -p toml`, no hand-rolled regex. The whole loader is the file's existence check plus a sanity check on the keys.

I learned the hard way that this works for TOML but not for a bare `key = "value"` text file with no extension. Nushell's `open` returns the raw string in that case. (Initial version of the tool used a custom format; first run of `namecom login` immediately broke because `creds.username` was being called on a string. Renaming the file to `.toml` was the fix.)

## What doesn't go well in nushell

A few rough edges worth flagging if you're thinking about doing something similar:

- **External CLIs need the `^` prefix.** I needed `chmod` to set 0600 perms on the credentials file. `chmod 600 $path` doesn't work because nushell looks for a builtin. The fix is `^chmod 600 $path` so it shells out. Easy once you know, surprising the first time.
- **No package manager that anyone uses.** [nupm](https://github.com/nushell/nupm) exists but is explicitly experimental. Distribution is "git clone, symlink the script onto PATH." That's fine for personal tools but a real friction point for anything you want strangers to install.
- **Error messages from inside the `http` family can be cryptic.** A misformatted credentials file produced "Data cannot be accessed with a cell path" because the parsed `creds` was a string instead of a record. The fix was obvious in hindsight but the message didn't point at the cause.

## Login is a misnomer, but a useful one

name.com doesn't expose a programmatic token-mint endpoint. Tokens are created in the user's web dashboard. So `namecom login` can't actually fetch a token. What it does is point you at the right page (optionally with `xdg-open`), prompt for the token (with input suppression), write the file with 0600 perms, and validate it works by calling `/core/v1/hello`.

That's not OAuth. But the difference between "log in" and "edit a file in your config directory with the right name and permissions" is real. Calling the command `login` reads correctly even though the implementation is honest about what's possible.

## The actually-useful thing

I'm using this from pond-nix's deploy flow now. When I add a new Caddy vhost, I can `namecom add` the matching DNS record in one command instead of opening a browser. It's not a big tool, but the friction cost of adding new things to the VPS dropped from "context-switch into the browser" to "one extra shell line." That's the win.

If you want it: <https://github.com/ducks/namecom-cli>. ~150 lines of nushell, MIT-licensed, no warranty, file an issue if name.com's API shape drifts.
