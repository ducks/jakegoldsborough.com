---
title: "mini_racer on NixOS: Three Things That Were Wrong"
date: 2026-06-25
description: "mini_racer 0.21.4 wouldn't build in my nix-shell. The fix turned out to be counterintuitive: removing glibc from buildInputs made stdlib.h work again. Plus a BUNDLE_GEMFILE footgun hiding in plain sight."
taxonomies:
  tags:
    - nixos
    - ruby
    - discourse
    - debugging
---

I run Discourse's dev environment through a `nix-shell`. It's been mostly great.
Then `mini_racer` 0.21.4 dropped and `bundle install` started dying with:

```
fatal error: stdlib.h: No such file or directory
```

`stdlib.h` is the most standard header in C. Not finding it felt wrong. It took
three separate root causes to get back to a working shell.

## What mini_racer is

[mini_racer](https://github.com/rubyjs/mini_racer) is a Ruby gem that embeds
V8. Discourse uses it to run markdown-it - the same JavaScript markdown parser
the browser uses - inside the Rails process. When a post gets "cooked"
server-side, it goes through the exact same parser as the client, so the output
is identical on both ends.

The alternative would be spawning a Node subprocess per cook, which is
expensive. mini_racer keeps a V8 context alive inside the Rails process - no
subprocess, no IPC, just a function call into a JS heap.

It's a native extension, so it compiles C++ during `bundle install`. The 0.21.4
release switched to `libv8-node`, which vendors a much larger V8 than the
previous `libv8` gem. Bigger C++ dependency tree, more opportunities for NixOS
to be annoying.

## Root cause 1: glibc in buildInputs

My `discourse-app.nix` had this in `buildInputs`:

```nix
buildInputs = with pkgs; [
  # ...
  glibc
  glibc.dev
  # ...
];
```

I'd added these at some point to fix an unrelated header complaint. They were
wrong then and stayed wrong.

Here's the issue. NixOS's gcc wrapper automatically injects `-isystem` flags
for the glibc headers it was built against. When you add `glibc.dev` to
`buildInputs` yourself, Nix injects *another* `-isystem` for it. Now the
compiler sees the headers twice, at two different paths, in two positions in the
include search order.

The specific failure happens in C++ stdlib headers. When `<cstdlib>` includes
`<stdlib.h>`, it uses `#include_next` - meaning "find the next `stdlib.h` in
the search path, not this one." With a duplicated glibc in the search path, the
`#include_next` chain breaks. The compiler finds the wrapper's entry, skips it,
and walks off the end of the include dirs without finding the real file.

The fix: remove `glibc` and `glibc.dev` from `buildInputs`. The wrapper already
handles them.

After that, `bundle install` got further. But not all the way.

## Root cause 2: stale bundle config

With glibc removed from `buildInputs`, I had a leftover problem: I'd previously
tried to fix the build by passing glibc include paths directly to the gem's
Makefile via `bundle config`:

```
BUNDLE_BUILD__MINI_RACER: "--with-cxxflags=-isystem/nix/store/...-glibc-.../include ..."
```

That flag was still baked into `.bundle/config` in the Discourse repo. Even
with the nix-shell fixed, `bundle install` was picking up those old paths and
handing them to extconf.

Clear it inside the nix-shell:

```bash
bundle config unset build.mini_racer
```

After that, the Makefile no longer had any glibc `-isystem` in `CPPFLAGS`. But
the build still failed.

## Root cause 3: BUNDLE_GEMFILE baked at shellHook time

My `shellHook` had:

```nix
shellHook = ''
  export BUNDLE_GEMFILE=$PWD/Gemfile
  # ...
'';
```

This looks fine until you realize `$PWD` in a shellHook is the directory you
launched `nix-shell` from, not the directory you later `cd` into inside the
shell. I was launching nix-shell from `/home/ducks/dev` and then running:

```bash
nix-shell /path/to/discourse-app.nix --run 'cd /home/ducks/discourse/discourse && bundle install'
```

`BUNDLE_GEMFILE` was locked to `/home/ducks/dev/Gemfile`, which doesn't exist.
Bundler hit `Errno::ENOENT` before even trying to compile anything.

The fix: remove the `BUNDLE_GEMFILE` export entirely. Bundler walks up the
directory tree to find `Gemfile` automatically. There's no reason to set it
manually unless you're doing something exotic.

## What the working nix-shell has

```nix
buildInputs = with pkgs; [
  # ... (no glibc, no glibc.dev)
  nodejs.libv8    # V8 headers
  icu             # ICU headers V8 needs
  stdenv.cc       # the NixOS gcc wrapper
  # ...
];

shellHook = ''
  export CC="${pkgs.stdenv.cc}/bin/gcc"
  export CXX="${pkgs.stdenv.cc}/bin/g++"

  # No BUNDLE_GEMFILE here
  export BUNDLE_PATH=$PWD/.bundle
  export BUNDLE_BIN=$PWD/.bundle/bin
  # ...
'';
```

Setting `CC` and `CXX` explicitly to the wrapper binaries is the key bit.
Without it, some gems' `extconf.rb` can find a non-wrapper gcc and bypass the
Nix include injection entirely.

## Verify it works

```bash
nix-shell discourse-app.nix --run \
  'cd /path/to/discourse && bundle exec ruby -e "require \"mini_racer\"; puts MiniRacer::Context.new.eval(\"1+1\")"'
```

Should print `2`.

## The counterintuitive part

Removing `glibc.dev` from `buildInputs` to make `stdlib.h` findable sounds
backwards. You'd think adding the package that contains `stdlib.h` would make
`stdlib.h` findable.

The reason it doesn't work: the gcc wrapper on NixOS isn't a transparent pass-through.
It's a shell script that wraps the real gcc and injects `-isystem` paths so you
can use system headers without littering store paths throughout your build files.
It already knows where glibc lives. Adding glibc to `buildInputs` doesn't teach
it anything new - it just creates a second, conflicting injection that the
`#include_next` mechanism in C++ stdlib headers can't handle.

Trust the wrapper. Don't add glibc manually.
