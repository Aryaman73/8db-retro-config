# Plan — cross-platform 8BitDo keyboard configurator

Goal: an OS-agnostic (macOS / Windows / Linux) app to remap keys and program the
dual Super Buttons on the 8BitDo Retro Mechanical Keyboard — **N Edition first**,
then other variants — built on a clean, reusable HID core. Released for the community.

## Strategy
Don't fight the official software (Wine = fragile; the macOS binary is closed = can't
extend). Configuration is plain **USB HID in userland**, already reverse-engineered.
We validated it on real hardware, then build a TypeScript / `node-hid` core so the
whole product is one language, packaged with `electron-builder`.

The N Edition reports the **same VID/PID (`0x2dc8`/`0x5200`)** as the standard Retro
Mechanical Keyboard — same hardware, same protocol. The official macOS app simply
gatekeeps it out of an allowlist.

## Scope (decided)
- ✅ Basic key remapping
- ✅ Dual Super Buttons
- ❌ Macros (out of scope)
- ❌ Firmware flashing (out of scope — the only real brick risk; AES-locked anyway)

---

## Phase 0 — Recon & de-risk ✅ DONE
- ✅ N Edition VID/PID = `0x2dc8`/`0x5200` == the supported standard keyboard.
- ✅ Config channel = USB **interface #2**, HID usage page `0x8c`.
- ✅ macOS opens interface #2 from userland with **no entitlement / no permission
  prompt** (the protected keyboard interface #1 correctly refuses). Top risk retired.
- ✅ Full two-way protocol conversation working via `node-hid`: `status` reads the
  profile name and mapped keys from the real keyboard. (`node src/cli.ts status`)
- 🔎 Finding: the Python tool's libusb path is Linux-oriented; on macOS the
  IOHIDManager/`node-hid` path is the one that works — reinforces the TS-core plan.

## Phase 1 — Working remap MVP  ← NEXT
- Implement + hardware-test the `map` WRITE path (already coded in `client.ts`,
  not yet exercised against hardware).
- First confirm the **factory-reset combo** for the N Edition as an undo before any write.
- Wire `map` / `map-hid` into the CLI. Deliverable: remap your N Edition from your Mac.

## Phase 2 — Harden the TS HID core
- Golden-byte tests: capture exact command bytes and assert the core reproduces them.
- Robust read timing / retries; profile create/delete.

## Phase 3 — Macros / chords (new protocol work)
- **Finding:** the Super Buttons themselves (`supera` 0x6d, `superb` 0x6c) ARE
  remappable via the normal single-key MAP path — no special protocol needed for
  single-key assignments. What's NOT solved is **chords/macros** (e.g. ⌘+F13).
- **Disproven:** sending a MAP buffer of concatenated 3-byte usages (e.g.
  `07e300 070004` = GUI+A) does NOT chord — the keyboard honours only the FIRST
  usage and ignores the rest (verified: A Super emitted ⌘ only, not ⌘+A).
- **Next:** capture the official software programming a macro via **USBPcap +
  Wireshark** to find the real encoding (likely a count/modifier byte or a
  distinct macro command). Needs a Windows machine/VM (user has an old one).
- Interim: single-key works (A Super currently = bare F13, which serves the same
  hotkey purpose without needing the ⌘ modifier).

## Phase 4 — Electron GUI
- Visual keyboard layout → click key → remap; Super Button panel; profiles.
- Main process owns `node-hid`; renderer = React/Svelte. Handle macOS Input Monitoring UX.

## Phase 5 — Multi-variant + release
- Add other variants by PID (standard RMK, C64, NES, Retro 108…), each protocol-confirmed.
- `electron-builder` CI: signed macOS / Windows / Linux builds. Docs, GPL-3.0 compliance.

## Risks
1. ~~macOS HID access~~ — RESOLVED (Phase 0).
2. ~~N Edition protocol == standard RMK~~ — RESOLVED (Phase 0).
3. ~~Super Buttons unreachable~~ — single-key maps work now; only chords/macros
   need the Windows capture — Phase 3.
4. TS port fidelity — mitigated by golden-byte tests (Phase 2).
