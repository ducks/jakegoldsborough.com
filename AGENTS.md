# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, etc.) when working with code in this repository.

## What this is

Jake Goldsborough's personal site (jakegoldsborough.com) — a Zola static
site: blog, resume, and a projects showcase.

## Commands

```bash
nix-shell             # enters a shell with rustc, cargo, and zola on PATH
zola build             # build the site into public/
zola serve              # dev server with live reload (default: 127.0.0.1:1111)
```

There is no test suite, linter, or package manager step — Zola is the only
build tool. `public/` is generated output and gitignored; never edit it
directly.

## Deployment

Woodpecker CI (`.woodpecker.yml`) builds with `zola build` and rsyncs
`public/` to a remote host (`pond:/var/www/jakegoldsborough.com/`) on every
push to `main`. There is no staging environment — merging to `main` deploys.

## Content model

- **Blog posts**: `content/blog/<year>/<slug>.md`, one directory per year.
  YAML frontmatter (`title`, `date`, `description`, `taxonomies.tags`).
  A post developed on a feature branch lives at its intended
  `content/blog/<year>/<slug>.md` path with normal publishable frontmatter; the
  branch itself keeps it from deploying until it is merged to `main`. Use the
  gitignored `content/blog/_drafts/` directory only for local scratch drafts
  that are not meant to travel with a branch.
- **Resume**: `content/resume.md` is a near-empty page that renders via the
  `{{ resume_content() }}` shortcode. The actual resume content — all
  experience, skills, and bullet points — lives in
  `templates/shortcodes/resume_content.html` as hand-written HTML, not in
  `content/`. Edit that template directly to update the resume; entries
  under each role are ordered most-recent-first.
- **Projects showcase**: a separate thing from the resume. Structured data
  in `data/projects.toml` (categories → projects, each with name/url/
  description), rendered by `templates/shortcodes/projects_list.html` and
  included from `content/projects.md`. This is for public open-source
  projects (TUI apps, tools), not employer work — resume entries for
  employer/production work don't belong here.
- Other top-level pages (`content/contact.md`, `content/request-an-article.md`,
  etc.) are simple standalone Markdown pages using the default page template.

### Blog series

To add a post to a series, add one field to its YAML frontmatter:

```yaml
extra:
  series: "Replaybook"
```

The standard post template finds every post with the same exact series name,
orders them by publication date, and renders a linked series box with the
current post highlighted. Do not add hand-written previous/next or catch-up
links; the generated series navigation is the source of truth.

## Weekly changelog posts

The recurring "Agent assisted Changelog" series summarizes the week's
work. To draft one:

- **File**: `content/blog/<year>/weekly-summary-<N>.md`, where `<N>` is
  the ISO-ish week number continuing the existing sequence (check the
  highest existing `weekly-summary-*.md`; gaps in posting are fine and
  worth a wry one-line acknowledgment in the intro).
- **Frontmatter**: `title: Agent assisted Changelog - <N>/52`, the
  posting date, a `description` teasing 2-3 concrete items, and tags
  `[agents, changelog]`. (Older posts in the series are
  titled "Claude assisted Changelog"; the series is generic now, since
  the work involves multiple agents.)
- **Sources**: the daily notes in `~/agents/notes/<year>/` for the days
  since the previous summary's date, plus the conversation at hand.
  Cover the window since the last post, not the calendar week.
- **Layout**: a short intro paragraph naming the week's shape; one H2
  per project or theme (4-6 sections; fold minor items into a shared
  section rather than giving every small thing its own heading); close
  with a `## The through-line` section connecting the week to a larger
  thread of Jake's work.
- **Voice**: first person, conversational, technically specific, a
  little wry. Real numbers and real bug stories over feature lists -
  the best sections narrate a debugging arc or a design decision, not a
  changelog dump. Failures and corrections are content, not omissions.
- **Links**: link project repos on first mention and cross-link related
  posts on this site. If the summary references a post that is still
  unpublished/staged, say so in the draft summary handed to Jake so the
  posts can ship together.
- Leave the draft uncommitted for Jake to review and publish.

## Templates

Tera templates in `templates/`. `base.html` is the shared layout; `page.html`
and `blog/single.html` extend it for generic pages and blog posts
respectively. Shortcodes (`templates/shortcodes/`) are reusable HTML/Tera
fragments invoked from Markdown content via `{{ shortcode_name() }}` —
`resume_content` and `resume_intro` are the resume shortcodes, `projects_list`
renders the projects page from `data/projects.toml`.

Styling is plain CSS under `static/css/`, split by concern (`blog.css`,
`resume.css`, `table.css`, etc.) rather than a single stylesheet — check
whether an existing file already covers what you're styling before adding a
new one.
