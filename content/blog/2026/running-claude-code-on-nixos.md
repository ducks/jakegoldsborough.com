---
title: "Running Claude Code on NixOS"
date: 2026-05-07
description: "Claude Code's official installer drops a prebuilt Linux binary that won't execute on NixOS. A 133-line shell.nix patches it on the way in. Here's what's broken, why, and how to fix it without leaving the official install path."
taxonomies:
  tags:
    - nixos
    - ai
    - tools
---

I run NixOS on my laptop. I use Claude Code daily. Recently the two stopped getting along, so I sat down and fixed it.

The official Claude Code installer ([`curl -fsSL claude.ai/install.sh | bash`](https://docs.claude.com/en/docs/claude-code/setup)) drops a prebuilt Linux binary into `~/.local/bin/claude`. On Debian, Fedora, Arch, anything FHS-compliant, it just works. On NixOS, the binary refuses to run with some flavor of:

```
Could not start dynamically linked executable: /home/<user>/.local/bin/claude
NixOS cannot run dynamically linked executables intended for generic
linux environments out of the box. For more information, see:
https://nix.dev/permalink/stub-ld
```

The binary is right there. It has the executable bit. NixOS just refuses to run it.

## Why this happens

NixOS doesn't follow the [Filesystem Hierarchy Standard](https://en.wikipedia.org/wiki/Filesystem_Hierarchy_Standard). There is no `/lib64/ld-linux-x86-64.so.2`. Every library lives in `/nix/store/<hash>-<package>/lib/`, and a given system can have many versions of the same library coexisting in different store paths.

Prebuilt Linux binaries hardcode `/lib64/ld-linux-x86-64.so.2` as the path to the dynamic linker. They also hardcode an rpath pointing at FHS library directories that don't exist. When the kernel `execve`s such a binary, it can't find the linker to load and bails out with the misleading "required file not found" error.

This isn't unique to Claude Code. It bites Discord, Spotify, Steam, the .NET SDK, anything you `curl | bash` from a vendor's website. The NixOS community has [several documented workarounds](https://nixos.wiki/wiki/Packaging/Binaries):

- **patchelf**: rewrite the binary's interpreter and rpath to point at Nix store paths
- **nix-ld**: a shim that maps the FHS linker path to a real Nix-provided linker at runtime
- **buildFHSEnv** / `steam-run`: drop the binary into a sandbox that fakes an FHS layout
- **autoPatchelfHook**: the canonical packaging path, used when a binary is being added to nixpkgs

I went with patchelf. It works from a plain `nix-shell` without touching `configuration.nix`, and it leaves the official install path intact - the binary still lives where Claude Code expects it.

## The fix

[claude-nixos](https://github.com/ducks/claude-nixos) is a single `shell.nix` (133 lines) that does three things:

1. Wraps the official install script and patches the binary on the way in
2. Patches binaries that are *already* installed
3. Updates an existing install to a new version, repatching as it goes

You enter the shell:

```bash
nix-shell shell.nix
```

And get three functions:

```bash
install_claude_fixed              # download + patch
install_claude_fixed 0.5.2        # specific version
fix_installed_claude              # repair what's already there
update_claude_fixed               # newer version, same patch
```

## How the patch works

The interesting bit is the `patch_binary` function. Given a path to an ELF binary, it asks Nix for the path to *its* dynamic linker and the libraries the binary will need, then rewrites the binary in place:

```bash
patchelf \
  --set-interpreter "$DYNAMIC_LINKER" \
  --set-rpath "$LIBRARY_PATH" \
  "$binary"
```

`$DYNAMIC_LINKER` comes from `pkgs.stdenv.cc.bintools.dynamicLinker` (a real, existing `/nix/store` path). `$LIBRARY_PATH` is built from `glibc`, `libstdc++`, `openssl`, `curl`, `sqlite`, `zlib` (the libraries Claude Code's binary actually links against, found by trial and `ldd`).

After patching, the binary's interpreter points at a file that exists on NixOS, and its rpath points at directories that contain the libraries it needs. The kernel can `execve` it, the linker can resolve its imports, and `claude` runs.

For new installs, the wrapper runs `sed` against the official install script to inject patchelf calls right after the binary is placed:

```bash
sed -i "/cp.*claude.*\$INSTALL_DIR/a $PATCH_SCRIPT" install.sh
```

So the patched flow is byte-for-byte the official install with one extra step inlined. When Anthropic ships a new installer, the wrapper still works as long as `cp ... claude ... $INSTALL_DIR` stays in the script. If they restructure it, the sed pattern breaks loudly and obviously.

## Try it

```bash
git clone https://github.com/ducks/claude-nixos
cd claude-nixos
nix-shell
install_claude_fixed
claude --version
```

If you've already installed Claude Code through the official script and it's broken, run `fix_installed_claude` instead and it'll patch what's there.

## Links

- [claude-nixos](https://github.com/ducks/claude-nixos)
- [NixOS Wiki: Packaging/Binaries](https://nixos.wiki/wiki/Packaging/Binaries) - the canonical write-up of the four fix-it options
- [nix-ld](https://github.com/nix-community/nix-ld) - the system-wide alternative
