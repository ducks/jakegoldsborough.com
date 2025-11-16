---
title: "Date-Ver: A Formal Spec for Date-Based Versioning"
date: 2025-11-15
description: "I created a formal specification for date-based version numbers because nobody else had. Now both Ubuntu and yaml-janitor are officially valid Date-Ver."
taxonomies:
  tags:
    - versioning
    - oss
    - specs
---

Yesterday I published [yaml-janitor](https://rubygems.org/gems/yaml-janitor)
using date-based version numbers like `20251115`. The version number is the
release date. Automatic, meaningful, no decisions needed.

Then I realized there's no formal specification for this. Semantic versioning
has [semver.org](https://semver.org/) with strict rules and RFC 2119 language.
Calendar versioning has [calver.org](https://calver.org/), but that's just a
pattern guide, not a spec.

So I built [date-ver](https://date-ver.com/).

## What It Is

date-ver is a formal spec for date-based version numbers. Instead of `1.2.3`
or `2.0.0`, you use `20251116`, `202511`, or `2025`.

The idea is simple: your version number is when you released, not what
changed. Works great for applications, utilities, and distributions where
users care about freshness over compatibility.

## Why It Exists

Projects have been using date-based versions forever. Ubuntu does `24.04` and
`24.10`. yaml-janitor uses `20251115`. But without a formal spec, everyone
makes up their own rules.

Questions that needed answers:
- Can you mix formats? (Yes: `2024` → `202505` → `20250601` is valid)
- Multiple releases per day? (Sequence numbers: `20251116.1`, `20251116.2`)
- Pre-releases? (Use your separator: `20251116.alpha.1` or `2025-11-15-rc-2`)
- Separators allowed? (Yes: `20251116` = `2025.11.16` = `2025-11-16`)

date-ver answers all of these with proper RFC 2119 language.

## The Separator Decision

Ubuntu uses dots (`24.04`). yaml-janitor uses nothing (`20251115`). Some
projects use hyphens or slashes. Rather than force everyone to change, date-ver
allows any single-character separator as long as you're consistent throughout
the entire version string similar to regex.

Valid:
- `20251116` (no separator)
- `2025.11.16` (dots throughout)
- `2025-11-16` (hyphens throughout)
- `2025/11/16` (slashes throughout)
- `20251116.alpha.1` (dots for everything)
- `2025-11-15-rc-2` (hyphens for everything)

Invalid:
- `2025.11-16` (mixed separators in date)
- `20251116-alpha.1` (mixing none with hyphen and dot)

Pick one separator and stick to it. All separator styles are equivalent. To
compare versions, strip separators and compare digits. Simple.

## Pick Your Precision

Projects choose their granularity:
- Year: `2025`
- Year-month: `202511` or `2025.11`
- Year-month-day: `20251116` or `2025.11.16`

More specific = higher precedence: `2025 < 202501 < 20250101`

Start with yearly versions and switch to monthly or daily whenever. No
breaking changes, just more precision when you need it.

## When to Use It

Good fit:
- Applications with regular releases
- Operating systems and distributions
- Tools where freshness matters
- Internal utilities

Bad fit:
- Libraries where compatibility matters
- APIs with semver expectations
- Projects with strict dependency contracts

Need to signal breaking changes? Use semver. Need to signal release timing?
Use date-ver.

## Building It

Wrote the spec following semver's structure:
- Summary
- Introduction
- Numbered rules with RFC 2119 language
- FAQ
- Examples

Built a website with GitHub Pages, Gruvbox colors, and automatic dark mode.
The spec itself uses date-ver `20251115` (it originally said `1.0.0` which was
pretty ironic).

## That's It

date-ver exists. The spec is done, the domain is live, and the website is up
at [date-ver.com](https://date-ver.com/).

Ubuntu is officially valid date-ver. So is yaml-janitor. Any project using
date-based versions can point to the spec now.

Maybe it catches on. Maybe it doesn't. Either way, there's a formal answer
when someone asks "why are your versions dates?"

The version is the release date. That's date-ver.

---

Full spec: [date-ver.com](https://date-ver.com/)
Source: [GitHub](https://github.com/ducks/date-ver) (CC BY 4.0)
