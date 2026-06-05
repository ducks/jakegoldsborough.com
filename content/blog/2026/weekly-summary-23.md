---
title: Claude assisted Changelog - 23/52
date: '2026-06-05'
description: A heavy week on personal infrastructure - hardened the SRG / JOBL resume
  pipeline, shipped namecom-cli in nushell, built srg.jobl.dev as a sibling site
  to jobl.dev, stood up split analytics across both domains via self-hosted
  GoatCounter, and audited the hosted-resumes.com codebase.
taxonomies:
  tags:
    - claude
    - changelog
    - weekly summary
---

A long week on personal infrastructure, with the through-line being
"actually use the tools I've built." Most of what shipped this week was glue
between things that already existed.

**SRG and JOBL polish**

Spent the first part of the week hardening the JOBL + SRG + GitHub Actions
chain that renders [my resume](https://ducks.github.io/resume/) from a TOML
file. Added an `srg.toml` config so theme and output choices live next to
`resume.jobl` instead of inside the CI workflow. Dropped the binary cache
that was silently pinning CI to an old SRG version. Pointed SRG at the
repo's custom `template.resume` to render the GitHub URL and website fields
that the bundled `jake` layout was dropping. The kind of tooling work that
nobody sees but makes every subsequent change a one-line edit.

**namecom-cli**

Built a small nushell wrapper over the name.com Core API. Three subcommands -
`login` (interactive credential setup with /core/v1/hello validation), `list`
(returns a structured table you can pipe through `where` / `sort-by`), `add`
and `del`. About 150 lines of nushell. Auth via HTTP Basic, credentials in
~/.config/namecom/credentials.toml at mode 0600.

The reason to build it was that pond-nix's DNS workflow was "log into name.com
web UI, click Add Record, type the same thing as last time." Now I can
`namecom add jobl.dev stats A <ip>` from the shell and version DNS additions
alongside the NixOS config that produces them.

Wrote [a post](/blog/2026/namecom-cli-in-nushell/) on
what nushell saves you over the bash equivalent for this kind of tool: JSON
becomes structured tables, `http get` builtin removes the curl call, TOML
parses natively via `open`. Source at <https://github.com/ducks/namecom-cli>.

Caught a real bug along the way: nushell's `http post` doesn't apply the
Content-Type header when both `--headers` and `--content-type` are set. Filed
in my head as a follow-up. Worked around with direct curl for now.

**GoatCounter for jobl.dev and srg.jobl.dev**

Added a fourth GoatCounter instance to pond-nix for jobl.dev, fronted by Caddy
at stats.jobl.dev. Most of the work was a half-day detour trying to make the
site row creation zero-touch via systemd ExecStartPre. Got close - the
migration step works, but `goatcounter db create site` requires creating an
admin user, and the password prompt is interactive. systemd has no TTY, the
service died.

Considered three workarounds: store a generated password in a 0600 file
(plaintext-secret pattern I didn't love for one analytics dashboard), use
goatcounter's `-link` flag to share users across sites (cleaner but couples
all sites to one user), or adopt sops-nix / agenix for encrypted secrets
(overkill for one password). Ended up reverting the auto-provision entirely
and made peace with one SSH step per new instance: `sudo -u goatcounter
goatcounter db create site ...`. The lesson: not every step that feels manual
deserves automation.

After that, the standard chain - namecom-cli added the A record, Caddy got a
cert from Let's Encrypt, GoatCounter logged the first hit a few minutes
later.

**srg.jobl.dev as a sibling to jobl.dev**

Built a small landing page for SRG at srg.jobl.dev, mirroring jobl.dev's
gruvbox theme and font stack so the two read as siblings. Single index.html
with no build step - GitHub Pages legacy mode, `docs/` on `main`, CNAME
file declares the custom domain. Reused the goatcounter snippet but pointed
it at the same stats.jobl.dev/count endpoint.

That last decision turned out to be wrong. Both sites' hits ended up pooled
under one GoatCounter site row, and because both landing pages live at `/`,
the dashboard couldn't tell them apart. Took a few back-and-forths to
convince me, but eventually I set up a proper split: new Caddy vhost
stats.srg.jobl.dev fronting the same goatcounter instance, updated the site
row's cname to match, updated srg.jobl.dev's HTML snippet to post there. Now
the dashboard's site selector switches cleanly between the two.

Worth noting: I spent half an hour trying to talk myself out of doing this
split because the data was technically being collected. The right move was to
fix it the first time the user asked.

**hosted-resumes.com audit**

A friend asked how I built my resume, which surfaced that hosted-resumes.com
already exists as an MVP-shaped codebase. About 6,000 lines of TypeScript /
Svelte, with auth, multi-tenant routing, a PostgreSQL schema, an editor with
live preview, a Rust PDF microservice wrapping SRG, and Stripe / S3
integration stubbed out. Closer to "ship to a friend" than I'd remembered.

Did a gap analysis: skip the Stripe and S3 stubs for a friend MVP, set up the
deploy infrastructure (wildcard DNS, wildcard TLS via DNS-01, Caddy, Postgres,
the SvelteKit app, the PDF service), and the buddy can be on
`<him>.hosted-resumes.com` after a focused Saturday. Didn't start that work
this week - decided to finish the GoatCounter / srg.jobl.dev thread first
rather than context-switch.

**Considered but parked**

Looked at dnscontrol as the declarative alternative to namecom-cli. It's the
right answer for "DNS as code with drift detection," but the name.com
provider is unmaintained and the friction outweighs the benefit at this
scale. namecom-cli stays the imperative tool; if I ever want declarative
DNS, dnscontrol is the migration path.
