# Lowlife · Console

A KernelSU module designed for temporary root environment, providing basic environment hiding capabilities and LSPosed repair functionality.

---

## Introduction

Lowlife is a lightweight KernelSU module built for **temporary root (non-BL-unlocked)** devices.  
It provides fundamental environment hiding capabilities to bypass common detection scenarios, along with LSPosed repair functionality.

Unlike full system modifications, all operations are performed **in memory only** — no system partitions are modified, and all changes are automatically cleared after a cold reboot.

---

## Features

- **LSPosed Repair**  
  Refreshes KSU lifecycle (`post-fs-data` / `services` / `boot-completed`) and allows you to choose between Normal or Advanced hot reboot.

- **KSU Module Reload**  
  Reloads all module lifecycle scripts without triggering a reboot. Useful after module config changes.

- **Normal Hot Reboot**  
  KernelSU official soft reboot (`setprop ctl.restart zygote`). Reboots Zygote without applying environment hiding.

- **Advanced Hot Reboot**  
  PID consumption + KSU soft reboot + automatic environment hiding. Simulates a real boot environment to avoid PID-based detection.

- **Environment Hiding**  
  - Kernel hardening (restrict debug interfaces)  
  - System type spoofing (`ro.debuggable=0`, `ro.build.type=user`)  
  - Sensitive process hiding (`magisk` / `ksu` / `lspd` / `zygiskd`)  
  - Kernel interface lockdown (`/proc/ksu` / `kallsyms` / `modules`)  
  - SELinux enforcing

---

## Usage

**Recommended order of operations:**
