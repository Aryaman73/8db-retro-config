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

## Phase 3 — Macros / chords  ✅ SINGLE-MODIFIER CHORDS SOLVED
- **CRACKED (no Windows capture needed):** the existing 3-byte mapping value is
  `07 <modifier-usage> <key-usage>`. A plain key leaves the modifier byte 00
  (`07 00 04` = a); a plain modifier leaves the key byte 00 (`07 e2 00` = LAlt);
  a CHORD fills both (`07 e3 76` = ⌘+F13). Verified on hardware: superb=`07 e3 04`
  physically fires ⌘+A. Implemented as `map-combo <key> <mod> <key>` / `mapChord()`.
- Open: multi-modifier chords (e.g. ⌃⌥⌘ hyper) — only one modifier byte slot is
  known; may need the 12-byte buffer (`0x0c` header) or extra slots. Single
  modifier+key covers the Wispr use case.
- Historic note (now moot for single-mod chords):
- **Finding:** the Super Buttons themselves (`supera` 0x6d, `superb` 0x6c) ARE
  remappable via the normal single-key MAP path — no special protocol needed for
  single-key assignments. What's NOT solved is **chords/macros** (e.g. ⌘+F13).
- **Disproven:** sending a MAP buffer of concatenated 3-byte usages (e.g.
  `07e300 070004` = GUI+A) does NOT chord — the keyboard honours only the FIRST
  usage and ignores the rest (verified: A Super emitted ⌘ only, not ⌘+A).
- **CONFIRMED chords are real:** hardware Fast-Key-Mapping programmed A Super =
  Win+P and it physically fires ⌘+P. So the firmware fully supports modifier+key
  on the Super buttons — the goal is achievable.
- **But the fast-key store is unreadable via our channel:** before/after diff after
  hardware-programming showed ZERO change across all known reads AND a safe scan of
  the entire 0x8x get/status family. The store sits outside the 0x52/0x54 channel
  (candidates: report-ID 0x51/0xB1 sub-protocol, or commands outside 0x8x).
- **Next options to read/write it in software:** (a) probe the 0x51/0xB1 report
  channel, (b) wider command scan (higher risk — must still exclude 0x70/0x76/0xfa/
  0xc1-c4), or (c) the Windows USBPcap capture (definitive).
- **Pragmatic off-ramp (no RE needed):** hardware Fast-Key-Mapping already writes
  arbitrary chords to the Super buttons. For the user's Wispr Flow need, just
  hardware-map a Super button to an unused "hyper" chord and bind the app to it.

## Phase 4 — Electron GUI
- Visual keyboard layout → click key → remap; Super Button panel; profiles.
- Main process owns `node-hid`; renderer = React/Svelte. Handle macOS Input Monitoring UX.

## Phase 5 — Multi-variant + release
- Add other variants by PID (standard RMK, C64, NES, Retro 108…), each protocol-confirmed.
- `electron-builder` CI: signed macOS / Windows / Linux builds. Docs, GPL-3.0 compliance.

## Risks
1. ~~macOS HID access~~ — RESOLVED (Phase 0).
2. ~~N Edition protocol == standard RMK~~ — RESOLVED (Phase 0).
3. ~~Super Buttons / chords unreachable~~ — RESOLVED. Single-key AND single-modifier
   chords work via the profile MAP command (`07 <mod> <key>`). No capture needed.
4. TS port fidelity — mitigated by golden-byte tests (Phase 2).
