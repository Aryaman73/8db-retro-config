# 8bitdo-kbd

Cross-platform configurator for **8BitDo Retro Mechanical Keyboards** — including the
**N Edition**, which the official macOS software refuses to support despite being
identical hardware. Talks to the keyboard's vendor HID interface directly from
userland (no Wine, no kernel extension, no entitlement).

> Status: **early**. Phase 0 (recon) is complete and validated on real hardware on
> macOS. Reading config works; the remap *write* path is implemented but not yet
> hardware-tested. See [PLAN.md](./PLAN.md).

## Requirements
- Node **≥ 23** (runs the TypeScript sources natively; tested on Node 26).
- The keyboard connected via **USB-C with the power switch OFF** (= wired/config mode).

## Quick start
```sh
npm install
node src/cli.ts status      # read current profile + remapped keys (READ-ONLY)
node src/cli.ts list-keys   # list hardware keys and mappable targets
node scripts/probe.cjs      # low-level: enumerate HID interfaces + open test
```

Example `status` output:
```
8BitDo connected: yes
Config interface: 8BitDo Retro Keyboard pid=0x5200 iface=2 usagePage=0x8c
Profile name: (none / default)
Remapped keys (0): (none)
```

## How it works
The keyboard exposes three USB interfaces; **interface #2** (HID usage page `0x8c`)
is a vendor config channel. Commands are HID reports whose first byte is the report
ID (`0x52` host→device, `0x54` device→host). The handshake is `ATTN` → read → command.
See `src/protocol/consts.ts` and `PLAN.md`.

## Layout
- `src/protocol/` — protocol constants + key/usage tables (`keys.ts` is generated).
- `src/device.ts` — find/open the config interface via `node-hid`.
- `src/client.ts` — protocol client (reads validated; writes implemented).
- `src/cli.ts` — CLI.
- `scripts/` — `probe.cjs` (HID diagnostics), `gen-keys.cjs` (regenerate `keys.ts`).
- `reference/` — upstream `keys.py` for provenance.

## Safety
Reading config is harmless. Remapping writes to a config area (reversible by factory
reset). **Firmware flashing is out of scope** — it's the only operation that can brick
the device. See [PLAN.md](./PLAN.md).

## Credits & license
Protocol and key tables derived from the GPL-3.0 project
[goncalor/8bitdo-kbd-mapper](https://github.com/goncalor/8bitdo-kbd-mapper).
This project is therefore **GPL-3.0-or-later**. See [NOTICE.md](./NOTICE.md).
