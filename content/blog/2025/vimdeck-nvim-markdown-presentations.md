---
title: "vimdeck.nvim: Markdown Presentations in Neovim"
date: 2025-11-07
description: "Rewrote vimdeck for Neovim using Treesitter. No Ruby, no temp files, just native Lua and clean slide rendering."
taxonomies:
  tags:
    - neovim
    - lua
    - oss
---

I live in the terminal and Neovim. We have been discussing lightning talks at work,
so I wanted a way to present using both. The original
[vimdeck](https://github.com/tybenz/vimdeck) used to work perfectly, but it's a
Ruby script that doesn't seem to work with Neovim.

So I rewrote it from scratch using Treesitter and Lua (and Claude).

## What It Does

You write your presentation in markdown. Separate slides with horizontal
rules (`---`). Run `:Vimdeck` and you get a fullscreen presentation with:

- ASCII art headers (h1 and h2 use figlet)
- Syntax highlighted code blocks
- Clean list rendering with bullets
- Blockquote formatting
- Keyboard navigation (Space/PageDown, Backspace/PageUp, q to quit)

![vimdeck presentation showing ASCII art header](/images/neovim-deck-1.png)

![neovimdeck prose slide](/images/neovim-deck-prose.png)

## Why Rewrite It?

The original vimdeck was solid for Vim, but it was not working for me in
Neovim. Adding to that, it felt like it could be done in a better, more native
way. The current Vimdeck was:

- External Ruby script (dependency management)
- Generated temp files for each slide
- Custom shell wrapper for keybindings
- redcarpet gem for markdown parsing

Neovim has Treesitter built-in. Lua is native. Why shell out to Ruby and
manage temp files when you can parse and render everything directly?

## The Approach

**Parser** (`lua/vimdeck/parser.lua`): Uses Treesitter to parse markdown
buffers. Queries for headings, code blocks, lists, quotes, paragraphs. Splits
content into slides on horizontal rules (thematic breaks).

```lua
local query = vim.treesitter.query.parse('markdown', [[
  (thematic_break) @separator
  (atx_heading) @heading
  (fenced_code_block) @code
  (list_item) @list_item
  (block_quote) @quote
  (paragraph) @paragraph
]])
```

For each captured node, extract the text and metadata (heading level, code
language, etc.). Group elements into slides based on separators.

**Renderer** (`lua/vimdeck/renderer.lua`): Takes parsed slides and renders
them to buffer lines with highlight instructions.

Headers get piped through figlet for ASCII art (h1 uses standard font, h2
uses small). Lists get bullet points. Blockquotes get vertical bars. Code
blocks get syntax highlighting via Treesitter string parsers.

**Navigation** (`lua/vimdeck/navigation.lua`): Opens slides in a new tab,
sets up keybindings, manages state. Updates the buffer content and applies
highlights when switching slides.

## Technical Bits

**Treesitter Integration**: The markdown parser exposes node types like
`atx_heading`, `fenced_code_block`, `list_item`. Each node has position info
(start/end row/col) and can extract text with
`vim.treesitter.get_node_text()`.

Getting clean text required helper functions. List items include the markdown
markers (`- item`), so we traverse child nodes to skip `list_marker` nodes
and extract just the content. Same for blockquotes (strip `>` markers) and
code blocks (strip fence markers).

**Heading Levels**: Treesitter gives you `atx_heading` nodes. To determine
level, check for child nodes like `atx_h1_marker`, `atx_h2_marker`, etc.

```lua
function M.get_heading_level(heading_node)
  for child in heading_node:iter_children() do
    if child:type() == 'atx_h1_marker' then return 1 end
    if child:type() == 'atx_h2_marker' then return 2 end
    -- ...
  end
  return 1
end
```

**Duplicate Elements**: Initial implementation captured both `list_item`
nodes and `paragraph` nodes inside them. Rendering each element separately
meant lists showed up twice. Fix: check node ancestry and skip paragraphs
that are children of list items or blockquotes.

**Newline Flattening**: `vim.api.nvim_buf_set_lines()` requires each array
element to be a single line. Figlet output and some text processing can embed
`\n` characters. Solution: scan lines before setting buffer content and split
any with embedded newlines.

## What It Supports

**All heading levels** (h1-h6). h1 and h2 get ASCII art via figlet if
available. h3-h6 render as plain text with style options such as box, dashed, or
underline.

**Code blocks** with language-specific syntax highlighting. The renderer
creates a Treesitter string parser for the code content and applies highlight
queries.

**Lists** render with bullet points (`*`). **Blockquotes** render with
vertical bars (`┃`).

![A neovim deck slide showing heading styling, lists, and blockquotes](/images/neovim-deck-heading.png)

## Per-Presentation Configuration

YAML frontmatter lets you configure individual presentations without
changing global settings. Add frontmatter at the start of your markdown:

```markdown
---
wrap: 80
center_horizontal: true
margin: 3
use_figlet: false
header_style: "underline"
---

# First Slide
```

The `wrap` option automatically wraps long paragraphs to the specified
width. Perfect for prose-heavy slides where you don't want to manually
hard-wrap text. Write flowing paragraphs in your markdown source and let
vimdeck handle the layout.

Header styles provide alternatives to figlet ASCII art. Options include
`underline` (single/double lines), `box` (Unicode box drawing), `double`
(double-line boxes), and `dashed` (dotted underlines). All use Unicode
characters for clean terminal rendering.

Frontmatter parsing uses a simple YAML parser (20 lines of Lua) that
handles basic key-value pairs. Supports booleans, numbers, and strings.
The frontmatter config merges with global config, so you only override what
you need.

## Installation

Using lazy.nvim:

```lua
{
  'ducks/vimdeck.nvim',
  cmd = { 'Vimdeck', 'VimdeckFile' },
  opts = {
    use_figlet = true,
    center_slides = true,
  }
}
```

Requires figlet for ASCII art headers:

```bash
# macOS
brew install figlet

# Arch Linux
sudo pacman -S figlet

# NixOS
pkgs.figlet
```

And markdown Treesitter parsers:

```vim
:TSInstall markdown markdown_inline
```

## Usage

Write your presentation:

````markdown
# First Slide

Content here

---

## Second Slide

More content

---

### Code Example

```lua
function hello()
  print("Hello!")
end
```
````

Open in Neovim and run `:Vimdeck`. Navigate with Space/PageDown for next
slide, Backspace/PageUp for previous, q to quit.

## Differences From Original

The original vimdeck was a Ruby script. This is a native Neovim plugin.

- No external dependencies (besides figlet for ASCII art)
- No temp files
- Treesitter parsing instead of redcarpet
- Dynamic rendering instead of static file generation
- Works with Neovim's highlight system directly

## Things To Remember

**Treesitter is powerful**: The markdown parser handles all the edge cases
(nested lists, multi-line quotes, code fence detection). Using the query
system is cleaner than regex parsing.

**Node traversal matters**: Getting clean text from Treesitter nodes requires
understanding the tree structure. List items have marker nodes, code blocks
have fence nodes, quotes have paragraph children. Walking the tree to extract
just content nodes is necessary.

**Lua quirks**: Coming from Ruby, easy to forget `not` instead of `!`, `~=`
instead of `!=`, `..` for string concatenation, 1-indexed tables.

**Code**: [github.com/ducks/vimdeck.nvim](https://github.com/ducks/vimdeck.nvim)
