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

The keyboard's config interface (USB interface #2, **usage page `0x8c`**, the one we
program over with `node-hid`) declares these report IDs in its HID report descriptor:

```
outputs: 0x52 (legacy key-map, what we use), 0x51, 0xb2     ; all 32-byte
inputs : 0x54 (responses we read), 0xb1                     ; all 32-byte
```

- Report ID `0x81` is **not** declared, and these reports are **32-byte**, so the
  64-byte `0x81` Advance reports can't be delivered through this interface on macOS.
- Probing the unused 32-byte channels: `0xb2` is silent; `0x51`/`0x52` with the Advance
  framing only hit legacy commands (`[0x52,0x04,...]` is just **cmd `0x04` = get FW
  version**, which returns `"1.7.7r"` — confirming the keyboard is alive and on 1.7.7).
- The Windows app selects this transport at runtime from the connected device, so the
  exact report ID / interface it uses for *this* keyboard is the one detail static RE
  can't pin down.

### To finish (when revisiting)

A ~1-minute **USB capture** (USBPcap + Wireshark on Windows) of the V1.33 app while
mapping one external button reveals the real report ID, interface, and full byte
sequence — at which point this becomes a `map-super` command in `src/`. We now know
*exactly* what to look for (the `0x11`/`0x12` cmd bytes and the packet shape above).

## Current workaround (in use)

The **on-board Super A** key (`supera` 0x6d) is mapped to **⌘+F13** via the legacy
profile protocol and drives Wispr Flow dictation today — no external accessory or
Karabiner needed. See `PLAN.md` Phase 3.
