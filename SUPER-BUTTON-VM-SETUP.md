# Programming the Super Buttons via a Windows VM (UTM USB passthrough)

**Goal:** run the official *8BitDo Ultimate Software V2* (Windows) inside a VM on your
Mac, "borrow" the keyboard over USB, program the super buttons, and write the mapping
into the keyboard's **firmware**. The mapping persists in the keyboard, so once this is
done the buttons work natively on macOS afterward — no VM, no Karabiner, nothing running.

**Why a VM instead of doing it on macOS:** the super-button config channel rides a USB
interrupt endpoint that macOS's HID driver claims exclusively, so no macOS userland tool
can reach it. Windows *can*, so we let a Windows guest do the one-time write. Full
technical reasoning in `SUPER-BUTTON-PROTOCOL.md`.

---

## ⚠️ The one make-or-break setting

USB passthrough works **only with UTM's QEMU backend, not Apple Virtualization.**
When you create the VM, leave **"Use Apple Virtualization" UNCHECKED** (QEMU is the
default). If the USB menu is greyed out later, this is the reason.

(QEMU here is still hardware-accelerated — it's ARM-on-ARM via Apple's hypervisor — so
performance is fine.)

---

## Steps

### 1. Install UTM (free)
- Download from **https://mac.getutm.app** — the direct download is free. (The App Store
  build is the identical app; it just costs money to support the devs.)
- Drag it to Applications.

### 2. Get a Windows 11 **ARM64** ISO
On Apple Silicon the guest must be the ARM64 build. Easiest options:
- **CrystalFetch** (free, made by the UTM team — on the Mac App Store): downloads an
  official Windows 11 ARM64 ISO for you. Simplest path.
- Or grab the Windows 11 ARM64 ISO directly from Microsoft's "Download Windows 11" page.

(The 8BitDo app is 32-bit x86, but Windows 11 ARM runs x86/x64 apps through built-in
emulation — totally fine for a config utility.)

### 3. Create the VM (QEMU backend)
- UTM → **+** → **Virtualize** → **Windows**.
- Select the Windows 11 ARM ISO.
- **Leave "Use Apple Virtualization" UNCHECKED** (this is what enables USB passthrough).
- Check **"Install drivers and SPICE tools"** — gives you mouse/clipboard/guest drivers.
- ~4 GB+ RAM, ~64 GB disk; other defaults are fine.
- Start the VM and run through normal Windows setup (you can use a local account).

### 4. Install the 8BitDo software in the guest
- You already have it at `~/Downloads/8BitDo_Ultimate_Software_V2_Windows_V1.33`. Get that
  folder into the VM — drag-and-drop (with SPICE tools installed), a shared folder, or
  just re-download it inside Windows.
- Run **`8BitDo Ultimate Software V2.exe`**.

### 5. Pass the keyboard through to the VM
- Keyboard connected to the Mac by **USB-C**, in wired/USB mode (it already is — it shows
  up on macOS over USB-C).
- **If you're configuring the external accessory buttons, plug them into the keyboard's
  jack now** so the app can see them.
- With the VM running, click the **USB icon in UTM's top toolbar** → select
  **"8BitDo Retro Keyboard"** to capture it into the guest.
- macOS will lose the 8BitDo keyboard while it's captured — expected. Use your **laptop's
  built-in keyboard** for the host meanwhile. Windows will chime and enumerate it.

### 6. Configure and write
- The keyboard should now appear in the 8BitDo app. Open the key-mapping / super-button
  panel, assign what you want to Super A / Super B (and the external buttons if plugged
  in), and **Apply / Save** so it writes to the keyboard.
- Give it a few seconds — the write goes into the keyboard's onboard storage.
- **If the app offers a firmware update, decline it.** You don't need it to map buttons,
  and firmware flashing is the one real brick risk we avoid.

### 7. Release and verify on macOS
- In UTM's USB menu, click the keyboard again to **release** it to macOS (or just shut
  down the VM).
- Back on macOS, physically press the super buttons — they should now emit what you
  programmed. The mapping lives in the keyboard, so it persists across reboots and works
  with nothing running.

---

## Troubleshooting

- **USB menu greyed out / device won't attach** → the VM is on Apple Virtualization.
  Recreate it with that option **off** (QEMU).
- **Windows doesn't see the keyboard** → detach/reattach it in the USB menu; make sure
  it's fully captured (no longer owned by macOS).
- **App doesn't recognize the keyboard** → confirm it's in wired/USB mode and that Windows
  shows it in Device Manager as an HID device.
- **Fallback:** **VMware Fusion** (now free for personal use) has very smooth USB
  passthrough and also runs Windows 11 ARM — a solid plan B if UTM fights you.

---

## What this does and doesn't change

- ✅ Programs both the **on-board** Super A/B and the **external accessory** buttons, using
  the vendor's own tested software — the mapping is stored in the keyboard.
- ✅ After the one-time write, everything is native macOS; the VM is only needed to
  re-program later.
- ❌ Doesn't touch firmware (leave any FW-update prompt alone).
- ❌ Not a permanent dependency — you only boot the VM when you want to *change* a mapping.
