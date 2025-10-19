---
title: My First Official Contribution to Discourse
date: '2025-10-06'
description: A small but satisfying first PR to the Discourse core codebase.
taxonomies:
  tags:
    - discourse
    - oss
---

This past week marked a small but meaningful milestone for me - I submitted and
merged my first pull request to the Discourse core project. The fix is simple
but important: handle a `nil` commit URL path in `Admin::PluginsController`,
preventing a 500 error in the plugins admin UI.
([github.com](https://github.com/discourse/discourse/pull/35186))

### Debugging a random admin panel crash

I've been at Discourse for about two and a half months now, and most of my work
so far has been focused on internal tools and infrastructure rather than the
main codebase itself. It's been a great way to learn how things fit together
behind the scenes, but I've been itching to make a direct impact on the project
that everyone actually sees and uses.

This PR was a small but deliberate step in that direction. I wanted to start
contributing to the public codebase, not just to fix a bug, but to get more
familiar with the patterns, tests, and expectations that make Discourse what it
is. It's one thing to understand how we run it internally - it's another to
touch the core code that powers thousands of communities around the world.

There's also a kind of quiet satisfaction in cleaning up a small edge case like
this. It's the kind of detail that no one notices when it's working, but it
makes the whole system sturdier. That's the kind of work I enjoy doing.

### What the bug was, succinctly

- In **`lib/plugin/instance.rb`**, the method `discourse_owned?` was calling
  `.split` on `parsed_commit_url.path` without checking if `path` might be
  `nil`.
- In the scenario where a plugin has a commit URL parsed successfully but the
  `path` is `nil` (for example, plugins without a git remote configured), this
  led to a crash (HTTP 500) in `/admin/plugins`.
- My patch adds a `nil` check: if `parsed_commit_url.path` is `nil`, the method
  returns `false` (or skips the split) gracefully. I also added a test case to
  assert this behavior.

In short: prevent a rare but real crash, and make the behavior deterministic in
that edge case.

### How the review and merge went

The PR moved relatively smoothly:

- I opened the PR and described the bug and proposed patch.
- The maintainers reviewed and approved it.
- After passing all checks, the PR was merged into `main`.
- The branch was deleted afterward.

It was a small change - only +11 / -1 lines - but I made sure the fix was clean,
covered by a test, and clearly explained. Small contributions like this build
trust and open the door to more.

#### Takeaways

Fixing something this small reminded me that even the simplest changes can
improve confidence in a codebase. It also helped me see more of the moving parts
that make Discourse work - how plugins tie in, how errors surface in the admin
panel, and how tests are structured to catch regressions early.

It's easy to think of "first contributions" as symbolic, but what really mattered
was understanding how to move through the process: spot an issue, confirm it,
write a clean fix, explain it clearly, and see it merged. That flow is something
I want to keep refining.

Going forward, I want to:

- Explore other bug reports in Discourse (especially in plugins and the admin
  UI)
- Take on slightly more complex patches (refactors, performance improvements,
  new features)
- Use this experience to contribute in a modular, maintainable way
