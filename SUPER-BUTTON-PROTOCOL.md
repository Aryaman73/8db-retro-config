# External Super-Button Protocol — reverse-engineering notes

Status: **protocol decoded; macOS transport not yet closed.** This documents how the
8BitDo external "Super Button" accessories (the big circular A/B buttons that plug
into the keyboard's 3.5mm jack) are programmed, reverse-engineered from the official
software. It is the missing piece neither upstream nor anyone public had documented.

## TL;DR

- The external Super Buttons are **not** the same as the on-board Super A/B keys
  (`supera` 0x6d / `superb` 0x6c). They are a separate, **UUID-addressed** accessory
  store, programmed over a **different command family** than the legacy `0x52` key-map
  protocol — which is exactly why every `0x52`-channel scan came up empty.
- We recovered the entire command set, packet format, checksum, and data model.
- The blocker is a **HID transport detail**: the protocol uses **64-byte reports on
  report ID `0x81`**, but the keyboard's macOS-visible config interface only declares
  **32-byte** reports (`0x51`/`0x52`/`0xb2`). Closing that last gap cleanly needs a
  short USB capture of the Windows app talking to this keyboard.

## Where this came from

The canonical configurator for this keyboard is **8BitDo Ultimate Software V2
(Windows, V1.33)** — a .NET (WPF/CoreCLR) app. Decompiled on macOS with `ilspycmd`
(managed) + `radare2` (native). The macOS "Ultimate Software V2.app" is a separate
native Swift app that gate-keeps the N Edition out at device-recognition, but its
`S68KBSuperKeyExtenseVC` confirms the same model.

- Managed namespace: `AdvanceSuper.*`. Keyboard driver: `AdvanceSuper.Advances.JP68Advance`
  (internal codename **JP68 / S68** = the Retro Mechanical Keyboard).
- The super-button calls are `[DllImport("8BitDoAdvance.dll")]` P/Invokes into the
  **native** `8BitDoAdvance.dll` (PE32 x86), which builds the HID reports.

## Command set (from `8BitDoAdvance.dll` exports)

| export | cmd byte | operation |
|---|---|---|
| `readSuper` / `readSuperFormIndex` | `0x11` | read super-button mappings |
| `writeSuper` / `writeAllSuper`     | `0x12` | write super-button mapping(s) |
| `DeleteSuper`                      | `0x15` | delete accessory mapping |
| `RecogSuper`                       | `0x17` | recognize/bind an accessory |
| `getSuperIndex`                    | `0x19` | look up an accessory's slot index by uuid |

## Packet format

Built by `fcn.10401180` (payload) + `fcn.10404f30` (framing) + `WriteHidAdvance`
(`fcn.1043cb20`, a 64-byte `WriteFile`):

```
[ reportID, 0x04, cmd, subcmd, dataLen, checksum, offset(4 bytes, LE), data... ]
   ^0x81     ^prefix/type           ^Σ(data)&0xff
```

- `reportID` = `0x81` (set unconditionally in `fcn.10404f30`; a couple of unrelated
  controller PIDs use `0x44`/`0x84`, but for the keyboard PID family it's `0x04` as the
  second byte).
- `dataLen` is capped at `0x35` (53); total report is 64 bytes, zero-padded.
- `checksum` = sum of the `data` bytes, low byte.

## Data model (from the managed structs)

```c
enum KEYBOARD_MAPPING_TYPE { NONE, KEYCODE, MKEY, MOUSE, MACRO, KEYSCODE, OTHER_KEYS };

struct KEYBOARD_MAPPING {            // one button -> one action
    byte keyCode;                    // which button (A=0,B=1,X=2,Y=3 within an accessory)
    uint mapping;                    // target HID usage / keycode
    KEYBOARD_MAPPING_TYPE mappingType;
};

struct PAT_KEYBOARD_MAPPING_INFO {   // one accessory
    uint  flag;
    uint  uuid;                      // <-- accessory is addressed by UUID
    ushort bt_addr_hi, reserve;
    byte  DeviceType, KeyCount, connectStatus, DevIndex;
    KEYBOARD_MAPPING keyboard_mappings[4];   // its buttons (A/B/X/Y)
};

// writeSuper takes PAT_KEYBOARD_MAPPING_INFOS = PAT_KEYBOARD_MAPPING_INFO[8]  (8 chained accessories)
```

The on-board keyboard layout uses a separate index enum `MAP_KEYBOARD_E`
(`MAP_L_CTRL=0, MAP_L_ALT=2, MAP_L_WIN=3, MAP_R_ALT=6, MAP_R_WIN=7, MAP_SUPER_A=9,
MAP_SUPER_B=10, MAP_A=12, ... MAP_MAX=116`).

## macOS transport — the open gap

Ground truth — decoded the **real** HID report descriptors macOS exposes for the
keyboard (`scripts/hid-descriptors.py`, parsed straight from IOKit). PID `0x5200`
presents exactly three HID collections:

```
collection A (vendor)     : reportID 0x03 INPUT 5B
collection B (the keyboard): 0x01 IN 8B / 0x01 OUT 1B / 0x02 / 0x06 / 0x0a / 0x0c / 0x11
                             (boot kbd + consumer + system) — userland open refused
collection C (vendor cfg) : 0x51 OUT 32 / 0x52 OUT 32 / 0xb2 OUT 32
                            0x54 IN 32 / 0xb1 IN 32      <- the channel we use
```

- **Report ID `0x81` and any 64-byte report are absent from EVERY collection.** Confirmed
  empirically, not inferred. (The earlier ioreg pass turned up a `0x81`/64-byte report and
  a descriptor full of "super-key" usages, but both were Apple devices — the Internal
  Keyboard and a Magic Trackpad — not the 8BitDo. Ruled out.)
- Probing the unused 32-byte channels: `0xb2` is silent; `0x51`/`0x52` with the Advance
  framing only hit legacy commands (`[0x52,0x04,...]` is just **cmd `0x04` = get FW
  version**, which returns `"1.7.7r"` — confirming the keyboard is alive and on 1.7.7).

### 2026-06-30 update — empirically retested on macOS (no Windows capture)

The earlier claim "*64-byte `0x81` reports can't be delivered on macOS*" was an
inference from the report descriptor. We tested it directly with `node-hid`
(`scripts/probe-super.cjs`, `scripts/probe-super2.cjs`) against the connected keyboard:

- **Delivery works.** `hid_write` of a 64-byte report-ID-`0x81` output report on the
  `0x8c` interface **succeeds** (returns 64) and the device **responds** with
  `54 e4 09` on the legacy `0x54` input channel. So `0x81` *is* deliverable on macOS.
- **But the `0x8c` interface does not process Advance commands.** The response is a
  **uniform `54 e4 09` for *any* `0x81` report** — valid `readSuper` (`0x11`),
  `getSuperIndex` (`0x19`), and even a deliberately malformed `[0x81,0x80]` frame all
  return byte-identical `54 e4 09`. The legacy ATTN handshake by contrast returns
  `54 e4 08` (= OK). So `e4 09` is the legacy module's generic "report ID I don't
  handle" ack — the Advance protocol is **not** served on this `0x8c` channel.
- **Feature reports are not the channel** either: `getFeatureReport(0x81, …)` fails
  ("could not get feature report") on every collection.
- **Enumeration (macOS):** PID `0x5200` exposes only iface 0 (`0x1` boot kbd),
  iface 1 (`0x1`/`0xc` the protected keyboard — refuses to open), iface 2 (`0x8c`
  vendor cfg). There is **no separate vendor collection** for the Advance/`0x81`
  channel visible on macOS.

### Static RE corroboration (no hardware/Windows needed)

`8BitDoAdvance.dll` **statically links hidapi** — the exact library `node-hid` wraps
(`hid_enumerate` / `hid_open_path` / `hid_write` / `hid_read_timeout`). So a faithful
macOS port is possible *if* we can reach the right collection. Confirmed in the binary:
the Advance/FWU report size is **64** (`push 0x40` into both `hid_write` and
`hid_read_timeout`, 1000 ms timeout). The opener at `fcn.1043fe90` (`SSwitchHid.cpp`,
under `8BitDoFirmwareUpdaterTools`) filters `product_id` (`word [eax+6]`) against
**`0x2009`/`0x2019`** — i.e. the **bootloader/DFU** PIDs, *not* the keyboard's
`0x5200`. So that is the firmware-updater mode-switch path, **not** the super-button
opener; the super-button open path (filtering `0x5200`) is a separate, not-yet-traced
function. `RTKHIDKit.dll` is a Realtek LE-Audio/CFU component — unrelated.

### Conclusion (2026-06-30)

The external Super-Button **accessory was physically connected the entire time** these
probes ran, yet `readSuper` over the `0x8c` channel returns nothing but the generic
`e4 09` ack — so "empty store" is **ruled out**; the `0x8c` vendor interface genuinely
does not serve the Advance protocol. Combined with the descriptor ground truth (no
`0x81`/64-byte report on any collection) and iface 1 refusing to open from userland,
the Advance super-button channel is **not reachable from macOS userland HID** as the
keyboard currently enumerates. The original "32- vs 64-byte report" framing was
incomplete: the deeper issue is *which interface serves Advance*, and it isn't the one
we can open. Leading hypothesis: Advance rides the **protected keyboard interface (#1)**
or a collection macOS doesn't expose openably — consistent with Phase 0's finding that
iface 1 refuses userland opens.

### To finish (when revisiting), in order of preference

1. **Trace the `0x5200` super-button opener** in `8BitDoAdvance.dll` (from the
   `readSuper`/`writeSuper` exports down to its `hid_open_path`) to learn which
   interface/usage it opens. The two `0x5200` sites found so far (`0x10435806`,
   `0x104381e0`) are VID/PID *model-dispatch* tables, not the HID-open filter — the
   open routine is deeper in the JP68/S68 driver. This is the cleanest no-Windows path.
2. **USB capture** (USBPcap + Wireshark on Windows) of V1.33 mapping one external
   button — still the definitive answer, but a last resort given the no-Windows preference.

## Current workaround (in use)

The **on-board Super A** key (`supera` 0x6d) is mapped to **⌘+F13** via the legacy
profile protocol and drives Wispr Flow dictation today — no external accessory or
Karabiner needed. See `PLAN.md` Phase 3.
