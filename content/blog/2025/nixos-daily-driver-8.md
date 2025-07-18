+++
title = "NixOS as a daily driver or Zero to Nixty, part 8/? - Modular Config"
date = 2025-07-17
[taxonomies]
tags = ["nixos", "linux"]
+++

Check out the whole series here:

[NixOS as a Daily Driver - Zero to Nixty](/tags/nixos)

### Intro

Today is all about configuration and setting up our new encrypted machine. As
I stated at the end of the previous post, this didn't go as smoothly as I was
hoping.

My plan was to just labels when setting up the filesystems so my same exact
configuration could be copied around. This plan was short sighted for a number
of reasons but it was definitely not going to work after seeing what the basic
configuration looked like after installing with encryption enabled. The LUKS
device setup looked much more complex than the normal, unencrypted filesystem
config.


