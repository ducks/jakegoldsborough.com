+++
title = "Typing åäö in Hyprland: A US, Mac-style Keyboard Guide"
date = 2025-06-12
description = "Configuring Hyprland to type Swedish characters using a US keyboard layout with Right Alt as a modifier, perfect for learners who want proper typing practice without remapping keys."
[taxonomies]
tags = ["swedish", "keyboard"]
+++

### Intro

As I've mentioned in the previous GPT Changelog nee Weekly Summary, I have been
learning Swedish for over 6 months now. I'm getting pretty good at listening and
reading, but I have been doing very little speaking and typing practice. I would
like to change that by building muscle memory through proper Swedish typing.

### Enabling in Hyprland

Like many things in the Linux world, there is more than one way to do this. The
easiest way would just be to use the GUI menu and add the keyboard. I would
prefer to keep this declarative and inside some config files so it's more easily
reproducible.

Instead, I will add some config to Hyprland to enable this. This config will:
- enable the Swedish `kb_layout`
- add the US variant for the Swedish layout
- sets `rctrl` as the key that toggles between layouts
- sets `ralt` as the modifier key for Swedish keys
```
input {
  kb_layout = us,se
  kb_variant = ,us
  kb_options = grp:rctrl_toggle,lv3:ralt_switch
}
```

Save the config and reload the hypr config:
`hyprctl reload`

### What is the US variant?

Before testing it out, I should explain what the US variant is.

The **Swedish (US)** layout — sometimes referred to as "Swedish for US keyboards" —
is a variant of the traditional Swedish keyboard layout that’s specifically
designed for people using **US physical keyboards**. It allows you to type
Swedish characters like `å`, `ä`, and `ö` without rearranging the rest of your
familiar QWERTY key positions.

This layout keeps the standard **US punctuation and symbol positions intact** —
like `/`, `@`, `;`, and `"` — while introducing the necessary Swedish characters
via the **Right Alt key** (also called `AltGr` in XKB terminology).

Unlike the default **Swedish layout**, which assumes a physical keyboard with
keys labeled for Swedish (and repositions many punctuation marks), the
**Swedish (US)** layout overlays the Swedish characters on a standard US
keyboard. This makes it ideal for:

- Swedish learners or expats using American keyboards
- Developers or typists who need occasional access to `å`, `ä`, and `ö`
- Anyone who doesn’t want to remap common keys like `@`, `|`, or `/`

In practice, this means you keep your normal US key behavior, and just use
**Right Alt as a modifier** to access Swedish characters:

- `Right Alt + w` = å
- `Right Alt + '` = ä
- `Right Alt + ;` = ö

And uppercase versions with Shift.

If you’re used to US QWERTY and want to type Swedish without sacrificing
developer-friendly symbols, **Swedish (US)** is the best option available — and
it integrates smoothly into Linux environments like Hyprland when configured
correctly.

### 🇸🇪 Swedish (US) Layout – Character Cheat Sheet

<table class="swedish-keyboard-cheatsheet">
  <thead>
    <tr>
      <th>Character</th>
      <th>Key Combo</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>å</td>
      <td>Right Alt + <kbd>w</kbd></td>
      <td>Lowercase å</td>
    </tr>
    <tr>
      <td>Å</td>
      <td>Right Alt + <kbd>Shift</kbd> + <kbd>w</kbd></td>
      <td>Uppercase Å</td>
    </tr>
    <tr>
      <td>ä</td>
      <td>Right Alt + <kbd>'</kbd></td>
      <td>Apostrophe key</td>
    </tr>
    <tr>
      <td>Ä</td>
      <td>Right Alt + <kbd>Shift</kbd> + <kbd>'</kbd></td>
      <td>Shift + Apostrophe</td>
    </tr>
    <tr>
      <td>ö</td>
      <td>Right Alt + <kbd>;</kbd></td>
      <td>Semicolon key</td>
    </tr>
    <tr>
      <td>Ö</td>
      <td>Right Alt + <kbd>Shift</kbd> + <kbd>;</kbd></td>
      <td>Shift + Semicolon</td>
    </tr>
  </tbody>
</table>


### Conclusion

You should now have a working Hyprland config that will allow you to type
Swedish on a Mac-style, US variant keyboard.
