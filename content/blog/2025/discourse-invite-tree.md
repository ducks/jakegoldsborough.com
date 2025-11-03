---
title: Visualizing Discourse Invite Trees
date: '2025-11-03'
description: A simple Discourse plugin that visualizes who invited whom as an ASCII tree, inspired by Lobsters.
taxonomies:
  tags:
    - discourse
    - ruby
    - oss
---

I built a small Discourse plugin that shows who invited whom in your
community. It displays the invite relationships as an ASCII tree, similar to
how [Lobsters](https://lobste.rs/users) shows their user invites.

![Invite tree showing users with ASCII connecting lines](/images/discourse-invite-tree.png)

The tree shows usernames, join dates, and how many people each user has
invited. Users without an inviter (founding members or self-signups) appear at
the root level, with their invite chains nested below.

The plugin works great with Discourse's native invite-only mode. If you enable
invite-only registration, the tree visualization lets you see exactly how your
community has grown through invites over time.

Back in 2017, someone on Meta asked about [tracking referrals and
invites](https://meta.discourse.org/t/tracking-referrals-encouraging-users-to-invite-others/75040).
People were using Data Explorer with custom SQL queries to see this data. This
plugin makes it visual and accessible at `/invite-tree`.

The implementation is straightforward: a recursive SQL query builds the tree
from Discourse's native invite tables, and a Glimmer component renders it with
monospace font and tree characters. The whole thing is about 600 lines.

I kept it minimal and hackable. No complex features, just a clean tree that
adapts to your theme. If you want to customize how it looks or what it shows,
the code is easy to modify.

Check it out: [discourse-invite-tree on
GitHub](https://github.com/ducks/discourse-invite-tree)
