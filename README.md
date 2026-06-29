# Reverse-engineered 8BitDo keyboard configurator

Cross-platform configurator for **8BitDo Retro Mechanical Keyboards** — including the
**N Edition**. Talks to the keyboard's vendor HID interface directly from
userland (no Wine, no kernel extension, no entitlement).

> Status: **working MVP**. Validated end-to-end on real hardware (N Edition, macOS):
> reading config and remapping keys both work. See [PLAN.md](./PLAN.md).

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

Remapping a key (3 steps — all three are required):
```sh
node src/cli.ts map capslock esc   # 1. store the mapping
node src/cli.ts profile create main # 2. name the profile -> persists+activates on the keyboard
#                                     3. press the keyboard's Profile (heart) button so its LED is ON
```
**Gotcha:** an *unnamed* profile lives only on the PC, and even a named profile only
applies while the **Profile button toggle is ON** (LED lit). Press it again to fall
back to the factory-default layout. Revert a map with `map capslock capslock`, or wipe
the profile with `profile delete`.

Example `status` output:
```
8BitDo connected: yes
Config interface: 8BitDo Retro Keyboard pid=0x5200 iface=2 usagePage=0x8c
Profile name: main
Remapped keys (1): capslock
    capslock -> esc
```

## Examples / recipes

Every recipe below still needs the same final two steps as above: name a profile
(`profile create <name>`) and toggle the **Profile (heart) button LED ON**. They're
omitted from each snippet for brevity.

Inspect first, then map:
```sh
node src/cli.ts list-keys          # what can I map FROM and TO?
node src/cli.ts get capslock       # what is one key currently mapped to?
```

### Map a key to a modifier + key chord — e.g. Super A → ⌘+F13
This is the marquee use case: the on-board **Super A** key (`supera`) becomes a
single press that emits **⌘+F13**, a chord nothing else uses — perfect as a global
hotkey for dictation (Wispr Flow), Raycast, an Automator/Shortcuts trigger, etc. No
Karabiner, all firmware-side.
```sh
node src/cli.ts map-combo supera cmd f13     # Super A  -> ⌘+F13
node src/cli.ts profile create main          # then: persist + press the Profile button
```
More chord examples:
```sh
node src/cli.ts map-combo superb ctrl space  # Super B -> ⌃Space (e.g. Spotlight/IME)
node src/cli.ts map-combo capslock cmd q      # Caps Lock -> ⌘Q
node src/cli.ts map-combo a opt 5            # any key works as the source, too
```
**Modifier aliases** (first arg after the source key):

| alias | modifier | | alias | modifier |
|---|---|---|---|---|
| `cmd` / `command` / `win` / `gui` | Left ⌘ | | `rcmd` | Right ⌘ |
| `opt` / `option` / `alt` | Left ⌥ | | `ropt` | Right ⌥ |
| `ctrl` / `control` | Left ⌃ | | `rctrl` | Right ⌃ |
| `shift` | Left ⇧ | | `rshift` | Right ⇧ |

The third arg (the key) must be a normal key, not another modifier — `f13`, `space`,
`q`, `5`, etc. Run `list-keys` for the full target list.

### The on-board Super keys
`supera` (hardware code `0x6d`) and `superb` (`0x6c`) are normal mappable hardware
keys — treat them like any other source in `map`, `map-combo`, or `map-hid`. (These
are distinct from the *external* 3.5mm Super-Button accessories, which use a separate
protocol — see [SUPER-BUTTON-PROTOCOL.md](./SUPER-BUTTON-PROTOCOL.md).)
```sh
node src/cli.ts map supera esc               # plain remap, no modifier
node src/cli.ts map-combo supera cmd f13     # or a chord, as above
```

### Map to a raw HID usage (escape hatch)
When a target isn't in the `list-keys` table, write the HID usage bytes directly.
The chord encoding is `07 <modifier-usage> <key-usage>`:
```sh
node src/cli.ts map-hid supera 07 e3 68      # ⌘(e3) + F13(68) — same as map-combo supera cmd f13
node src/cli.ts map-hid capslock 00 00 29    # plain key, no modifier (29 = Esc)
```

### Undo / revert
```sh
node src/cli.ts map capslock capslock        # map a key back to itself
node src/cli.ts profile delete               # wipe the profile -> back to factory layout
#                                              or just press the Profile button to toggle the LED off
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
