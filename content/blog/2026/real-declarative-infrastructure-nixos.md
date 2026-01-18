---
title: "From Bash Scripts to NixOS: Real Declarative Infrastructure on a VPS"
date: 2026-01-18
description: "Converting a bash script + systemd-based VPS to NixOS for truly declarative infrastructure. No more update scripts or edge cases, just configuration.nix."
taxonomies:
  tags:
    - nixos
    - self-hosting
    - infrastructure
---

In my [previous post](/blog/2026/running-infrastructure-with-systemd/), I
described running infrastructure with systemd services and bash scripts. It
worked, but the update script kept growing with edge cases.

```bash
# This kept getting longer
safe_download() { ... }
update_goatcounter() {
    # Download binary
    # Stop service
    # Run migrations
    # Start service
}
# Repeat for each service...
```

Every service needed special handling. GoatCounter needed database migrations.
Scrob had "text file busy" errors. Downloads could 404 and block everything.

Three weeks in, the update script was 300+ lines with `|| true` scattered
everywhere.

I wasn't managing infrastructure declaratively. I was writing imperative bash
scripts to approximate declarative config.

## The Inevitable Upgrade

I already use NixOS for local development. My laptop runs it. My dev
environments are nix-shell. I know how good it is for reproducibility.

The bash script approach was always temporary. I knew I'd migrate to NixOS
eventually - I just wanted to get the services running first, understand what
they needed, then declare it properly.

But after three weeks of bash edge cases, "eventually" became "now."

## Creating pond-nix

I created a new repo called `pond-nix` with NixOS configuration for the same
services:

```nix
# configuration.nix
{
  imports = [
    ./services/gitea.nix
    ./services/goatcounter.nix
    ./services/woodpecker.nix
    ./services/scrob.nix
    ./services/caddy.nix
  ];

  networking = {
    hostName = "pond";
    useDHCP = false;
    interfaces.ens3.ipv4.addresses = [{
      address = "199.68.196.244";
      prefixLength = 24;
    }];
    defaultGateway = "199.68.196.1";
    nameservers = [ "176.10.124.177" "176.10.124.136" ];
    firewall.allowedTCPPorts = [ 22 80 443 ];
  };

  users.users.ducks = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3... ducks@pond"
    ];
  };

  security.sudo.wheelNeedsPassword = false;
}
```

Each service gets its own module:

```nix
# services/goatcounter.nix
{ config, pkgs, ... }:

{
  systemd.services = {
    goatcounter-jg = {
      description = "GoatCounter - stats.jakegoldsborough.com";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        ExecStart = "${pkgs.goatcounter}/bin/goatcounter serve -listen localhost:8081 -tls none -db sqlite+/var/lib/goatcounter-jg/goatcounter.db";
        User = "goatcounter";
        WorkingDirectory = "/var/lib/goatcounter-jg";
        Restart = "always";
      };
    };
    # ... other instances
  };
}
```

No update scripts. No migrations to remember. Nix handles dependencies, service
ordering, and restarts.

## The Installation Challenge

Installing NixOS on a VPS remotely is risky. Get the network config wrong and
you're locked out.

### The nixos-infect Trap

My first thought was `nixos-infect` - a script that converts an existing Linux
system to NixOS in-place. Seems clever, right?

Maybe too clever?

I tried it on a fresh Arch install. The script started building, then hit an
error:

```
swapon: /tmp/nixos-infect.swp: Invalid argument
```

**The problem:** On Linux, `/tmp` is mounted as tmpfs - a RAM-based filesystem.
nixos-infect tried to create a 1GB swap file *in RAM*. That's like trying to
extend your RAM by using... RAM.

I patched the script to use `/root/tmp` instead:

```bash
curl -o nixos-infect.sh
https://raw.githubusercontent.com/elitak/nixos-infect/master/nixos-infect
sed -i 's|mktemp /tmp/|mktemp /root/tmp/|g' nixos-infect.sh
mkdir -p /root/tmp
NIX_CHANNEL=nixos-24.05 bash nixos-infect.sh
```

This time it worked! The build completed, the system rebooted...

And I was locked out.

nixos-infect generated a config, but with no console password and broken SSH
access. I could see the NixOS login screen through the console, but couldn't log
in. SSH timed out.

**Lesson learned:** In-place conversions are clever until they're not. When
you're remote, clever is dangerous.

### The ISO Approach

I wiped the VPS and started over with the NixOS installation ISO.

**Step 1: Mount the ISO**

Downloaded the [NixOS 25.11 minimal
ISO](https://nixos.org/download/) and mounted it through Fornex's control
panel, then I rebooted the VPS.

**Step 2: Set up networking**

The installer gives you a root shell with no password. But before anything else,
networking:

```bash
# Check interface name (mine was ens3, not eth0!)
ip addr

# Configure static IP
ip addr add 199.68.196.244/24 dev ens3
ip link set ens3 up
ip route add default via 199.68.196.1
echo "nameserver 176.10.124.177" > /etc/resolv.conf

# Test it
ping -c 2 google.com
```

**Step 3: Enable SSH**

```bash
passwd root  # Set a temporary password
systemctl start sshd
```

Now I could SSH in from my local machine and use a proper terminal instead of
the janky web console.

**Step 4: Partition the disk**

GPT with GRUB needs a BIOS boot partition:

```bash
parted /dev/vda -- mklabel gpt
parted /dev/vda -- mkpart primary 1MB 512MB    # BIOS boot
parted /dev/vda -- mkpart primary 512MB 100%   # Root filesystem
parted /dev/vda -- set 1 bios_grub on

mkfs.ext4 /dev/vda2
mount /dev/vda2 /mnt
```

The first partition stays unformatted - GRUB just needs it for bootloader code.

**Step 5: Generate and customize config**

```bash
nixos-generate-config --root /mnt
nano /mnt/etc/nixos/configuration.nix
```

Key settings:

```nix
{
  boot.loader.grub.enable = true;
  boot.loader.grub.device = "/dev/vda";

  networking = {
    hostName = "pond";
    useDHCP = false;
    interfaces.ens3 = {  # Not eth0!
      ipv4.addresses = [{
        address = "199.68.196.244";
        prefixLength = 24;
      }];
    };
    defaultGateway = "199.68.196.1";
    nameservers = [ "176.10.124.177" "176.10.124.136" ];
    firewall.allowedTCPPorts = [ 22 80 443 ];
  };

  users.users.ducks = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3... ducks@pond"
    ];
  };

  security.sudo.wheelNeedsPassword = false;

  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "prohibit-password";
    };
  };
}
```

**Step 6: Install**

```bash
nixos-install
# Set root password when prompted
reboot
```

After reboot, unmount the ISO through the control panel.

**Step 7: SSH in with your user**

```bash
ssh ducks@199.68.196.244
```

It worked. NixOS booted, networking was correct, SSH keys worked. No lockouts.

## Deploying the Real Config

Now that NixOS is installed, time to deploy pond-nix:

```bash
# Clone your config
git clone https://git.jakegoldsborough.com/ducks/pond-nix.git
cd pond-nix

# Deploy it (automatically fetches hashes, copies files, and builds)
make install
```

The Makefile handles everything: fetching binary hashes for packages, copying
config files to `/etc/nixos/`, and running `nixos-rebuild`. One command builds
and activates all services: Gitea, GoatCounter, Woodpecker, Scrob, Caddy.
Everything starts declaratively.

If something breaks:

```bash
sudo nixos-rebuild switch --rollback
```

One command. Back to the previous working state.

## Migrating the Data

With NixOS running and services configured, time to migrate data from the old
server (burrow). I wrote a migration script to handle this:

```bash
# scripts/migrate-from-burrow.sh
#!/usr/bin/env bash

# 1. Stop services on pond (avoid database corruption)
ssh pond 'sudo systemctl stop scrob goatcounter-jg gitea'

# 2. Back up databases from burrow
ssh burrow 'sudo tar czf /tmp/goatcounter-backups.tar.gz /var/lib/goatcounter-*'
ssh burrow 'sudo tar czf /tmp/gitea-backup.tar.gz /var/lib/gitea'
ssh burrow 'sudo -u postgres pg_dump scrob | gzip > /tmp/scrob-db.sql.gz'

# 3. Copy to local machine (keep backups!)
scp burrow:/tmp/*.tar.gz burrow:/tmp/*.sql.gz /tmp/backups/

# 4. Copy to pond and restore
scp /tmp/backups/* pond:/tmp/
ssh pond 'cd /tmp && sudo tar xzf goatcounter-backups.tar.gz -C /'
ssh pond 'cd /tmp && sudo tar xzf gitea-backup.tar.gz -C /'
ssh pond 'gunzip < /tmp/scrob-db.sql.gz | sudo -u postgres psql scrob'

# 5. Fix permissions
ssh pond 'sudo chown -R goatcounter:goatcounter /var/lib/goatcounter-*'
ssh pond 'sudo chown -R gitea:gitea /var/lib/gitea'

# 6. Start services
ssh pond 'sudo systemctl start goatcounter-jg gitea scrob'
```

Run it:

```bash
./scripts/migrate-from-burrow.sh
```

All data migrated: Git repositories, analytics databases, scrobble history.
Everything preserved.

## Updating DNS

Final step: point DNS to the new server. I use name.com's API:

```bash
# scripts/update-dns.sh
export NAMECOM_USERNAME="your_username"
export NAMECOM_TOKEN="your_api_token"
./scripts/update-dns.sh
```

The script updates specific service A records to pond's IP (199.68.196.244):
- `code.jakegoldsborough.com` → Gitea
- `ci.jakegoldsborough.com` → Woodpecker
- `stats.jakegoldsborough.com` → GoatCounter
- `scrob.jakegoldsborough.com` → Scrob API
- `ui.scrob.jakegoldsborough.com` → Scrob UI
- `stats.date-ver.com` → GoatCounter
- `stats.gnarlyvoid.com` → GoatCounter

DNS propagates in a few minutes. Test with `dig`:

```bash
dig code.jakegoldsborough.com +short
# 199.68.196.244
```

Once DNS updates, Caddy automatically provisions Let's Encrypt certificates for
all domains. No manual cert management needed.

## What Changed

**Before (burrow-systemd):** - 300+ lines of bash scripts - Manual version
checking - Special migration handling per service - "Text file busy" errors -
Download failures blocking other updates - `|| true` everywhere

**After (pond-nix):** - Declarative config in Nix - `nixos-rebuild switch
--upgrade` updates everything - Migrations run automatically (defined in service
modules) - Atomic updates - One command rollback

## Service Updates

With systemd + bash:

```bash
sudo ./bin/update check        # Check for updates
sudo ./bin/update apply        # Apply them
# Hope nothing breaks
```

With NixOS:

```bash
cd pond-nix
git pull
make install
```

That's it. Pull the latest config, and the Makefile handles the rest: updating
hashes, testing the config, and deploying atomically. If anything fails, the old
generation still works.

## The Tradeoff

NixOS has a learning curve. Nix expressions are different from bash scripts.

But once you understand it, everything clicks: - System is reproducible -
Updates are atomic - Rollbacks are instant - Configuration is versioned in git

No more "it works on my machine". The configuration *is* the machine.

## Was It Worth It?

My update script was approaching 500 lines with `safe_download()`, per-service
migration logic, and error handling for every edge case.

Now it's ~500 lines of readable Nix across multiple modules. But those lines
are: - Declarative - Type-checked - Composable - Reproducible

The difference: With bash, I was writing *procedures*. With Nix, I'm declaring
*state*.

That's real declarative infrastructure.

## Links

- [pond-nix](https://github.com/ducks/pond-nix)
- [nixos-infect](https://github.com/elitak/nixos-infect)
- [NixOS Manual](https://nixos.org/manual/nixos/stable/)
- [Previous post: Running Infrastructure with Systemd](/blog/2026/running-infrastructure-with-systemd/)


