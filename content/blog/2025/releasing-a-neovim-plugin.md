---
title: How I accidentally wrote my first Neovim plugin
date: '2025-06-25'
description: A journey from regex-powered single-line rewrites to a fully tested Neovim
  plugin for formatting JavaScript and Rust imports, learning why simpler solutions
  sometimes beat powerful tools like Treesitter.
taxonomies:
  tags:
    - neovim
    - lua
---

### Just Show Me The Code

[repo](https://github.com/ducks/nvim-vandelay)

### The Problem


There is a simple motion I use in Neovim often and I finally decided to do
something about it.

That motion is breaking up single line imports into multiline imports.

Example:

This:

`import { foo, bar, baz } from './utils';`

Should become:

```
import {
  foo,
  bar,
  baz,
} from './utils';
```

It's a tiny thing but something I do all the time in javascript, typescript, and
rust. Even if it's less than 80 characters wide, I really like breaking multiple
modules imports down to separate lines.

### The First Approach: Regex (And Why It Worked)

The very first version of Vandelay used simple Lua string matching:

```
local pattern = [[import%s*{%s*(.-)%s*}%s*from%s*(.*);]]
local names, from = string.match(line, pattern)
```

This captured two groups:
- `names` - the full list inside `{ ... }`
- `from` - the source string

After capturing, it simply:
- Split `names` on commas into a table of individual imports
- Trimmed whitespace
- Reconstructed the formatted import line with newlines and indentation

#### Why It Worked

The format of imports I wanted to modify was extremely predictable. I only cared
about one specific form and I was only operating on one line at a time. Lua
strings were simple and fast for this very specific case. This worked extremely
well from the start and passed some simple tests that tests import structure.

### Adding Treesitter (And Why It Didn't Work)

I thought using Treesitter would make the plugin more robust. It sounded like a
perfect fit: parse the full AST, extract imports properly, and avoid relying on
fragile string patterns.

In practice, I quickly ran into problems:

- Complex Treesitter queries for what seemed like simple tasks
- Accidental full-line and full-file rewrites when I only wanted to touch one line
- Query capture ordering issues that merged unrelated imports together
- Inconsistent grammar across different Treesitter parser versions
- Parser installation requirements that added more dependencies
- Much more boilerplate code for very minimal benefit

Treesitter excels for full-file refactors, linters, or analysis tools.
But for surgical, highly structured, one-line rewrites? It was overkill.

### What I Learned

Treesitter is powerful. But **power doesn’t always equal simplicity** —
especially for narrowly scoped formatting tasks.

For this plugin, regex provided:

- Faster iteration
- Predictable behavior
- No parser dependencies
- Simple implementation
- Easier testing

Sometimes simple string matching really is enough -- especially when your input
format is highly constrained.

### nvim-vandelay 1.0

The end result became `nvim-vandelay`.

- A micro-plugin for formatting imports
- Fully manual keybind control
- Regex-powered single-line rewriting
- Rust and JavaScript support out of the box
- Fully tested via Plenary + CI

Here is another link to the repo:
[nvim-vandelay](https://github.com/ducks/nvim-vandelay)
