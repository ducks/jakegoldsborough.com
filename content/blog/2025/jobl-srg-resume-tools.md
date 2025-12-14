---
title: "JOBL and SRG: Building Resume Tools I Actually Want to Use"
date: 2025-12-14
description: "Building a TOML-based resume format and static generator after
  layoffs reminded me to keep my options open. Sometimes the best response to
  uncertainty is building something you control."
taxonomies:
  tags:
    - rust
    - tools
    - resume
---

After getting laid off from my last job, I told myself I would keep my resume
updated and my options open. Then we had layoffs at Discourse. Nothing like
watching coworkers lose their jobs to remind you that stability is an illusion
and preparation matters.

I have been in a spec and tool building mood lately anyway. Something about the
uncertainty makes me want to build things I can control. JOBL and SRG fit that
mood perfectly.

## The Problem

I needed to update my resume. The last version was a LibreOffice doc. It was a
pain in the ass. The formatting was fragile. One change and the whole thing
shifted. Exporting to PDF was a gamble. And I could not version control it
properly because it was a binary blob.

What I wanted: plain text I can edit in vim, version control in git, and generate
HTML and PDF programmatically.

So I built it.

## JOBL: A TOML Resume Format

JOBL is a strict TOML-based resume format. The file extension is `.jobl` and
the structure is simple:

```toml
[person]
name = "Jake Goldsborough"
headline = "Infrastructure Engineer"
email = "jake@example.com"
location = "Portland, OR"
summary = "Backend systems and deployment automation."

[skills]
Languages = ["Ruby", "Rust", "JavaScript"]
Infrastructure = ["Docker", "Kubernetes", "NixOS"]

[[experience]]
title = "Software Engineer"
company = "Discourse"
start = "2025-06"
end = "current"
summary = "Infrastructure team, backend systems, deployment tooling."
highlights = [
  "Built postgres-manager HTTP service replacing MessageBus pub/sub",
  "Reduced duplicate operations and improved operational visibility"
]

[[projects]]
name = "Transit Tracker"
url = "https://github.com/ducks/discourse-transit-tracker"
summary = "Live departure board plugin for Discourse showing real-time transit arrivals"

[[education]]
degree = "BS Computer Science"
institution = "State University"
start = "2016"
end = "2020"
```

TOML is human readable. You can edit it in any text editor. Comments are
supported. Syntax errors fail fast at parse time. Version control works
perfectly because it is plain text.

## Why TOML Instead of JSON or YAML

JSON is for machines. Writing nested structures by hand is miserable. No
comments. Trailing commas break everything. It is data interchange format, not
a human authoring format.

YAML has too many footguns. Indentation matters. Multiple ways to express the
same thing. The Norway problem (NO gets parsed as boolean false). Anchors and
references add complexity I do not need.

TOML is boring in the best way. One obvious way to express each type. Strict
validation. Native Rust support via serde. No surprises.

## The Parser: Strict Validation

JOBL uses a two phase validation approach:

1. Parse TOML into generic Value to catch unknown keys
2. Deserialize into typed structs for field validation

This catches typos immediately. If you write `titel` instead of `title`, you
get an error with the exact path: `experience[0].titel: unknown field`.

The parser collects multiple errors instead of failing fast. When you have five
typos, you see all five at once instead of fixing them one at a time.

```rust
pub fn parse_file(path: &Path) -> ValidationResult<JoblDocument>
pub fn parse_str(input: &str) -> ValidationResult<JoblDocument>
```

Simple API. File or string in, validated document or errors out.

## No Version Field

I originally included a `jobl_version` field in documents. Then I removed it.

Docker recently dropped version fields from their configs. The library version
determines what spec you support. Simpler for users. They do not maintain a
version field. The parser handles compatibility.

You can always add versioning later if you need it. Start simple.

## SRG: Static Resume Generator

JOBL handles data. SRG handles rendering.

```bash
srg --input resume.jobl --out dist --template minimal
```

Reads your JOBL file, generates `dist/index.html` and `dist/resume.pdf`. Single
binary. No dependencies except Chrome for PDF generation.

The HTML is self contained with embedded CSS. Email it. Put it on a static
host. It just works.

## PDF Generation: Headless Chrome

I was skeptical about using headless Chrome for PDF generation. It seemed
heavy and finicky. I've tried an HTML -> PDF method before with less than ideal
results. But it works incredibly well.

The HTML you write is the PDF you get. Print media queries work exactly as
expected. Local fonts load synchronously. No layout rewriting needed.

```rust
let pdf_data = tab.print_to_pdf(Some(PrintToPdfOptions {
  landscape: Some(false),
  display_header_footer: Some(false),  // No browser artifacts
  print_background: Some(true),        // Keep CSS backgrounds
  scale: Some(1.0),
  paper_width: Some(8.5),
  paper_height: Some(11.0),
  // ... margins, etc
}))
```

Alternative was native Rust PDF libraries like printpdf. That means manually
positioning every element. Reimplementing layout logic. Maintaining two
rendering paths (HTML and PDF).

Headless Chrome means one rendering path. CSS does the work. The PDF matches
the HTML perfectly.

## Layout System: Structure Without HTML

Users should not need to write HTML to customize their resume. But they should
be able to control structure and formatting.

The layout system is a simple DSL:

```
person
  name
  headline
  email

experience
  title
  company
  start " - " end
  highlights

education
  degree
  institution
  start " - " end
```

Section names at indent level 0. Field names at level 2. Order matters.

Quoted strings are literals. Unquoted words are field names. Mix them:

```
person
  name "at" email
  "Location:" location

experience
  start " - " end
```

Renders as:

```
Jake Goldsborough at jake@example.com
Location: Portland, OR

2025-06 - current
```

The layout file controls what shows and in what order. The template (minimal,
professional, etc) controls CSS styling. Separation of concerns.

## Why Build This

Practical answer: I needed to update my resume and existing tools did not fit
how I work.

Real answer: building tools gives me a sense of control when everything else
feels uncertain. Layoffs happen. Companies change. Markets shift. But code I
write is mine. Specs I design are mine. Tools I build solve problems exactly
how I want them solved.

This is not about resume formats. This is about responding to uncertainty by
building something you own completely.

## Current Status

Both projects are functional and tested:

- JOBL: 7 unit tests, strict validation, clean error messages
- SRG: layout system with quoted strings, PDF generation working, 15 total
  tests
- Combined: about 1800 lines of Rust, all passing tests

Documentation sites are up at [https://jobl.dev](https://jobl.dev) (plain HTML,
no build step, Gruvbox theme with dark/light toggle).

Source is on GitHub if you want to look:
- [github.com/ducks/jobl](https://github.com/ducks/jobl)
- [github.com/ducks/srg](https://github.com/ducks/srg)
