---
title: NixOS as a daily driver on a late 2011 Macbook Pro, part 3/? - user, WM, tools
date: '2025-06-05'
description: Setting up a non-root user with sudo access, installing Hyprland as a
  window manager, and configuring essential daily driver tools like Neovim, Git, and
  Librewolf on NixOS.
tags:
- nixos
- linux
---

#### Recap

See [Part 2](/blog/2025/nixos-daily-driver-2) where I cover installation and
basic configuration.

#### Outline

Things we will be covering in this post:
- adding a non-root user with sudo access
- installing a window manager - Hyprland
- installing some tools - neovim, git, waybar, wezterm

#### Install a Text Editor

First things first, let's install a better text editor to make our configuration
updating easier.

You will have to use `nano` for this. Open `/etc/nixos/configuration.nix`
and add the following:

```
programs.neovim = {
  enable = true;
  defaultEditor = true;
};
```

Use `ctrl+o` then `ctrl+x` to write and exit nano.

Then run `nixos-rebuild switch`. NixOS will rebuild your config and return you
to a terminal. You should now be able to start neovim by running `nvim`.

#### Adding a User

Now that we can edit files easier, let's add a non-root user.

```
users.users.disco = {
 isNormalUser = true;
 extraGroups = [
   "wheel"             # Allows sudo access
   "networkmanager"    # Allows controlling network
   "audio"             # Audio device access
   "video"             # Video devices (e.g. backlight, GPU)
   "input"             # For input devices like keyboard/mouse config
 ];
};
```

Again, save and exit and then rebuild:

`nixos-rebuild switch`

After successfully rebuilding, you will need to set a password for the new user.
For me that's:

`passwd disco`

Then you can `exit` and login as your new sudo accessible user.

#### Enable Network Tools

This will enable tools like `nmtui` to allow for easier network setup.

`networking.networkmanager.enable = true;`

#### Install a Window Manager and Daily Driver Tools

I am using [Hyprland](https://hyprland.org/). Hyprland is a dynamic Wayland
compositor that supports tiling, floating, and hybrid layouts.

Add the following to your `/etc/nixos/configuration.nix`. This enables Hyprland
along with XDG portals, which are required for features like file pickers,
screen sharing, and communication between sandboxed apps (especially Flatpaks
and browsers).

```
programs.hyprland.enable = true;
xdg.portal = {
  enable = true;
  wlr.enable = true;
  extraPortals = [ pkgs.xdg-desktop-portal-hyprland ];
};
```

Before rebuilding this time though, we will also install some daily driver tools.

One reason for this is that `Hyprland` uses the `kitty` terminal by default.

Look for this line in your `/etc/nixos/configuration.nix` file:

```
environment.systemPackages = with pkgs; [
```

You will likely find this commented out with `wget` listed as a package.

Expand on that section so it becomes:

```
environment.systemPackages = with pkgs; [
  kitty # needed by Hyprland by default
  wget
  hyprpaper # background utility for Hyprland
  hyprlock # screen lock utility for Hyprland
  librewolf # privacy focused browser based on firefox
  wofi # needed by Hyprland by default
  git
  waybar # status bar for Hyprland
  wezterm
];
```

Some tools like `neovim` and `hyprland` have official NixOS modules, which let you
enable them declaratively using `enable = true;`. Other tools (like `git` or
`librewolf`) don’t have modules and should be added directly to
`environment.systemPackages`.

Now it's time to rebuild. Again, this is done by:
`sudo nixos-rebuild switch`.

You can now manually start `Hyprland` by running:
`exec Hyprland`

You will be greeted with nothing but a random wallpaper supplied by Hyprland.

A couple important default keybinds are:
- SUPER + q - opens terminal
- SUPER + r - opens wofi app runner

#### Starting Hyprland on Login

Let's make `Hyprland` start on login. Create a `~/.bash_profile` file if it
doesn't exist and add this:

```
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec Hyprland
fi
```

#### Summary

In this post, we have:
- added a non-root user and set their password
- installed a window manager, `Hyprland`, and set it to start on login
- installed multiple important daily driver tools like git and librewolf

#### Next Time

In Part 4, we'll continue to configure `Hyprland`: adding keybindings,
wallpapers, waybar, and maybe even a lockscreen.
