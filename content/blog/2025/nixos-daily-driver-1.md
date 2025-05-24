+++
title = "NixOS as a daily driver, part 1/? - What and why?"
date = 2025-05-18
[taxonomies]
tags = ["nixos", "linux"]
+++

First, it's worth explaining what NixOS is and why I or anyone would want to
run it as a daily driver.

But even before diving into NixOS, we have to talk about Nix.

### Nix
Nix is a package manager that is purely functional and creates reproducible
builds specified in the Nix Expression Language. Nix expressions are functions
that take dependencies as arguments which creates a *derivation* that specifies
a reproducible build environment. Nix then stores the results of the build at
unique address specified by a hash of the complete dependency tree. This
is known as the Nix store and it's immutable which allows atomic upgrades,
rollbacks, and simultaneous installations of packages with different versions.

### NixOS
NixOS is an operating system that is built on top of Nix and the idea of purely
functional package management. Packages are never overwritten once built. If
you change the Nix expression for a package, it will be rebuilt, and stored
under a new address with a new hash, preventing interference with an old version.

NixOS takes this a step further and applies this to configuration. By building
your entire system from a Nix expression, NixOS ensures that your old
configuration is never overwritten which allows for easy rollbacks. One big
caveat of this is the elimination of "global" directores such as `/bin`,
`/lib`, `/usr`, etc. All packages are kept in `/nix/store` under a hashed
address. (One exception is a symlink `/bin/sh` to Bash in the Nix store). There
is a `/etc` for system-wide config but many of those files are symlinks to files
in the Nix store.

Everything in NixOS is built by the Nix package manager. This includes the
kernel, applications, system packages, and configuration.

To configure NixOS, you have a file at `/etc/nixos/configuration.nix`.
You will setup everything from your boot devices to what services you want
to run.

Here is a minimal config that enables sshd:

```
{
  boot.loader.grub.device = "/dev/sda";
  fileSystems."/".device = "/dev/sda1";
  services.sshd.enable = true;
}
```

More on this later though.


### Why?
Now the whys. I think many of them speak for themselves but here are mine:

**Rollbacks**

This one is very big especially when learning about a new, drastically different
OS like Nix. Because old config is never overwritten, you can easily cause a
breaking change without being worried about how to fix it (unless maybe it's
bootloader related). In fact, old configs are listed in the boot menu.

**Reproducible Build Configurations**

Kind of like a rollback but starting from scratch. You can take the
`configuration.nix` file, copy to another machine, rebuild, and you will have
the same applications, services, and configuration as before.

**Ad-hoc shell environments**

In a "Nix shell", you can use any program that is packaged with Nix without
needing to install permanently.

For example, you can run `nix-shell -p git neovim node` and you will be dropped
into a shell with those applications installed. This may take some time
depending on the applications installed.

**It's a new way to think**

Honestly, I just like trying new stuff, especially when it's done in a new way.
Linux has mostly been the same for a long time now, so it's refreshing to see
a new way of doing it that also improves on an already solid OS. I also
have really fallen in love with DevOps/IaC type of work, and NixOS definitely
scratches that itch.

### Next time
In the next post, I will go over how to install NixOS and maybe a bit of the
configuration.
