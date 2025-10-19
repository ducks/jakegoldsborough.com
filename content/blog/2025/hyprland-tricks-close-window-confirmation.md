---
title: Hyprland Tricks - Close Window Keybind With Confirmation Window
date: '2025-07-28'
description: Adding a simple Wofi confirmation dialog to Hyprland's window close keybind
  to prevent accidentally closing important windows with a quick Yes/No prompt.
taxonomies:
  tags:
    - hyprland
---

By default, `hyprctl dispatch killactive` will instantly close your focused
window. If you're like me and have ever yanked a terminal or browser window
when you weren't ready, this tiny script adds a "Yes/No" confirmation window
using Wofi.

### Create the Script

For me, I will be adding this to `~/dotfiles/hypr/scripts/hypr-confirm-close`.

```
#!/usr/bin/env bash
# prompt "Close window?" with Yes/No via wofi
choice=$(printf "Yes\nNo" \
  | wofi --dmenu --prompt="Close window?" --lines=5)
[ "$choice" = "Yes" ] && hyprctl dispatch killactive
```

Remember to make it executable.
`chmod +x ~/dotfiles/hypr/scripts/hypr-confirm-close`

### Bind the Key

In your `hyprland.conf`:

```
bind = $mod, q, exec, bash, ~/.config/hypr/scripts/hypr-confirm-close
```

The filepath is different here because it will get copied from our `~/dotfiles`
dir to the normal `~/.config` directory.

Reload:

`hyprctl reload`

### Summary

Now `MOD+q` pops up a two-line menu and only when you select "Yes" will your
window be closed.
