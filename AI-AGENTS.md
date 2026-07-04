# AI-AGENTS.md

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
  Drafts live under `content/blog/_drafts/` (gitignored).
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
