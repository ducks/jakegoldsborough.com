---
title: "glow, part two: the whole desk lights up now (and it works across three agents)"
date: 2026-07-24
description: "glow now lights my Framework laptop keyboard alongside the big button, from any of three agents. Last time the protocol was the war and permissions were free; this time the protocol was free and permissions were the war."
taxonomies:
  tags:
    - hardware
    - qmk
    - linux
    - claude
    - tools
    - oss
extra:
  series: "Glow"
---

When I wrote about [glow](https://github.com/ducks/glow) - the tool that turns my one-giant-key macropad into a Claude status lamp - I ended on a throwaway line: *it drives any VIA/QMK keyboard, point it at a VID/PID.* I meant it as a "this generalizes" flourish. Then I looked down at the keyboard I actually type on all day, a Framework Laptop 16 with an RGB keyboard module, and thought the thought again.

*Huh. How hard could that be.*

The answer this time was funny, because it inverted the first project exactly. Last time the protocol was the war and permissions were free. This time the protocol was free and **permissions were the war.**

## The protocol was already done

The Framework Laptop 16 keyboard module runs a QMK fork. QMK means VIA, and VIA means the same raw-HID interface - usage page `0xFF60` - that glow already speaks to the Keychron. So there was, delightfully, nothing to build. I enumerated the keyboard and there it was:

```
usage_page=0x0001  iface 0   # keyboard
usage_page=0xff60  iface 1   # <- the VIA raw interface, same as the Q0
usage_page=0x000c  iface 2   # consumer/media
usage_page=0xff31  iface 3   # vendor
```

Interface 1, usage page `0xFF60`. The exact thing glow looks for. I pointed glow at the Framework's VID:PID (`32ac:0012`) and ran it under `sudo`, and the keyboard went green. First try. The whole "does host RGB control even work" question that ate the first afternoon was already answered - I'd answered it for a different keyboard, and the protocol carried over for free.

That should have been the end of it. It was the beginning of the actual problem.

## Why sudo, though

I ran it under `sudo` because without `sudo` it failed:

```
hid.HIDException: unable to open device
```

That's a permissions error. The keyboard's `/dev/hidraw*` node is owned `root:root`, and my user can't open it. This is worth pausing on, because the Keychron *never* had this problem - and the reason it didn't is the whole story.

When I checked, the Keychron's node was `root:input` - owned by root, but group-readable by `input`, and I'm in the `input` group. The Framework's node was `root:root` - no group access at all. Same class of device, different default permissions, and I'd simply never noticed because the Keychron happened to land in a group I was already in.

The fix is a udev rule: match the keyboard, set its group to `input`. On NixOS that's declarative, which is normally a joy and was, this time, a small trap I set for myself. Into my config:

```nix
services.udev.extraRules = ''
  KERNEL=="hidraw*", ATTRS{idVendor}=="32ac", ATTRS{idProduct}=="0012", MODE="0660", GROUP="input"
'';
```

`nixos-rebuild switch`. Rule installed. And the node was still `root:root`.

## A rule that matches but doesn't apply

Here's the first thing that cost me time, and it's a genuinely confusing property of udev: **a rule can be correct, be installed, be matched by the device - and still not change the permissions on a device that already exists.**

udev sets permissions when a device is *added*. The rule fires on the `add` event, at enumeration. My keyboard was enumerated at boot, before the rule existed. Rebuilding installed the rule for next time, but nothing re-ran the `add` event for the already-present keyboard.

Normally you'd just unplug and replug the device to re-trigger enumeration. But this is a **built-in laptop keyboard.** There is no cable. I'm not opening the chassis to reseat a ribbon connector to change a file's group.

So: retrigger it in software. This is where I went in a circle. The obvious command:

```
sudo udevadm control --reload
sudo udevadm trigger --attr-match=idVendor=32ac
```

Reload the rules, trigger the device matching my keyboard's vendor. Ran it. Checked the node. Still `root:root`.

I could even prove the rule was *right* - `udevadm test` on the device showed udev computing `GROUP=input` for it. The rule matched. The group was calculated. The node on disk didn't change. That gap - "udev agrees the group should be `input`, the file says `root`" - is a deeply annoying place to stand.

The problem was the trigger, not the rule. `--attr-match=idVendor=32ac` matches the *USB device*, and triggering the USB device re-runs its rules - but the thing I care about is a *child* `hidraw` node hanging off it, and a bare trigger fired a `change` event, not the `add` that actually (re)applies `GROUP` and `MODE`. The incantation that works targets the hidraw node directly and forces an add:

```
sudo udevadm trigger --action=add /sys/class/hidraw/hidraw5
```

Node flipped to `root:input`. Finally.

## Four nodes, and only one is the one

I ran glow again, unprivileged, feeling good. It failed. Same permissions error.

The keyboard exposes **four** hidraw nodes - `hidraw5` through `hidraw8`, one per HID interface. I'd triggered `hidraw5` and flipped its group. But glow doesn't open just any node; it opens the one carrying the VIA interface, usage page `0xFF60`. And that wasn't `hidraw5`. Mapping them out:

```
/dev/hidraw5  usage_page 0x0001   # keyboard
/dev/hidraw6  usage_page 0xff60   # <- the one glow opens
/dev/hidraw7  usage_page 0x000c   # consumer
/dev/hidraw8  usage_page 0xff31   # vendor
```

The VIA interface was `hidraw6`. I'd spent my `add`-trigger on `hidraw5`, watched it flip, declared victory, and glow was over on `hidraw6` still staring at a `root:root` node. Same trigger, right node:

```
sudo udevadm trigger --action=add /sys/class/hidraw/hidraw6
```

`hidraw6` went `root:input`. glow ran with no `sudo`. The Framework keyboard went purple.

And - this is the part that makes the manual flailing worth it - **none of that dance is needed again.** The whole `udevadm trigger` sequence was only to fix devices that were already enumerated before the rule existed. On the next boot, the rule is present when the keyboard enumerates, so it applies to all four nodes at `add` time, cleanly, with no intervention. The one-time cost of "I couldn't replug a built-in keyboard" is exactly one time.

## Making glow actually drive both

With permissions solved, the feature itself was small - which is how it should be when the hard part was somewhere unglamorous. glow now takes a `GLOW_BOARDS` list of `vid:pid` pairs and drives every one in a single pass:

```sh
# the default is now both of my boards
glow purple      # Q0 and Framework keyboard, together

# or target your own
GLOW_BOARDS="3434:040b" glow green
```

A board that isn't plugged in is skipped rather than failing the rest, so an undocked laptop or an unplugged macropad just quietly does nothing. The Claude Code hooks didn't change at all - they call `glow-hook <color>`, which calls `glow`, which now fans out to every board. I wired nothing new. I submitted a prompt and both keyboards went blue at once.

That's the moment this stopped being "the button" and became "the desk." I glance up and the whole surface in front of me is the same color, reporting the same thing: purple idle, blue working, green my turn, orange needs me. It's louder in the good way. Ambient status you can't miss.

<video autoplay loop muted playsinline width="100%">
  <source src="/images/2026/glow/desk-demo.mp4" type="video/mp4">
</video>

## Not tied to one keyboard, or one agent

Decoupling glow from a single board made me notice it was never really tied to a single *agent* either. The whole integration is four lines that run `glow-hook <color>` on lifecycle events. Anything with lifecycle events can drive it.

Claude Code was first because it has hooks. But I don't only use Claude Code, and the other two agents I live in turned out to reach the same four states.

[claux](https://github.com/ducks/claux) is my own agent harness - the one I built because I want an agent I can open up and change. It already had a plugin-hook system (run a command on session-start, tool-start, and so on), but it was missing exactly the two events that bracket your attention: the turn ending, and the agent stopping to ask permission. So I added them - `on_turn_end` and `on_permission_request` - as generic triggers. Nothing about glow lives in claux's code; the status lamp is entirely config, four `[[plugins]]` blocks pointing at `glow-hook`. That's the whole point of a hackable harness: the event you need is a small patch away, and the thing consuming it stays yours.

Codex was the surprise. I remembered it having a `notify` option that fires once, when a turn completes - which would get you exactly one of the four colors. But recent Codex grew a full Claude-Code-style hooks system: a `hooks.json` with `SessionStart`, `PreToolUse`, `Stop`, and - the good one - a dedicated `PermissionRequest` event. On Claude Code, "needs you" and "just your turn" both arrive as one generic `Notification`, and I had to pattern-match the message text to tell a real permission prompt from an idle ping (I got that filter wrong at first, and the light stuck orange when it shouldn't have). Codex hands you `PermissionRequest` as its own event. The bug I'd fought simply can't happen there; the event *is* the distinction.

So the same `glow-hook` script, unchanged, now lights the same keyboards from three different agents. Purple/blue/green/orange means the same thing whether I'm in Claude Code, claux, or Codex. The status signal outlived any one tool - which, when I think about why I liked the idea in the first place, is exactly right. It was never "an ambient indicator for Claude." It's an ambient indicator for *whatever is working*, and the agent is just this week's whatever.

## The pattern, again

The shape of this project is one I keep re-learning: **the thing you expect to be hard is done, and the hour goes somewhere you didn't budget for.** Last time I braced for "can I even control RGB from the host" and it worked quickly, then I lost an hour to a single wrong byte. This time I braced for the protocol and it was free, then I lost an hour to udev not re-applying a group to a node I couldn't replug.

Both times the fix was small and the lesson was the same as it ever is: when the state on disk disagrees with the state in your head - the group should be `input`, the file says `root` - believe the disk and go find the gap. It's never where the confidence is.

The whole desk glows now. I asked this very keyboard a question to write this sentence, and it turned blue under my hands while I typed it.

---

Source: [github.com/ducks/glow](https://github.com/ducks/glow)
