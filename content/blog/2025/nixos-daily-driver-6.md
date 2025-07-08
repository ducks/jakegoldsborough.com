+++
title = "NixOS as a daily driver or Zero to Nixty, part 6/? - Dev environment"
date = 2025-07-08
[taxonomies]
tags = ["nixos", "linux"]
+++

### Recap

In the last post, we added some quality of life enhancements. This included
key remapping and getting hypridle and hyprlock set up.

See that post [here](/blog/2025/nixos-daily-driver-5).

### Intro

Today, I will be introducting `NixVim` and show you how to set up some
per-project development shells. The latter is a very powerful part of NixOS as
you'll see.

### NixVim

NixVim is a project that let's you declaratively configure Neovim in Nix. No
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

After that we enable the `gruxbox` color scheme and setup some basic LSP support.

Finally, we setup a keymap for `<leader>ff` that uses `telescope` to find files.
