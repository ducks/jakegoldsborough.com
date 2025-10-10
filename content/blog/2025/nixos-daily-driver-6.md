+++
title = "NixOS as a daily driver or Zero to Nixty, part 6/? - Dev environment"
date = 2025-07-08
description = "Introducing NixVim for declarative Neovim configuration and exploring nix-shell for creating reproducible, project-specific development environments without global installs."
[taxonomies]
tags = ["nixos", "linux"]
+++

### Recap

In the last post, we added some quality of life enhancements. This included
key remapping and getting hypridle and hyprlock set up.

See that post [here](/blog/2025/nixos-daily-driver-5).

### Intro

Today, I will be introducing `NixVim` and show you how to set up some
per-project development shells. The latter is a very powerful part of NixOS as
you'll see.

### NixVim

NixVim is a project that lets you declaratively configure Neovim in Nix. No
`init.lua`, `vimrc`, or plugin managers like Lazy or Packer.

It's part of a broader Nix-native ecosystem where tools, config, and
dependencies are defined in one declarative, reproducible system.

I use and suggest this for a few reasons:

1. Fully Declarative Neovim Config

This means all your plugins, keymaps, etc
are explicity defined. This will allow you to easily version it, share it, and
reproduce it on another system.

2. Automatic Plugin Management

No need to install anything with a plugin manager or run `:PackerInstall`,
`:LazySync` etc. When you build Nix, NixVim builds Neovim with all your plugins
downloaded and ready.

3. Tight Integration with Nix packages

You can inherit pkgs to bring in dependencies like `ripgrep`,
`lua-language-server`, or `stylua` directly. No external `npm`, `cargo`, `pip`,
or language-specific managers needed.

#### Initial Config

We are going to start small with our config and extend it further later.

```
{ pkgs, ... }: {
  programs.nixvim = {
    enable = true;

    # Enable basic plugins
    plugins = {
      lualine.enable = true;           # Statusline
      telescope.enable = true;         # Fuzzy finder
      treesitter.enable = true;        # Better syntax highlighting
    };

    # Use a Gruvbox theme (optional)
    colorschemes.gruvbox.enable = true;

    # LSP support
    plugins.lsp = {
      enable = true;

      # Example LSP: Lua
      servers = {
        lua-ls.enable = true;
      }
    }

    # Keymap example
    keymaps = [
      {
        mode = "n";
        key = "<leader>ff";
        action = "<cmd>Telescope find_files<CR>";
        options = {
          desc = "Find files";
        };
      }
    ];
  };
}
```

Let's break this config down.

First, and most importantly, we enable Nixvim by setting
`programs.nixvim.enable` to `true`. Then, we enable a few basic plugins through
`programs.nixvim.plugins`.

After that we enable the `gruvbox` color scheme and setup some basic LSP support.

Finally, we setup a keymap for `<leader>ff` that uses `telescope` to find files.

### `nix-shell` - What is it?

Now onto `nix-shell`. `nix-shell` is a tool that lets you temporarily enter a
development environment defined by a Nix expression. Think of it as a
lightweight, project-specific sandbox with all the tools and dependencies you
need -- and nothing you don't. They are like Python virtual environments, but
for any tool or language.

You can use `nix-shell` to:

- Spin up a shell with specific packages available
- Test tools or languages without installing them system-wide
- Set up consistent dev environments across machines or teams

#### Why Use It?

If you've ever run into "works on my machine" issues, `nix-shell` is the
antidote. By declaring your environment as code, you get repeatable,
deterministic setups every time -- no more dependency drift or missing tools.

It's also fantastic for trying out a new language or toolchain. Want to test
something in Ruby, Rust, or Go? You can be up and running with just a few
lines.

#### Example

Here’s what a simple `shell.nix` might look like for Rust development:

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.rustc
    pkgs.cargo
  ];
}
```

Run `nix-shell` in that directory, and boom, you'll be dropped into a shell
environment with `rustc` and `cargo` available but without being installed
globally.

#### One-Off Shells

In fact, you don't even need a `shell.nix` file. You could run
`nix-shell -p nodejs` and you would be dropped into a shell with `nodejs` 
installed locally, meaning it's not installed globally.

Overall, `nix-shell` is one of the most powerful parts of Nix/NixOS.

### Summary

In this post, we have:

- Enabled NixVim and set up a simple, usable Neovim config
- Introduced `nix-shell` and showed how it can be used to create temporary,
  repeatable dev environments
- Explained how to launch one-off shells and why `nix-shell` is so useful for
  development workflows
