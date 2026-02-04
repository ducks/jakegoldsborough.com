---
title: "cfgs.dev: A Directory for Developer Setups"
date: 2026-02-03
description: "Building a browsable index of dotfiles and development environments."
taxonomies:
  tags:
    - dev
    - oss
    - tools
---

There's something useful and interesting about seeing how other developers
configure their tools. When I'm setting up something new or looking for a
better workflow, I want to see what people who use the tool every day have
settled on. What colorscheme? What keybindings? What plugins?

The problem is discovery. GitHub search is terrible for this. Searching
"neovim config" returns 500,000 repos, most of which are forks or abandoned.
Dotfile repos have no standard structure. Some people have `nvim/init.lua`,
others have `.config/nvim/init.vim`, others have everything in a single
`dotfiles` monorepo.

So I built [cfgs.dev](https://cfgs.dev).

## What It Does

cfgs.dev scans GitHub repos and extracts what tools people use. Not just "this
repo has Neovim" but "this repo uses Neovim with lazy.nvim, gruvbox, lualine,
telescope, and nvim-cmp."

You can browse by category (editors, terminals, window managers) or by specific
tool. Want to see how people configure Hyprland? There's a page for that.

The detection is declarative. Each tool has a JSON config that specifies file
patterns to match and content to extract:

```json
{
  "name": "Neovim",
  "patterns": ["nvim/init.lua", ".config/nvim/**/*.lua"],
  "contentFlags": {
    "pluginManager": {
      "lazy.nvim": ["lazy.nvim", "folke/lazy"],
      "packer": ["packer.nvim", "wbthomason/packer"]
    },
    "theme": {
      "gruvbox": ["gruvbox"],
      "tokyonight": ["tokyonight"]
    }
  }
}
```

When the scanner finds a matching file, it checks the content for these
patterns. First match wins per category. The result is a structured view of
what the config actually contains.

## Deep Detection

The latest version goes deeper on Neovim specifically. It now detects 14
categories of config details:

- Distribution (LazyVim, AstroNvim, NvChad)
- Plugin manager (lazy.nvim, packer, vim-plug)
- LSP setup (nvim-lspconfig, coc.nvim)
- Completion (nvim-cmp, coq, deoplete)
- Statusline (lualine, lightline, airline)
- File explorer (nvim-tree, neo-tree, oil.nvim)
- Fuzzy finder (telescope, fzf-lua)
- Theme (gruvbox, tokyonight, catppuccin, etc.)
- And more

The tricky part was handling multi-file configs. A typical Neovim setup has
`init.lua` that just requires other files, with the actual plugin configs in
`lua/plugins/*.lua`. The scanner now merges details from all matching files
instead of stopping at the first match.

## Badges

You can embed your setup in your README:

```markdown
![setup](https://cfgs.dev/api/badge/yourusername)
```

This returns a shields.io style badge showing your top tools. There are options
for filtering by category and changing the style.

## What Works

The declarative detector system is nice. Adding a new tool is just appending to
a JSON file. No TypeScript, no build step, no tests to write. The refactor from
code-based detectors to config-based ones removed 455 lines.

Browse-by-tool is useful for discovery. Instead of searching through random
repos, you can see "here are 47 people using Helix" and look at their configs.

## What Doesn't

Scanning requires cloning repos locally, which takes time. A shallow clone of a
typical dotfiles repo is fast, but large repos or slow connections can timeout.
I cache scan results so subsequent visits are instant.

Detection accuracy varies. Simple tools are easy (if `kitty.conf` exists, they
use Kitty). Complex tools with many config locations are harder. Neovim alone
has like 6 different places people put their config.

The data model is flat right now. There's no way to express relationships like
"this person switched from packer to lazy.nvim" or "these configs are forks of
each other." That might be interesting but it's a lot more complexity.

## What's Next

More tools. The current list covers the popular stuff but there are gaps. I
want to add detection for shell frameworks (Oh-My-Zsh, Prezto), prompt themes
(Starship, Powerlevel10k), and multiplexers (tmux, Zellij).

Multi-tool filtering. Right now you can browse by single tool, but "show me
users with both Neovim and Kitty" isn't possible yet.

Similar setups. If you use Neovim with these 5 plugins, here are other people
with similar configs. This requires some fuzzy matching logic but the data is
there.

---

[cfgs.dev](https://cfgs.dev) |
[GitHub](https://github.com/ducks/cfgs.dev)
