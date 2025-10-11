---
title: NixOS as a daily driver or Zero to Nixty, part 7.5/? - Trial by Encrypted Fire
date: '2025-07-13'
description: A detailed account of struggling through manual LUKS encryption setup
  on NixOS, hitting multiple roadblocks, and ultimately succeeding with the graphical
  installer after three failed attempts.
tags:
- nixos
- linux
---

### Intro

So far in this series, we have:
- installed NixOS
- enabled a desktop environment
- setup a user and some basic daily driving tools
- added our config to version control
- introduced NixVim, a declarative way to configure Neovim
- learned about NixOS dev environments

Catch up here:
[NixOS Daily Driver series list](/tags/nixos)


This post is a bit of a detour as we'll be completing a fresh reinstall
to enable disk encryption. We will be getting back to our configuration soon
though. The next post will show how to take our version controlled config
and apply it to our new install.

### Encryption

But first, let's talk encryption. So far I have not been installing NixOS with
the drive encrypted. I recently learned that my new job will require the machine
used for work to have an encrypted drive. This is a good thing and I should
have been defaulting to encrypting my drives. Even though it's good, it does
add some complexity to our NixOS configuration. Because I was doing this for
the first time, I decided to first test the encrypted installation on an old
System76 netbook I have.

### Manual Attempts with LUKS and LVM

Initially I planned to just do this manually. I have installed NixOS manually
every time so far, so I was hoping it would just be a few more steps. For the
most part this was true, but I still ran into some issues.

To start, I used `gparted`, `mkfs`, and `cryptsetup` to format the disk
and create some `LUKS` partitions.

#### Partitioning and LUKS encryption

```
# Partition disk (example: /dev/sda)
parted /dev/sda mklabel gpt
parted /dev/sda mkpart ESP fat32 1MiB 512MiB
parted /dev/sda set 1 boot on
parted /dev/sda mkpart primary 512MiB 100%

# Format boot partition
mkfs.vfat -F32 /dev/sda1

# Encrypt root partition with LUKS
cryptsetup luksFormat /dev/sda2
cryptsetup open /dev/sda2 cryptroot

```

This all worked fine and I was able to set a password for the encrypted drive
and then unlock it right after.

#### LVM

Now use LVM to allow flexibility inside the encrypted container:

```
# Initialize LVM
pvcreate /dev/mapper/cryptroot
vgcreate vg /dev/mapper/cryptroot

# Create logical volumes
lvcreate -L 16G -n swap vg
lvcreate -l 100%FREE -n root vg

# Format filesystems
mkfs.ext4 /dev/vg/root
mkswap /dev/vg/swap
```

#### Mounting for Installation

Next was to mount our partitions for installation.

```
# Mount the root volume
mount /dev/vg/root /mnt

# Mount the EFI partition
mkdir -p /mnt/boot
mount /dev/sda1 /mnt/boot

# Enable swap
swapon /dev/vg/swap
```

#### Configuration and Installation

The next step was to generate the NixOS configuration for our mounted filesystem:

`nixos-generate-config --root /mnt`

When running this, NixOS will generate a basic configuration for you based on
the disks you create and mount. This works well when creating an unencrypted
drive and the boot, root, and swap partitions are all configured correctly. For
whatever reason, the `LUKS` devices do not get picked up by this. This means
we'll have to manually update our configuration to include the `LUKS` devices.

This is fine because from what I read in the docs, this isn't too complex. It
should look something like this:
```
# Attempted configuration
boot.initrd.luks.devices."cryptroot" = {
  device = "/dev/disk/by-uuid/XXXX";
};
```

The docs also mention adding a kernel module:
`boot.initrd.kernelModules = [ "cryptd" ];`

After that, it was time to rebuild then reboot.

And, at first, success! During boot, I get asked for a password to open my
encrypted drive.

But then... failure! The passphrase will not work. My first instinct was I fat
fingered it but I tried multiple times and it would just not work.

#### Recovery

Welp, time to boot into the live ISO again. I wanted to doublecheck all the
config and make sure I didn't mess something up.

First, I needed to open the encrypted root partition:
`cryptsetup open /dev/sda2 cryptroot`

This creates `/dev/mapper/cryptroot` and gives access to what's inside.

Next, the volume groups needed activated:
```
vgscan
vgchange -ay
```

Then we mount some important directories:
```
mount /dev/vg/root /mnt
mkdir -p /mnt/boot
mount /dev/sda1 /mnt/boot
```

Now, we'll use `nixos-enter`. This gave me a shell inside the broken system --
same environment as if it had booted normally.

We can check our config files to make sure nothing looks off:
```
nano /etc/nixos/configuration.nix
nano /etc/nixos/hardware-configuration.nix
```

Unfortunately for me, I could not find anything wrong. In fact, I tried 3 fresh
installs and could never get it working manually.

### Graphical Installer

After all that, I decided to just give up on the manual install and try the
graphical installer. I should have probably started here but I didn't see a
certain sentence in the wiki in time.

> There are a few options for full disk encryption. The easiest way is to use
> the graphical installer and choose "encrypt" while doing the installation.

And ya know what, it was easy. So easy in fact, it worked the first time and I
could instantly power up, enter my encrypted drive password, and be taken to
the login console.

### Outro

This post was kind of a detour from the normal series as we reinstalled
so we could encrypt the drive. In the next post, I will be going over how
we can take the configuration we added to git in the previous posts and apply
it to our new, freshly installed and encrypted system.

Spoiler: it does not go as smoothly as I had hoped.
