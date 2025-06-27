+++
title = "NixOS as a daily driver or Zero to Nixty, part 4/? - dotfile/config management"
date = 2025-06-27
[taxonomies]
tags = ["nixos", "linux"]
+++

### From TTY to Tiling

In the last post, we enabled Hyprland and set it to run by default on login.

In this post, we will be taking a slight detour and will be going over how to
manage your NixOS config in version control. This step might be overkill for
some but it makes it so we can easily checkout our config on any machine and
have a working NixOS install fairly quickly.

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
  - This file is not committed to git because local lets you switch configs
  per machine without affecting version control

Add a `.gitignore` if not already present.
Add a new line:
`.dotter/local.toml`

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

One important configuration option to mention for Dotter is the
`default_target_type`. Because of the template functionality of Dotter,
it can either physically copy your config, or simply create a symlink.

I prefer symlinks by default so I use this config option. In `global.toml`, I
set the following:

```
[settings]
default_target_type = 'symbolic'
```

More info about that can be found in the [Dotter wiki](https://github.com/SuperCuber/dotter/wiki/5.-Built%E2%80%90ins,-Helpers,-and-Settings#settings).

If you plan to use symlinks with Dotter, you will need to open up
`nixos/configuration.nix` and make the `hardware-configuration.nix` import
an absolute path instead of relative path.

Example:

```
# nixos/configuration.nix
{ config, pkgs, ... }:

{
  imports =
    [ /etc/nixos/hardware-configuration.nix ];
}
```

Now it's finally time to run `dotter deploy`. This will do the important step
of taking our local dotfiles and copying (or symlinking) to the dirs we
specified. After running that command, you will see
`/etc/nixos/configuration.nix` is present again.

The moment of truth, time to rebuild. You can start by doing a dry run
`sudo nixos-rebuild dry-activate`. This will build the system and tell you what
would happen. If that goes well, run `sudo nixos-rebuild switch`. NixOS gives a lot
of protection around broken config so it's unlikely anything should break here
and if it does, there will be an error that tells you why.

Commit your configuration file and merge your branch back to `main`.

### Adding Hyprland Config to Dotfiles Repo

We are now going to do the same with our `Hyprland` config. The steps are pretty
much the same minus some `chmod` and file path updates.

First, create a new branch and check it out. Then we create a new directory that
I simply called `hypr`. Next, copy the current `Hyprland` config from
`~/.config/hypr` into this new dir.

Now we will need to add a little Dotter config:
```
[hypr.files]
hypr = '~/.config/hypr'
```

Again, in Dotter talk, we are creating a `hypr` module. Then we tell Dotter that
any files in our local `hypr` dir need to be copied to `~/.config/hypr`.

Now it's time to run `dotter deploy`. This will do the step of copying our
local config to the correct path in `~/.config`.

Confirm that file got copied and then run `hyprctl reload` to reload the `hypr`
config.

### Congrats On Version Controlled Config

Your dotfile repo should now look something like this:

```
dotfiles/
├── .dotter/
│   ├── global.toml
│   └── local.toml
├── hypr/
│   └── hyprland.conf
└── nixos/
    └── configuration.nix
```

We have now added two sets of our config into version control. This will allow
us to easily pass around our config to a new machine if needed, especially with
NixOS and it's declarative config.

### Next Time

In the next post, I plan to get back to actually setting up NixOS for daily driver
use. This will probably include some `hypr` config and introducing Nixvim. Nixvim
is a way to manage your neovim plugins in a NixOS-y way.
