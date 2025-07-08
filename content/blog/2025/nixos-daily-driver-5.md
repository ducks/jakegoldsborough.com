+++
title = "NixOS as a daily driver or Zero to Nixty, part 5/? - QoL enhancements"
date = 2025-07-07
[taxonomies]
tags = ["nixos", "linux"]
+++

### Recap

In the last post, we successfully got our configuration stored in version control.
This will make it very simple to pass our config around if needed. We also
learned about Dotter, a dotfile configuration management tool, which we will
be using again today.

See that post [here](/blog/content/nixos-daily-driver-4)

### Intro

Today, we will be covering a few quality of life enhancements. Those will 
include keyboard remapping and locking our screen after a certain amount of 
idle time.

Quality of life enhancements are things that while not strictly necessary,
they make life much better.

### Keyboard Remapping

First, I'll show you how to remap keys. For me personally, this will include:
- Caps Lock -> Esc when pressed
- Caps Lock -> Control when held (and another key is pressed)

Caps Lock as Control when being held is a new change for me but I'm really 
enjoying it. It has opened up many more keybind options for me.

This remapping will be done using "Interception Tools"

#### Interception Tools

[Interception Tools](https://wiki.archlinux.org/title/Interception-tools) is a
set of utilities to control and customize the behavior of keyboard input
mappings.

It works at a lower level than tools like `xcape` or `xmodmap` which makes it
one of the only options available for customizing keyboard behavior across
X11, Wayland, and the Linux console.

Below is an example of mine. It's stored in
`~/dotfiles/nixos/modules/interception-caps.nix`.

This config:
- enables the `services.interception-tools` module
- adds a plugin called caps2esc
- adds a `udevmonConfig` file

```
{ config, pkgs, ...}:

let
  intercept = "${pkgs.interception-tools}/bin/intercept";
  uinput = "${pkgs.interception-tools}/bin/uinput";
in {
  services.interception-tools = {
    enable = true;
    plugins = with pkgs; [
      interception-tools-plugins.caps2esc
    ];
    udevmonConfig = ''
      - JOB: "${intercept} -g $DEVNODE |
              ${pkgs.interception-tools-plugins.caps2esc}/bin/caps2esc -m 1 |
              ${uinput} -d $DEVNODE"
        DEVICE:
          EVENTS:
            EV_KEY: [KEY_CAPSLOCK, KEY_ESC]
    '';
  };
}
```

Let's breakdown what's happening here.

- `JOB` defines a processing pipeline for input events. Each matching device runs
  this chain of commands.

- `${intercept} -g $DEVNODE` reads events from the input device
  - `intercept` is the main input capture tool
  - `-g` ensures the device stays grabbed

- `caps2esc -m 1` is what actually transform the Caps Lock input into our dual
  behavior
  - Tap/Press = Escape
  - Hold = Control
  - Note - Control is only emitted if another key is pressed. holding Caps Lock
  will not simply emit Control

- `${input} -d $DEVNODE` writes the transformed input back into the system using
  `uinput` kernel device

- `DEVICE` block filters which devices this pipelines applies to.
  - `EV_KEY: [KEY_CAPSLOCK, KEY_ESC]` means this only runs for devices that emit
  Caps Locks or Escape key events

In short, this config captures raw key events for Caps Lock and Escape,
transforms them using the caps2esc plugin, and injects the new behavior back
into the system -- all at a low level that works across Wayland, X11, and even
TTYs.

The above is stored in a separate NixOS module and then imported in my main
configuration:

```
imports =
  [ # Include the results of the hardware scan.
    /etc/nixos/hardware-configuration.nix
    /etc/nixos/modules/interception-caps.nix
  ];
```

### Idle and Lock

Next, we will set our machine up to first lock, then power the screen down after
a certain amount of idle time.

This is done using Hyprland companion packages, `hyprlock` and `hypridle`.

You can install those by adding them to your package list:

```
environment.systemPackages = with pkgs; [
  hypridle
  hyprlock
];
```

#### Hyperidle

Save this config as:
`~/dotfiles/hypr/hypridle.conf`

Here is my current setup:

```
general {
    lock_cmd = hyprlock
    before_sleep_cmd = hyprlock
    after_sleep_cmd = hyprctl dispatch dpms on
}

listener {
    timeout = 300
    on-timeout = hyprlock
}

listener {
    timeout = 330
    on-timeout = hyprctl dispatch dpms off
    on-resume = hyprctl dispatch dpms on
}

```

This is telling `hypridle` to run `hyprlock` as the lock_cmd and right before sleep.
Then after we wake, use hyprctl to turn the monitor back on.

Then we set up a few simple listeners. The first one is for 300 seconds (5
minutes) and simply runs `hyprlock` on-timeout. Then, I have another for 330
seconds (5 minutes 30 seconds) that will shut my monitor off on-timeout, and turn
it back on after resuming.

Reload hypr conf with `hyprctl reload` and you should now have a functioning
idle and lock screen.

#### Hyperlock

Note: Hyprlock does not automatically create a config, and without one,
`hyprlock` will not render anything, meaning you will just see your screen, but
it will be locked -- you will not be able to interact with it again until you
enter your password and hit Enter.

We are also able to customize our lock screen some. This config will also
live in the same directory as the other hyprland config files.
`~/dotfiles/hypr/hyprlock.conf`

Below is an example of mine. It looks similar to css styling but not exactly.

Here, I'm setting up a simple background color, an input field with a border,
and a label that just outputs the time. I like to keep mine simple but you can
add a background image, move the input box around, and do a lot more than I am.

You can find more in the docs
[here](https://wiki.hypr.land/Hypr-Ecosystem/hyprlock/). It covers all the
available elements you can use to style your Hyprlock screen.

```
background {
    color = rgb(282828)  # Gruvbox dark background
    blur_passes = 0
}

input-field {
    font_color = rgb(ebdbb2)
    inner_color = rgb(282828) # Slightly lighter than background
    outer_color = rgb(928374)
    outline_thickness = 3
    size = 500, 50
    position = 0, -33%
}

label {
    text = cmd[update:1000] echo "<b><big> $(date +"%H:%M:%S") </big></b>"
    color = rgb(ebdbb2)
    font_size = 32
    position = 0, 0
    valign = center
    halign = center
}
```

After adding both files, remember to run `dotter deploy`. This will add symlinks
for our newly added files to our correct Hyprland config directory by default
based on our Dotter config.

#### Fun Fact

This post was written from NixOS!

### Summary

In this post, we have:

- Configured some muscle memory engraved key remappings including:
  - Caps Lock -> Esc when pressed
  - Caps Lock -> Control when held (and another key is pressed)
- Setup `hypridle` to lock out computer after 5 minutes then turn the screen off
  30 seconds after that.
- Styled a simple `hyprlock` screen that shows the time and an input box for our
  password

### Next Time

Next time will be all about development work. We will introduce Nixvim and
`nix shell`. Nix shells are development environments you can set up via config.
They are very powerful and make developing on NixOS much easier.
