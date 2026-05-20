---
title: "When patchelf stopped working on Claude Code"
date: 2026-05-20
description: "A sequel to the NixOS fix. The patchelf-based shell.nix was working, then a Claude Code update made it produce binaries that segfaulted before main(). Three wrong hypotheses, one real cause, two more gotchas hiding inside the fix, and the resolution that finally made it all moot: nix-ld."
taxonomies:
  tags:
    - nixos
    - debugging
    - elf
    - tools
---

A couple weeks ago I wrote about [running Claude Code on NixOS](https://jakegoldsborough.com/blog/2026/running-claude-code-on-nixos/) with a 133-line `shell.nix` that patchelf-modifies the binary on install. It worked great until last week, when Claude Code's auto-updater dropped version 2.1.143 into `~/.local/share/claude/versions/` and `claude --version` started segfaulting before printing anything.

What follows is the debugging story. I went down three wrong paths before finding the real cause, and the right fix turned out to have two more gotchas hiding inside it. The patchelf approach is dead. Here's why.

## The symptom

```
$ claude --version
Segmentation fault (core dumped)
```

`coredumpctl` showed the crash inside the dynamic linker itself, in `_dl_check_map_versions` at `glibc/elf/dl-version.c:263`, before a single byte of program code had run:

```
#0  _dl_check_map_versions       at dl-version.c:263
#1  _dl_check_all_versions       at dl-version.c:398
#2  version_check_doit           at rtld.c:676
#3  _dl_receive_error            at dl-catch.c:194
#4  dl_main                      at rtld.c:2028
...
#8  _start ()                    from /lib64/ld-linux-x86-64.so.2
```

The previous version (2.1.132) worked fine. 2.1.143 didn't. Same `patch_binary` invocation, same Nix linker, same rpath. The binary was patched correctly in the sense that `patchelf --print-interpreter` reported the Nix glibc linker path.

## Wrong hypothesis #1: the auto-updater dropped an unpatched binary

My first guess was that Claude's auto-updater had bypassed the install-time patchelf step. I extended `shell.nix` with a wrapper that auto-patchelfs any unpatched binary in the versions directory before exec'ing it.

This was the wrong fix to the wrong problem. The binary was already patched; `patchelf --print-interpreter` confirmed it. The wrapper was a useful-feeling defensive layer but it wasn't relevant to the actual bug.

## Wrong hypothesis #2: Bun's Rust rewrite shipped malformed ELF

Claude Code is built with `bun build --compile`, which embeds the Bun runtime inside the standalone executable. There had been [recent news](https://www.theregister.com/devops/2026/05/14/anthropics-bun-rust-rewrite-merged-at-speed-of-ai/5240381) about Anthropic merging a Rust rewrite of Bun, and an [open bun issue](https://github.com/oven-sh/bun/issues/30717) about regressions in the `--compile` path. The dates lined up: Bun v1.3.14 shipped May 13, the Rust rewrite PR merged May 14, my broken Claude Code was downloaded May 18.

I had a hypothesis, the timing fit, and I was off to the races. Built a clean Docker repro on stock Ubuntu 24.04 showing the same `_dl_check_map_versions` crash outside NixOS. Started drafting a bug report against `oven-sh/bun`. Compared `readelf --version-info` between the working and broken binaries and found errors:

```
$ readelf --version-info /tmp/claude-2.1.143
readelf: Error: Reading 20 bytes extends past end of file for version def
readelf: Error: Reading 20 bytes extends past end of file for version def
...
```

The narrative was perfect. Bun's new Rust ELF emitter was producing corrupt version tables, the dynamic linker was crashing trying to read them, and I was about to file a high-quality upstream bug.

Then I checked the most basic fact, which I should have checked at the start:

```
$ strings /tmp/claude-2.1.143 | grep '^Bun v'
Bun v1.3.14 (d2989145)

$ strings /tmp/claude-2.1.132 | grep '^Bun v'
Bun v1.3.14 (0a466a11)
```

**Both binaries embed Bun v1.3.14.** The Rust rewrite hasn't shipped in any tagged release yet; it's only on canary. Different build commits, same version. The Rust theory was dead.

Lesson: when the story fits perfectly, do the cheapest disconfirming test first.

## Wrong hypothesis #3: Claude Code's build pipeline regressed

If it wasn't Bun, it had to be something on Anthropic's side. I bisected across every published version in the range:

```bash
for v in 2.1.132 2.1.133 2.1.136 2.1.137 2.1.138 2.1.139 2.1.140 2.1.141 2.1.142 2.1.143; do
  curl -fsSL -o "/tmp/bisect/$v" \
    "https://downloads.claude.ai/claude-code-releases/$v/linux-x64/claude"
  docker run --rm -v "/tmp/bisect/$v:/c:ro" ubuntu:24.04 /c --version
done
```

Every freshly-downloaded binary ran cleanly. **All of them.** Including 2.1.143.

The crash I'd been reproducing was on my locally-modified copy in `/tmp/claude-test`, not on a pristine upstream binary. I'd convinced myself I was testing the official binary because the path looked right. I was actually testing the result of my own earlier patchelf modification.

This is where the actual cause finally became visible.

## The real cause

Diff the program headers of 2.1.132 vs 2.1.133 with `readelf -l`:

```
2.1.132 RW LOAD:
  FileSiz=0x000e0028  (~916 KiB)
  MemSiz=0x001ee29c   (~1.93 MiB)

2.1.133 RW LOAD:
  FileSiz=0x07c17d20  (~124 MiB)
  MemSiz=0x07c17d20   (~124 MiB)
```

In 2.1.132, the RW LOAD segment's `MemSiz` is larger than its `FileSiz`, which is a [BSS-style](https://en.wikipedia.org/wiki/.bss) zero-fill region that exists at runtime but takes no space on disk. In 2.1.133, `FileSiz` equals `MemSiz` and they're both ~124 MiB. Bun changed its standalone-executable layout to bake the entire embedded JS payload onto disk in the RW segment rather than zero-filling.

Why does this matter for patchelf? When patchelf rewrites the interpreter string or rpath, the new string is often longer than what it replaces. patchelf needs slack in the file layout to insert it without breaking section offsets. In 2.1.132 there's plenty of slack. From 2.1.133 onward there isn't, so patchelf's modifications end up shifting the `Elf64_Verneed` and related version tables to file offsets where the loader walks off the end of the section.

The crash in `_dl_check_map_versions` is the loader trying to dereference a `vna_name` pointer that now points into garbage memory.

**The pristine binaries are fine.** They run unmodified on NixOS as long as you give them a real dynamic linker. It's only the patchelf-modified ones that crash. patchelf has been silently producing broken binaries on the new layout the entire time.

## The fix

Stop modifying the binary. Invoke the Nix dynamic linker directly with the unmodified binary as its argument:

```bash
exec /nix/store/.../ld-linux-x86-64.so.2 \
  --library-path /nix/store/.../lib:/nix/store/.../lib:... \
  /home/ducks/.local/share/claude/versions/2.1.143 "$@"
```

This is what `nix run` and `nix-ld` do under the hood. The kernel only chokes when it tries to follow the binary's *embedded* interpreter path (`/lib64/ld-linux-x86-64.so.2`, which doesn't exist on NixOS). If you invoke a working linker yourself and pass the binary as an argument, the kernel never looks at the embedded path. The linker loads the binary as a regular dynamic object using the library paths you give it. No on-disk modification, no patchelf, no shifted section offsets.

I rewrote `claude-nixos/shell.nix` to drop patchelf entirely. The wrapper at `~/.local/bin/claude` now picks the highest installed version, then exec's the linker with the unmodified binary. Pristine binaries are re-downloaded from `downloads.claude.ai` to overwrite the patchelf damage on existing installs.

## Gotcha #1: LD_LIBRARY_PATH leaks to children

My first attempt at the wrapper exported `LD_LIBRARY_PATH` and called the linker:

```bash
export LD_LIBRARY_PATH="$NIX_LIBS"
exec "$LINKER" "$BIN" "$@"
```

This works for Claude itself. But Claude spawns Bash subprocesses for tool calls (the Bash tool in particular), and those subprocesses inherit `LD_LIBRARY_PATH`. Bash then resolves *its own* shared libraries through our Nix paths, sometimes pulls in a mismatched version, and you get cryptic errors like:

```
-G: error while loading shared libraries: -G: cannot open shared object file:
  No such file or directory
```

That `-G` is `grep`'s `--basic-regexp` flag being mis-parsed as a shared object path by a confused loader. Lovely.

The fix is to use `ld.so`'s `--library-path` flag instead of `LD_LIBRARY_PATH`. It's consumed by the linker during this single invocation and is **not** propagated to child processes:

```bash
exec "$LINKER" --library-path "$NIX_LIBS" "$BIN" "$@"
```

Child processes inherit a clean environment.

## Gotcha #2: Claude Code is a multi-call binary

Claude Code's shell integration installs functions for `find`, `grep`, and `ugrep`:

```bash
find() {
  ...
  exec -a bfs "$_cc_bin" -S dfs -regextype findutils-default "$@"
}
```

The `exec -a bfs` sets `argv[0]` to `bfs` and exec's the Claude binary. The binary checks `argv[0]` and dispatches to embedded fast tools (`bfs` is a [breadth-first find](https://github.com/tavianator/bfs), `ugrep` is a faster `grep`). Clever: one binary, many tools.

This breaks under the wrapper. When the shell function does `exec -a bfs ~/.local/bin/claude ...`, my wrapper script runs with `$0` set to its own path (the kernel re-parses the shebang and loses the spoofed argv[0]). The wrapper then exec's the linker, and the linker's argv[0] is the linker path. The Claude binary sees an argv[0] of `/nix/store/.../ld-linux-x86-64.so.2`, doesn't recognize it as a tool, and runs the default UI.

Newer glibc linkers support `--argv0 STRING` to set argv[0] explicitly:

```bash
exec "$LINKER" --argv0 "$0" --library-path "$NIX_LIBS" "$BIN" "$@"
```

I started here and shipped this version, thinking it was a partial fix. It isn't. `$0` inside a bash script is the script's own path even when the script was invoked via `exec -a NAME`, because bash resets `$0` to the script name at startup. So `--argv0 "$0"` was always passing `/home/ducks/.local/bin/claude`, never `bfs` or `ugrep`. Bash 5+ exposes the real invocation argv[0] via `$BASH_ARGV0`, which fixes it:

```bash
exec "$LINKER" --argv0 "${BASH_ARGV0:-$0}" --library-path "$NIX_LIBS" "$BIN" "$@"
```

With that change the argv0 actually propagates. I verified by invoking it manually and watching the binary respond as `bfs` instead of as the default `claude` UI.

But the fast tools still didn't work from inside a Claude session. Adding `set -x` to the shell-integration `find` function showed why:

```
local _cc_bin=/nix/store/.../ld-linux-x86-64.so.2
```

Claude's harness sets `CLAUDE_CODE_EXECPATH` (the variable its shell integration uses to find itself) from `/proc/self/exe`. Once the wrapper exec's the dynamic linker, the kernel's view of the process is *the linker*, not the Claude binary. `/proc/self/exe` resolves to ld.so. Everything downstream that introspects the running process sees ld.so. The shell-integration `find` function then tries to exec `$CLAUDE_CODE_EXECPATH -regextype ...`, which is the linker treating `-regextype` as a library path. Boom.

This isn't fixable in userspace. No bash trick can hide the fact that the kernel-level process identity is ld.so. `/proc/self/exe` will never lie. The wrapper approach has a real ceiling here.

## The real fix: nix-ld

The wrapper approach is fundamentally limited by what the kernel sees as the running process. [`programs.nix-ld`](https://github.com/Mic92/nix-ld) sidesteps the whole class of problem by installing a stub at `/lib64/ld-linux-x86-64.so.2`, which is the FHS path that generic Linux binaries hardcode as their ELF interpreter. The stub redirects to a real Nix linker with a global library list:

```nix
programs.nix-ld = {
  enable = true;
  libraries = with pkgs; [
    stdenv.cc.cc
    zlib
    openssl
    xz
    sqlite
    curl
  ];
};
```

With that in place, the kernel can load the pristine Claude binary directly. `/proc/self/exe` is the real Claude binary, `argv[0]` is whatever the caller actually set, `CLAUDE_CODE_EXECPATH` resolves correctly, and the multi-call dispatch works.

The wrapper script collapses to its remaining job, picking the latest installed version:

```bash
#!/usr/bin/env bash
set -e

VERSIONS_DIR="$HOME/.local/share/claude/versions"

bin="$(ls -1 "$VERSIONS_DIR" 2>/dev/null \
  | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' \
  | sort -V \
  | tail -n1 \
  | awk -v d="$VERSIONS_DIR" '{print d"/"$0}')"

exec -a "${BASH_ARGV0:-$0}" "$bin" "$@"
```

No linker invocation. No `--library-path`. No `LD_LIBRARY_PATH` leak. nix-ld owns the runtime surface. The trade is that the library list is global to your system instead of per-shell: if you have two binaries that want different versions of the same library, you can only put one in the global list. For my single-vendored-binary case (Claude Code), this isn't a real constraint.

## One Nix-string-escape detour

Writing the new heredoc in `shell.nix`, I started with this:

```bash
exec -a "\${BASH_ARGV0:-\$0}" "\$bin" "\$@"
```

...and got a Nix parser error at column 25. Inside Nix double-single-quote strings (`''...''`), `\${` isn't an escape: Nix tries to parse it as antiquotation and the backslash doesn't help. The correct escape for a literal `${` inside `''...''` is `''${`:

```bash
exec -a "''${BASH_ARGV0:-\$0}" "\$bin" "\$@"
```

Single dollars work fine with `\$`. Only the brace form needs the double-apostrophe escape. Small thing but it took five minutes to figure out, and the error message (*"unexpected invalid token"*) doesn't lead you to it.

## Honest reflection

Three wrong hypotheses, each more confident than the last. The Bun-Rust-rewrite story was particularly seductive: recent news, a public issue tracker showing related regressions, timing that lined up. I drafted most of a bug report before checking the one thing that would have killed the hypothesis: which Bun version is actually embedded?

When the narrative fits perfectly, that's the moment to do the cheapest disconfirming test. Five seconds of `strings | grep Bun` would have saved time.

The same lesson came back to bite me at the end. I closed out the first version of this post with "the wrapper is partially broken, I'm parking it", documenting the limitation but never actually testing whether it was a *limitation* or just an unfinished implementation. The `$0` vs `BASH_ARGV0` thing would have closed half the gap on day one. The other half (the `/proc/self/exe` problem) took 20 minutes of `set -x` once I sat down with the right question. "Good enough for now" deserves the same disconfirming-test discipline as a fresh hypothesis.

The deeper lesson, twice over: modifying a binary to fit your OS only works until it doesn't. The bridge-from-Nix-to-FHS pattern feels solid because patchelf is well-understood, but it depends on the source binary having properties (slack in the file layout, no exotic packaging) that the binary's authors never promised you. Invoking the Nix linker directly against a pristine binary felt like the robust alternative, but it has its own ceiling: once *you* are ld.so, the rest of the world sees ld.so. nix-ld is one more step less clever than the linker-as-wrapper trick: instead of you running the linker, the kernel runs it for you, exactly the way it was designed to. The path of least cleverness wins.

## Code

The slimmed-down wrapper lives in [claude-nixos](https://github.com/ducks/claude-nixos) on the `nix-ld` branch. With `programs.nix-ld.enable = true;` in your NixOS configuration and a reasonable `libraries` list, you don't need a `nix-shell` to run Claude Code at all: the wrapper is just a `~/.local/bin/claude` script that picks the latest installed version and exec's it. If you don't care about juggling multiple installed versions, you can replace the wrapper with a symlink and skip the script entirely.
