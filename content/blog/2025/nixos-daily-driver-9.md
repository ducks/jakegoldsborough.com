+++
title = "NixOS as a daily driver or Zero to Nixty, part 9/? - Enabling Wi-Fi"
date = 2025-07-27
description = "Troubleshooting and fixing Wi-Fi on a Framework 16 laptop running NixOS by loading the Intel AX210 driver, enabling firmware, and configuring NetworkManager with wpa_supplicant."
[taxonomies]
tags = ["nixos", "framework"]
+++

I recently got a new
[Framework 16](https://frame.work/products/laptop16-diy-amd-7040) (thanks
Discourse!). In the previous post, we talked about encrypting the machine and
refactoring our config into a modular layout. You can read about that and more
in the [NixOS As A Daily Driver](/tags/nixos) series.

Today I will be showing how I got Wi-Fi working because it did not work on NixOS
by default. The Framework 16 ships with an Intel AX210 Wi-Fi module.

### The Symptoms

- `nmcli device status` shows my `wlp2s0` as "DOWN"
- `ip link set wlp2s0 up` was not effective
- `nmtui` would show SSIDs but refused to connect

### Steps To Fix

**Load the Intel driver**

The AX210 needs the `iwlwifi` kernel module and firmware:

```
boot.kernelModules = [ "iwlwifi" ];
hardware.enableRedistributableFirmware = true;
```

This ensures the driver is in my `init-ramfs` and the firmware is present.

**Explicitly define Wi-Fi backend**

```
networking.networkmanager.enable = true;
networking.networkmanager.wifi.backend = "wpa_supplicant";
```

### Full Minimal Config Snippet

All in all, this is what I added:

```
# Load the Intel AX210 driver and firmware
boot.kernelModules               = [ "iwlwifi" ];
hardware.enableRedistributableFirmware = true;

# Enable the wireless module and NM
networking.networkmanager.enable = true;
networking.networkmanager.wifi.backend = "wpa_supplicant";
```

### Rebuild & Reboot

Make sure all the new config will take hold by rebuilding and rebooting.

```
sudo nixos-rebuild switch
sudo reboot now
```
You can confirm everything worked by running:
`nmcli device status | grep wlp2s0`

### Victory!

After rebooting, my `iwlwifi` driver loaded, `wlp2s0` came up, and `nmtui` was
able to both see and connect to the SSIDs.
