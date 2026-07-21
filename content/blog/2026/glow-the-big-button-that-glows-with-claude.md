---
title: "glow: I gave Claude a physical presence on my desk"
date: 2026-07-20
description: "I bought a keyboard that is one giant key, as a joke. Then I saw a keyboard whose light reacts to the AI, thought 'how hard can it be,' and now the big button glows with whatever Claude is doing. No firmware flash. Here's the protocol war story."
taxonomies:
  tags:
    - hardware
    - qmk
    - claude
    - tools
    - oss
---

I bought a [Keychron Q0 Mini](https://www.keychron.com/products/keychron-q0-mini-8k-action-key) as a joke.

It's a macropad, except it's basically one giant key. A single satisfying THUNK of a button. There is no reason to own it. I owned it anyway, because the idea of a big dumb button made me laugh and I wanted to see what I'd do with it.

Then I saw [Work Louder's Co-Lab](https://openai.com/) with OpenAI, where the keyboard's lighting reacts to what the AI is doing. And the button has RGB. And I thought the thought that has started every good project I've ever built:

*"Huh. How hard could that be."*

The result is [glow](https://github.com/ducks/glow). The big button now lights up with whatever Claude Code is doing. Purple when it's idle. Blue while it's working. Green when it's my turn. Orange when it needs me. I glance at it from across the room and I know Claude's state without looking at the screen.

<video autoplay loop muted playsinline width="100%">
  <source src="/images/2026/glow/button-demo.mp4" type="video/mp4">
</video>

Here's how I got there, including the hour I lost to setting the wrong byte.

## First, the button did nothing

Out of the box, the key emits nothing. I pressed it under `wev` (the Wayland event viewer) and got a blank line. Not an error - a registered key event with no keysym attached. The switch works, it's just mapped to a dead keycode.

Fixing that is the easy half. Keychron boards run [QMK](https://qmk.fm/) with [VIA](https://www.caniusevia.com/) support, so I opened the Keychron Launcher (their VIA build), remapped the key to F13, and pressed it again. F13 is a real keycode that no physical keyboard has a key for, which makes it a clean "this press means *my button*" signal.

Except `wev` didn't show F13. It showed this:

```
key: 191; state: 1 (pressed)
sym: XF86Tools    (269025153)
```

On this Wayland stack, F13 comes through as `XF86Tools`. The F13-F24 range gets mapped to XF86 multimedia symbols by the keymap. This is exactly the kind of thing you only learn by reading the actual output instead of assuming, so: read the actual output. The Hyprland bind became:

```
bind = , XF86Tools, exec, ~/.config/hypr/scripts/big-button
```

Press button, script runs. Input half done. Now the light.

## The RGB is where it got interesting

The dream was host control: my computer decides the color, the keyboard obeys. The question was whether that's possible without flashing custom firmware.

QMK's VIA feature exposes a **raw-HID interface** - a vendor-defined USB HID endpoint that the VIA app uses to configure the board live. If VIA can set the RGB (and it can - there's a lighting tab), then the protocol to set RGB exists, and I can speak it myself.

The board shows up as four HID interfaces. The VIA one is identifiable by its USB usage page, `0xFF60`. I dumped each interface's report descriptor:

```
hidraw11:  05 01 09 06 ...   # keyboard
hidraw12:  06 60 ff 09 61 ...  # <- 0xFF60, the VIA raw interface
hidraw13:  05 01 09 02 ...   # mouse/media
hidraw14:  06 31 ff ...       # Keychron's own vendor page
```

`hidraw12` it is. Now I just had to send it the right bytes.

## The hour I lost

The VIA protocol for RGB is documented in QMK's source. Commands look like:

```
report = [0x00, command, channel, value_id, ...args]   # padded to 33 bytes
```

I wanted: set the effect to solid color, set brightness, set the color. I wrote it, ran it, and watched the button.

It changed color. And then kept changing. A slow fade through the whole rainbow, forever.

So the commands were landing - the keyboard was clearly listening - but the animation never stopped. I assumed I had the wrong *effect* number. QMK has dozens of RGB effects; "solid color" is one of them, and I was setting it to some cycling effect by mistake. I wrote a probe that stepped through effect IDs 0 through 7, setting each one and pausing so I could watch.

Every single one animated. Every one.

That's the tell I should have caught sooner: if *no* effect ID produces a solid color, the problem isn't the effect ID. I was writing to the wrong field entirely. I went and read the actual constants in [`qmk/via.h`](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.h):

```
id_qmk_rgb_matrix_brightness    = 1
id_qmk_rgb_matrix_effect        = 2
id_qmk_rgb_matrix_effect_speed  = 3
id_qmk_rgb_matrix_color         = 4
```

I'd been sending the effect to value-id **3**. Value-id 3 is effect *speed*. I was never setting the effect at all - I was setting the *speed* of whatever animation was already running, and then changing its color. The rainbow cycled the whole time because I never told it to stop cycling.

The effect id is **2**. One byte. I changed the 3 to a 2:

```
effect->solid: sent [7, 3, 2, 1]
color->purple: sent [7, 3, 4, 192, 255]
```

Solid purple. Frozen. Locked. The button held a single steady color for the first time.

The lesson is the same one that gets me every time: when the story you've built ("wrong effect number") stops explaining the evidence ("*every* effect animates"), the story is wrong, not the evidence. Read the source constants instead of guessing enum positions by trial. It would have taken five minutes at the start and cost me an hour instead.

## Wiring it to Claude

Once I could set any color from a shell command, the status lamp was almost trivial, because Claude Code has [hooks](https://docs.claude.com/en/docs/claude-code) - shell commands that fire on lifecycle events. The events map almost perfectly onto the states I wanted:

| event              | color   | meaning          |
|--------------------|---------|------------------|
| `SessionStart`     | purple  | idle / ready     |
| `UserPromptSubmit` | blue    | working          |
| `Stop`             | green   | your turn        |
| `Notification`     | orange  | needs your input |

Four lines in `settings.json`, each running `glow-hook <color>`. The hook runs the color-setter backgrounded and swallows all errors, so an unplugged keyboard never breaks a Claude session.

I added them expecting to restart Claude to pick them up. I didn't have to. The moment I sent my next message, the button went blue. When the turn ended, green. It was reacting to the conversation I was having *while* wiring it. That was the moment it stopped being a project and started being a thing on my desk that's alive.

## One real design note

My first palette had working as yellow and needs-you as orange. In practice you can't tell them apart across a room - they're both warm, and "warm" is all your peripheral vision gets. I moved working to blue. Blue / orange / green are three genuinely distinct colors; the light is legible from anywhere now.

There is no red in the palette. That's a personal decree. I hate red. Orange carries the "needs you" weight instead, and honestly it's nicer.

## It's not really about Claude

glow is a generic tool. It drives any VIA/QMK keyboard's RGB from the host - point it at your board with a VID/PID, get a `glow <color>` command. The Claude status lamp is one use of it. Anything that can run a command can drive the light: a CI run going green, a long build finishing, a deploy, a pomodoro timer. The keyboard becomes an ambient status display for whatever you care about.

No firmware flash, no VIA app open, no daemon. It talks to the raw-HID interface directly and sends the same bytes VIA would.

## The joke was the point

I want to be clear that I did not buy a giant button because I had a plan for it. I bought it because it was funny. The plan showed up later, the way plans do when you leave yourself a weird enough object to poke at.

That's most of my favorite projects. Not "the market needs an ambient AI status indicator." Just "I have this dumb button, and this light, and a free evening, and how hard could it be." Hard enough to be fun. Easy enough to finish. And now there's a purple glow on my desk that turns blue when I ask a question, and I grin every time.

---

Source: [github.com/ducks/glow](https://github.com/ducks/glow)
