+++
title = "NixOS as a daily driver or Zero to Nixty, part 4/? - dotfile/config management"
date = 2025-06-26
[taxonomies]
tags = ["nixos", "linux"]
+++

### From TTY to Tiling

In the last post, we enabled Hyprland and set it to run by default on login.

In this post, we will be going over how to manage your NixOS config in version
control. This step might be overkill for some but it makes it so we can easily
checkout our config on any machine and have a working NixOS install fairly
quickly.

We will also cover a little Hyprland config at the end.

### Introducing Dotter

[Dotter](https://github.com/SuperCuber/dotter) is a dotfile manager and templater.

You have a repo of dotfiles and two main config files:

`.dotter/global.toml`
  - global config where you define "modules" and tell Dotter how to handle
    copying config.
  - commit to version control

`.dotter/local.toml`
  - Per machine file that tells dotter which config to load. The idea being
  you may have different config needs for linux, macos, or windows.
  - This file is not committed to git.

After configuring everything, you simply run `dotter deploy` and the config
files are copied to the locations set in `global.toml`.

It's a great project and I highly recommend it.

### Moving NixOS Config to Dotfiles Repo

The first thing we'll do is add a new directory in our dotfile repo. Then
we'll need to open up our `.dotter/global.toml` file and add our NixOS config
paths. That looks like this for me:

```
[nixos.files]
nixos = '/etc/nixos'
```

In Dotter talk, this is setting up a "module" named `nixos`. We are telling Dotter
that this module's files will be located in the `nixos` folder and need to be
copied to `/etc/nixos`.

Now you will need to move the current NixOS config from
`/etc/nixos/configuration.nix` to your new `nixos` folder.

One other step will be to allow writes to your `/etc/nixos` dir by running
`sudo chmod o+w /etc/nixos`.

If you plan to use symlinks with Dotter, you will need to open up
`nixos/configuration.nix` and make the `hardware-configuration.nix` import
an absolute path instead of relative path.

Now it's finally time to run `dotter deploy`. This will do the important step
of taking our local dotfiles and copying to the dirs we specified.
