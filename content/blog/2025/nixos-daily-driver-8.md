---
title: NixOS as a daily driver or Zero to Nixty, part 8/? - Modular Config
date: '2025-07-20'
description: Breaking down a NixOS configuration into reusable modules organized by
  host and common settings, making it easy to deploy consistent environments across
  multiple machines.
tags:
- nixos
- linux
---

Check out the whole series here:

[NixOS as a Daily Driver - Zero to Nixty](/tags/nixos)

### Intro

Today is all about configuration and setting up our new encrypted machine. As
I stated at the end of the previous post, this didn't go as smoothly as I was
hoping.

My plan was to just use labels when setting up the filesystems so my same exact
configuration could be copied around. This plan was short-sighted for a number
of reasons but it was definitely not going to work after seeing what the basic
configuration looked like after installing with encryption enabled. The LUKS
device setup is more complex than the normal, unencrypted filesystem
config. There may be a way to use labels here but I don't really want to mess
with that right now. I have an encrypted machine that boots so I'm going to
leave it that way.

### Breaking Config Into Modules

After some thinking and research, I decided to refactor the way I store the
config. I had been wanting to modularize it a bit anyway, so what better time
than now.

First, I broke my config up into some modules in a `common` directory.

```
nixos/
├── common
│   ├── base.nix
│   ├── desktop.nix
│   ├── packages.nix
│   ├── services.nix
│   ├── uefi.nix
│   └── users.nix
```

Then, I created a `hosts` directory that includes a file for each machine.
That file imports these basic modules and adds anything host specific like
hostname.

```
nixos/
├── hosts
│   ├── framework-personal.nix
│   ├── framework-work.nix
│   └── macbook.nix
```

One of those files looks like this:

```
{ ... }:

{
  imports = [
    ../common/base.nix
    ../common/users.nix
    ../common/desktop.nix
    ../common/packages.nix
    ../common/services.nix
  ];

  networking.hostName = "macbook";
}
```

Then I just update the `/etc/nixos/configuration.nix` that was created for
me and import that one module. One of those files looks like this:

```
{ config, pkgs, ... }:

{
  imports = [
    ./hardware-configuration.nix
    ./hosts/macbook.nix
  ];

  # Replace actual UUID below
  boot.initrd.luks.devices."$UUID".device = "/dev/disk/by-uuid/$UUID";

  # Do not change this value unless you know what you are doing!
  # This value does *not* affect the Nixpkgs version. It is used to determine
  # whether to enable software and configuration options that require backwards
  # compatibility with older NixOS releases. Changing it may result in a system
  # that cannot be upgraded or has other surprising consequences.
  system.stateVersion = "25.05";
}
```

### Complete New Machine Flow

Now, my new machine flow looks something like this:

1. Install NixOS
2. Boot up and open a dev shell:

   `nix-shell -p git rustup neovim`

   (We use git to check out config, rustup to install rust/dotter, and neovim
   for easier editing.)
3. Check out my dotfiles through https for now. This way I don't need to create
   an SSH key and add it to Github yet:

   `git clone https://github.com/ducks/dotfiles.git`
4. Install latest Rust then dotter:

   `rustup install stable; cargo install dotter`
5. Checkout a new branch in my dotfiles dir and add a new host file
6. Add a new local config for Dotter at

   `dotfiles/.dotter/local.toml`
7. Use the installed Dotter to deploy my dotfiles:

   `~/.cargo/bin/dotter deploy`

8. Rebuild NixOS:

   `sudo nixos-rebuild switch`

9. Start Hypr:

   `Hyprland`

10. Celebrate! :tada:

If everything went well, I am now sitting behind a duplicate of my other machines.
This workflow might seem long but it really only takes 10-30 mins to do all
this. It can obviously vary on your machine and build size. It's far easier than
any other new machine flow I've tried. I've read about people using ansible
to do this kind of thing but this just feels so clean and easy once you get
around the rough edges.

I have executed this flow on 3 machines now and it's worked well. I had to make
a few small changes like adding a `ref` to a branch for NixVim, and I'm
honestly not sure why that is. I don't think it has anything to do with my
config as it was building before.

### Summary

In this post, I showed how I broke my NixOS config down into modules so they can
be easily imported per host. I think this is a clean and reproducible way
to store and share my NixOS config. I have all my base config in easy to use
modules, then I can simply add any host specific setup to that single file.

### Next Time

At this point, things are feeling pretty good for my setup personally. I keep
things pretty minimal so as long as I can navigate around with the correct
keybinds and have basic tools like Nix/Neovim and Librewolf installed and
setup, I'm mostly good to go. There are definitely some non-NixOS specific
things I could pivot to to stick with the "Daily Driver" theme.

If you're reading this and have suggestions or you're curious about something,
let me know: [nixos@jakegoldsborough.com](mailto:nixos@jakegoldsborough.com)
