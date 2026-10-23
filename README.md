# Reverse-engineered 8BitDo keyboard configurator

Cross-platform configurator for **8BitDo Retro Mechanical Keyboards** — including the
**N Edition**. Talks to the keyboard's vendor HID interface directly from
userland (no Wine, no kernel extension, no entitlement).

> Status: **working MVP**. Validated end-to-end on real hardware (N Edition, macOS):
> reading config and remapping keys both work. See [PLAN.md](./PLAN.md).

## Web app
**[aryamans.me/8db-retro-config](https://aryamans.me/8db-retro-config/)**: the same
configurator in the browser, with no install. Click a key on the on-screen keyboard,
pick what it should send (optionally with one modifier), and save. It also covers the
external Super Buttons, naming or deleting the profile, and exporting/importing the
whole profile as a JSON file. Without the hardware, **Try
the demo** runs it against a simulated keyboard.

It talks to the keyboard directly over [WebHID](https://developer.mozilla.org/docs/Web/API/WebHID_API),
so it needs **Chrome, Edge, Arc or another Chromium browser** (Safari and Firefox
don't have WebHID). Chrome allows the vendor config interface (usage page `0x8c`)
because it only blocks keyboard, mouse and system-control collections. Same hookup as
the CLI: USB-C, power switch OFF.

Run it locally:
```sh
npm install
npm run dev        # http://localhost:5173 (localhost counts as secure, so WebHID works)
npm run build      # static site -> dist/
```
Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

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

### Limits & macOS gotchas (all confirmed on hardware)
- **One modifier per key, max.** Each mapping is a single `07 <mod> <key>` cell, so
  ⌘+F13 works but ⌃⌥⌘+F13 ("hyper") does not. Writing several cells via `map-hid` just
  keeps the first one. (Multi-modifier support is an open RE item — see PLAN.md.)
- **F21-F24 are invisible on macOS.** They're valid USB HID, but macOS never maps them,
  so apps like Rectangle or Raycast can't bind them.
- **F14/F15 change screen brightness on macOS**, even with a modifier held (⌃F14 still
  dims). Don't use them as targets. Physical ScrLk/Pause send F14/F15 by default.
- **Safe "spare" targets on a Mac: F13 and F16-F20**, bare or with one modifier.

### Example: nav cluster → Rectangle window thirds
Six spare hotkeys from the Insert/Home/PgUp/Delete/End/PgDn block, then bind them in
Rectangle:
```sh
node src/cli.ts map insert f16
node src/cli.ts map home f17
node src/cli.ts map pageup f18
node src/cli.ts map-combo delete ctrl f16
node src/cli.ts map-combo end ctrl f17
node src/cli.ts map-combo pagedown ctrl f18
```

### The on-board Super keys
`supera` (hardware code `0x6d`) and `superb` (`0x6c`) are normal mappable hardware
keys — treat them like any other source in `map`, `map-combo`, or `map-hid`. (These
are distinct from the *external* 3.5mm Super-Button accessories, which use a separate
protocol — see [SUPER-BUTTON-PROTOCOL.md](./SUPER-BUTTON-PROTOCOL.md). For the **custom profile**
(heart LED on) you don't need that protocol: see "External Super Buttons" above.)
```sh
node src/cli.ts map supera esc               # plain remap, no modifier
node src/cli.ts map-combo supera cmd f13     # or a chord, as above
```

### External Super Buttons (3.5mm jack) — in your custom profile
The external buttons are ordinary keys in the custom profile, just with hardware codes
that aren't in the key table. Address them by raw code:

| code | button (Dual Super Buttons pad) |
|---|---|
| `0x75` | left |
| `0x74` | right |

```sh
node src/cli.ts map-combo 0x75 cmd f19       # left external button  -> ⌘F19
node src/cli.ts map-combo 0x74 cmd f20       # right external button -> ⌘F20
node src/cli.ts profile create main          # then: Profile (heart) LED on
```
Same one-modifier limit as any other key. Unmapped, they send **nothing** while the
heart LED is on. (Fast Key Mapping on the keyboard only applies with the heart LED
*off*.)

The official app has **eight** Super Button slots (K1–K8). Only the first pair is
verified on hardware; the rest come from the app's own table:

| slots | codes |
|---|---|
| K1, K2 (pad 1, verified) | `0x74` right, `0x75` left |
| K3, K4 | `0x72`, `0x73` |
| K5, K6 | `0x70`, `0x71` |
| K7, K8 | `0x6e`, `0x6f` |

To check a slot's code, map it to a digit (`map 0x72 1`), press the button, and see
which digit it types.

### Map to a raw HID usage (escape hatch)
When a target isn't in the `list-keys` table, write the HID usage bytes directly.
The chord encoding is `07 <modifier-usage> <key-usage>`:
```sh
node src/cli.ts map-hid supera 07 e3 68      # ⌘(e3) + F13(68) — same as map-combo supera cmd f13
node src/cli.ts map-hid capslock 00 00 29    # plain key, no modifier (29 = Esc)
```

### Media and system keys
Besides `playpause`, `nextsong`, `previoussong`, `mute`, `volumeup`, `volumedown` and
`calc`, these come from the official app's target table: `brightnessdown`,
`brightnessup`, `mail`, `homepage`. Brightness keys work as bare targets on a Mac,
unlike F14/F15.
```sh
node src/cli.ts map scrlk brightnessdown
node src/cli.ts map pause brightnessup
```

### Back up, restore, or share a profile
```sh
node src/cli.ts export main.json   # profile name + every remapped key (or omit the file for stdout)
node src/cli.ts import main.json   # make the keyboard match it, then name the profile
```
The file is readable JSON: keys are hardware names (or raw codes like `0x75`), values
are the 3-byte mapping in hex (`"supera": "07e368"` = ⌘F13). Import resets remapped
keys the file doesn't mention, writes only keys that differ, and names the profile.
The web app's Export/Import buttons use the same format.

### Undo / revert
```sh
node src/cli.ts map capslock capslock        # map a key back to itself
node src/cli.ts profile delete               # wipe the profile -> back to factory layout
#                                              or just press the Profile button to toggle the LED off
```

## Verifying what a key actually sends
`scripts/hid-input-monitor.c` is a passive (non-seizing) IOHIDManager listener that
prints the HID usages a physical key emits — handy for confirming a mapping took
effect at the byte level. macOS may ask for **Input Monitoring** permission.
```sh
clang -framework IOKit -framework CoreFoundation scripts/hid-input-monitor.c -o /tmp/hid-mon
/tmp/hid-mon
```

## Tests
```sh
npm test
```
Golden-byte tests in `test/` run the protocol client against a fake HID device and
assert the exact reports it sends (map, chord, profile) and how it decodes replies.
`test/demo.test.ts` drives the web app's simulated keyboard with the real client.
No keyboard required.

## How it works
The keyboard exposes three USB interfaces; **interface #2** (HID usage page `0x8c`)
is a vendor config channel. Commands are HID reports whose first byte is the report
ID (`0x52` host→device, `0x54` device→host). The handshake is `ATTN` → read → command.
See `src/protocol/consts.ts` and `PLAN.md`.

## Layout
- `src/protocol/` — protocol constants + key/usage tables (`keys.ts` is generated).
- `src/protocol/usage.ts` — encode/decode mapping values (chords, display names).
- `src/profile.ts` — profile files: read, validate, and apply (CLI + web).
- `src/client.ts` — protocol client over a pluggable async `Transport` (reads
  validated; writes implemented). Shared by the CLI and the web app.
- `src/device.ts` — find/open the config interface via `node-hid` (CLI transport).
- `src/cli.ts` — CLI.
- `web/` — React + Vite web app: `webhid.ts` (WebHID transport), `demo.ts`
  (simulated keyboard), `keys.ts` (on-screen layout and labels).
- `test/` — golden-byte tests (`npm test`).
- `scripts/` — `probe.cjs` (HID diagnostics), `gen-keys.cjs` (regenerate `keys.ts`),
  `hid-input-monitor.c` (see what a key emits), and the Super-Button RE probes
  (`probe-super*.cjs`, `super-iokit.c`, `super-usb.c`, `super-capture.c`, `hid-descriptors.py`).
- `reference/` — upstream `keys.py` for provenance.

## Safety
Reading config is harmless. Remapping writes to a config area (reversible by factory
reset). **Firmware flashing is out of scope** — it's the only operation that can brick
the device. See [PLAN.md](./PLAN.md).

## Credits & license
Protocol and key tables derived from the GPL-3.0 project
[goncalor/8bitdo-kbd-mapper](https://github.com/goncalor/8bitdo-kbd-mapper).
This project is therefore **GPL-3.0-or-later**. See [NOTICE.md](./NOTICE.md).
