+++
title = "NixOS as a daily driver on a late 2011 Macbook Pro, part 2/? - Installation, Basic Configuration"
date = 2025-06-04
description = "A step-by-step guide to installing NixOS from a minimal ISO, including partitioning with EFI, formatting drives, generating configuration files, and completing the first system build."
[taxonomies]
tags = ["nixos", "linux"]
+++

See [Part 1](/blog/2025/nixos-daily-driver-1) where I cover why you would want
to run NixOS as a daily driver.

In this post, we will cover installation on a personal machine and setting up
a basic configuration file.

Just as a note, for this specific post I am using:
- efi
- minimal ISO
- dd (tool to write ISO)

See [https://nixos.org/manual/nixos/stable/#ch-installation](https://nixos.org/manual/nixos/stable/#ch-installation)
for a full installation guide.

#### Installation

Because Nix and Nixpkgs can be installed on almost any Linux distro, it's possible
to install NixOS from inside an existing Linux install. You can even install
it in place on the same partition.
[https://nixos.org/manual/nixos/stable/#sec-installing-from-other-distro](https://nixos.org/manual/nixos/stable/#sec-installing-from-other-distro)

We will keep it simple and focus on using an ISO on a USB drive.

#### ISO

Go to [https://nixos.org/download/#nixos-iso](https://nixos.org/download/#nixos-iso)
to download the ISO of your choice. If you are a newer user, you should probably
pick graphical as it will help guide you along. I have Linux experience so I
will be using the minimal version.

Next, insert your USB drive and look for it using `lsblk`.
Make sure it's not mounted: `sudo umount /dev/sdX*`.
Then use `dd` to write the ISO to your drive:

`sudo dd bs=4M conv=fsync oflag=direct status=progress if=<path-to-image> of=/dev/sdX`

Now it's time to boot.

You will be greeted with nothing but a terminal. You will be automatically
logged in as the `nixos` user and have sudo access without a password.

#### Networking

You will need a connection to the internet to download various things needed
for the install. The easiest way is to just use a wired connection if possible.
If you need wireless, it takes a little setup. The minimal installer does not
ship with the correct firmware for my wireless card so I'm forced to use a wired
connection. The wireless setup doesn't look difficult and instructions can be
found here:
[https://nixos.org/manual/nixos/stable/#sec-installation-manual-networking](https://nixos.org/manual/nixos/stable/#sec-installation-manual-networking)


#### Partitioning and formatting

The minimal NixOS install doesn't do any partitioning or formatting so that
needs to be done manually.

First, you will need to partition:

1. Create a GPT partition table

`parted /dev/sda -- mklabel gpt`

2. Add the root partition. This will fill the disk except for the end part,
   where the swap will live, and the space left in front (512MiB) which will be
   used by the boot partition.

`parted /dev/sda -- mkpart root ext4 512MB -8GB`

3. Next, add a swap partition. The size required will vary according to needs, here a 8GB one is created.

`parted /dev/sda -- mkpart swap linux-swap -8GB 100%`

4. Finally, the boot partition. NixOS by default uses the ESP (EFI system
   partition) as its `/boot` partition. It uses the initially reserved 512MiB at
   the start of the disk.

```
parted /dev/sda -- mkpart ESP fat32 1MB 512MB
parted /dev/sda -- set 3 esp on
```

Now, you need to format those partitions:

1. For initialising `Ext4` partitions: `mkfs.ext4`. It is recommended that you
assign a unique symbolic label to the file system using the option `-L label`,
since this makes the file system configuration independent from device changes.
For example:

`mkfs.ext4 -L nixos /dev/sda1`

2. For creating swap partitions: mkswap. Again it’s recommended to assign a
label to the swap partition: `-L label`. For example:

`mkswap -L swap /dev/sda2`

3. For creating boot partitions: `mkfs.fat`. Again it’s recommended to assign a
   label to the boot partition: `-n label`. For example:

`mkfs.fat -F 32 -n boot /dev/sda3`

#### Installation

1. Mount the target file system on which NixOS should be installed on `/mnt`,
e.g.

`mount /dev/disk/by-label/nixos /mnt`

2. Mount the boot file system on /mnt/boot, e.g.

```
mkdir -p /mnt/boot
mount -o umask=077 /dev/disk/by-label/boot /mnt/boot
```

3. (optional) If your machine has a limited amount of memory, you may want to
   activate swap devices now (swapon device). The installer (or rather, the
   build actions that it may spawn) may need quite a bit of RAM, depending on
   your configuration.

`swapon /dev/sda2`

3. You now need to create a file `/mnt/etc/nixos/configuration.nix` that
   specifies the intended configuration of the system. This is because NixOS
   has a declarative configuration model: you create or edit a description of
   the desired configuration of your system, and then NixOS takes care of
   making it happen.

   The command `nixos-generate-config` can generate an initial configuration
   file for you:

`nixos-generate-config --root /mnt`

This command will also create a file at `/mnt/etc/nixos/hardware-configuration.nix`.
This includes important config for your filesystems among other things. While
NixOS should handle this, it can't hurt to double check just to make sure
things are defined correctly.

Most of the default config will be commented out, but a basic
`configuration.nix` file will look something like this:

```
{ config, pkgs, ... }:

{
  imports = [ ./hardware-configuration.nix ];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # Macbook Pro wireless firmware
  nixpkgs.config = {
    allowUnfree = true;
  };

  services.openssh.enable = true;

  system.stateVersion = "25.05"; # Adjust to match your NixOS version
}
```

Note for UEFI users: You must select a boot-loader, either systemd-boot or
GRUB. The recommended option is systemd-boot: set the option
`boot.loader.systemd-boot.enable` to true. `nixos-generate-config` should do
this automatically for new configurations when booted in UEFI mode.

4. Install! This step can take some time depending on your machine.

`nixos-install`

5. As the last step, nixos-install will ask you to set the password for the
   root user, e.g.

```
setting root password...
New password: ***
Retype new password: ***
```

6. If everything went well, it's time to `reboot`.

#### Summary

That's it for this post and the installation and basic configuration of NixOS.

#### Next Time

In the next installment, we'll create a non-root user, configure the Hyprland
window manager, and install some key daily-driver tools including Neovim, Git,
and LibreWolf.
