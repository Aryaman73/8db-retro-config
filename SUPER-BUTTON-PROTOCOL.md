# External Super-Button Protocol — reverse-engineering notes

Status: **protocol decoded, but the keyboard doesn't speak it as it enumerates on
macOS.** The earlier "macOS driver wall" theory is **disproven** (2026-10-21): with
device capture we reach iface 2's interrupt endpoints directly from macOS, and the
firmware still rejects the Advance frame. See "2026-10-21 — device-capture test"
below. Reverse-engineered from the official **Windows** software (`8BitDoAdvance.dll`).

## 2026-10-21 — device-capture test (supersedes the "macOS driver wall")

`scripts/super-capture.c` uses libusb + macOS **device capture** (what UTM/VMware USB
passthrough use; needs `sudo`) to detach macOS's drivers and claim iface 2 — no
`kIOReturnExclusiveAccess`. Results, keyboard FW 1.7.7r:

- iface 2 endpoints: **`0x84` interrupt IN**, **`0x05` interrupt OUT**, both 64 B max packet.
- Report descriptor fetched **from the device** (not IOKit): the same 82 bytes macOS
  showed — in `0xb1`, `0x54`; out `0xb2`, `0x51`, `0x52`; all 32 B. No `0x81`, no `0x02`.
- Legacy channel over interrupt OUT works: `52 76 ff` → `54 e4 08`; `52 80` → profile "main".
- **Advance `readSuper` over interrupt OUT → `54 e4 09`** — the same reject as via
  IOHIDManager. So transport was never the problem.
- DLL cross-check: the keyboard-family path (`read68RRConnect` → `WriteHidAdvance68`)
  sends `[0x81, 0x04, cmd, …]` (64 B, report ID set by the caller) and expects replies
  starting `02 04 … cmd` — i.e. **out report `0x81`, in report `0x02`**, neither of
  which this keyboard declares here. Windows `WriteFile(64)` would also be illegal
  against this 32-byte descriptor.

**Conclusion:** as enumerated on this Mac, the N Edition's firmware does not expose
the Advance channel at all. Either it presents a different descriptor to Windows
(8BitDo firmware is known to detect the host OS), or this firmware/model doesn't
support the Advance path. Host-OS detection happens during enumeration, which macOS
performs, so it can't be spoofed from a Mac. **The Windows VM is the only remaining
route** — and it settles both questions (watch the guest's descriptor for `0x81`/`0x02`).

Untested on purpose: the undocumented `0xb2`/`0xb1` and `0x51` reports. Nothing ties
them to super buttons, and blind writes on an unknown channel risk hitting
firmware/DFU commands.

## TL;DR

- The external Super Buttons are **not** the same as the on-board Super A/B keys
  (`supera` 0x6d / `superb` 0x6c — those are already programmable today; Super A drives
  Wispr). They are a separate, **UUID-addressed** accessory store, programmed over a
  **different command family** than the legacy `0x52` key-map protocol.
- We recovered the entire command set, packet format, checksum, and data model. The
  keyboard's transport is a **64-byte report `0x81` on iface 2** (usagePage `0x8c`),
  delivered by Windows via `WriteFile`/`ReadFile` = the **interrupt OUT/IN endpoints**.
  Framing `[0x81, 0x04, cmd, sub, len, Σ&0xff, offset(4 LE), data…]`.
- ~~**The blocker is the macOS driver model.**~~ *(Disproven 2026-10-21 — see above.)* Iface 2 has the interrupt OUT endpoint,
  but macOS's `AppleUserHIDDevice` dext claims the interface **exclusively**
  (`super-usb.c` → `USBInterfaceOpen`/`Seize` both return `kIOReturnExclusiveAccess`
  `0xe00002c5`), and the only userland HID API (`IOHIDManager`) reaches just the
  **control** endpoint — which the firmware does not route to the Advance handler
  (control `0x81` gets the reject `54 e4 09`). So `node-hid`/IOKit cannot reach this
  channel on this Mac. See "macOS transport — DIAGNOSED" below.
- **Ways to actually get it done (no physical Windows box):** run the Windows app in a
  **USB-passthrough VM** (UTM/VMware Fusion) — config persists in firmware, so the
  buttons then work natively on macOS; or write a custom **DriverKit dext** that claims
  iface 2 and drives the interrupt-OUT pipe (`super-usb.c` has the pipe logic ready).

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

## macOS transport — 2026-07-06 diagnosis (SUPERSEDED by the 2026-10-21 capture test)

Grounded in the **Windows DLL** (`8BitDoAdvance.dll`), which is the reference that
actually supports the N Edition. (An earlier pass leaned on the *macOS* app
`S68KBSuperKeyExtenseVC` for the transport — but that app targets a **different**
8BitDo keyboard and its Feature/`0x81` convention may not match the N Edition, so it
is treated as non-authoritative here.)

### 1. Which interface — the reachable `0x8c`

The *actual* super-button opener is `Open_Hid`/`Open_Hid68` (`fcn.10439690` /
`fcn.104394c0`), opening a path from the enumerated array `0x10c56de8[]`. The
enumerator (`fcn.10435550`) matches `(PID, usagePage, usage)`; for **PID `0x5200`**
it requires **usagePage `0x8c`, usage `1`** — exactly **iface 2**, the vendor-config
collection we already open from userland. So the old "Advance rides the protected
keyboard interface #1" hypothesis is **disproven**. (The `SSwitchHid`/`0x2009`/`0x2019`
opener is the DFU path, unrelated.)

### 2. Which transport — 64-byte report `0x81` over the INTERRUPT endpoints

For the keyboard (JP68/S68), both the generic path (`readSuper`/`writeSuper` →
framing `fcn.10404f30`, `WriteHidAdvance`) and the JP68-specific path
(`WriteHidAdvance68`/`ReadHidAdvance68`, handles from `Open_Hid68`) do a **raw 64-byte
`WriteFile` / overlapped `ReadFile`** on the HID handle. On Windows, `WriteFile`/
`ReadFile` on a HID handle use the **interrupt OUT / interrupt IN endpoints**. Wire
framing: `[0x81, 0x04, cmd, sub, len, Σ&0xff, offset(4 LE), data…]`, report ID `0x81`.

### 3. The macOS wall — the interrupt OUT endpoint is unreachable from userland

Interface 2 physically **has** the needed endpoints (ioreg: `bNumEndpoints = 2` on
iface 2; iface 0/1 have 1 each — an interrupt IN + interrupt OUT). But:

- **macOS HID (`IOHIDManager`) only exposes the CONTROL endpoint** (`SET_REPORT`/
  `GET_REPORT`), never the interrupt OUT pipe. Delivering the 64-byte `0x81` command
  over control `SET_REPORT` reaches the device but the firmware does **not** route it
  to the Advance handler — you get the uniform legacy reject `54 e4 09` (Output path)
  / an ACK-and-drop (Feature path). The Advance handler evidently only services the
  **interrupt OUT** endpoint that Windows' `WriteFile` targets.
- **Raw USB to the interrupt OUT pipe is blocked.** `scripts/super-usb.c` opens the
  keyboard's iface 2 via `IOUSBLib` and tries to write its interrupt-OUT pipe
  directly (the exact Windows transport). `USBInterfaceOpen` **and**
  `USBInterfaceOpenSeize` both return **`0xe00002c5` = `kIOReturnExclusiveAccess`**:
  macOS's `AppleUserHIDDevice` dext claims iface 2 **exclusively**, so no userland
  process can take the pipe.
- **The HID descriptor doesn't help either.** The `0x8c` collection's report
  descriptor (82 B, decoded byte-for-byte) declares only **32-byte** reports
  (`0xb1/0x54` IN, `0xb2/0x51/0x52` OUT) — **no `0x81`, no Feature, nothing 64-byte**.
  For the Windows `WriteFile(64)` to be legal, the unit must present a 64-byte report
  to Windows; macOS sees only 32-byte. Whether that's an OS-conditional descriptor or
  a firmware/variant difference can only be settled by observing the Windows-side
  enumeration.

### Conclusion — blocked by the macOS driver model, not by our code

The protocol is fully known. The transport is 64-byte `0x81` on iface 2's **interrupt
OUT/IN endpoints**. On macOS those endpoints are owned exclusively by the kernel HID
driver, and the only userland HID API (`IOHIDManager`) can reach just the control
endpoint, which the firmware doesn't route to the Advance handler. So a pure
`node-hid`/IOKit port **cannot** reach this channel on this Mac. This is a macOS
USB/HID driver-model wall, independent of protocol correctness.

### Options to actually get it done (no physical Windows box)

*(2026-10-21: option 2 is moot — a dext would only reach the same endpoint the capture
test already reached, and the firmware rejects the frame there. Option 1 remains.)*

1. **Windows in a USB-passthrough VM** (UTM on Apple Silicon, or VMware Fusion —
   both free). Pass the keyboard through, run 8BitDo Ultimate Software V2, configure
   the super buttons. The config **persists in the keyboard's firmware**, so the
   buttons then work natively on macOS afterward — no Karabiner, no physical Windows
   machine. This is also the way to (a) confirm whether the N Edition exposes the
   64-byte `0x81` channel to Windows and (b) capture the exact bytes (Wireshark +
   USBPcap) if a native port is still wanted.
2. **A custom macOS DriverKit extension (dext)** that claims iface 2 instead of
   `AppleUserHIDDevice` and writes the interrupt-OUT pipe — this is the only way to do
   the transport *natively* on macOS. Large effort; needs a signed dext. `super-usb.c`
   already has the exact pipe-write logic that a dext would run once it owns the pipe.
3. **Plug the physical external Super Button into the jack, re-run
   `python3 scripts/hid-descriptors.py`** to check whether the accessory makes the
   keyboard re-enumerate with a `0x81`/64-byte report (unlikely to change the
   endpoint-claim wall, but cheap to check).

## Current workaround (in use)

The **on-board Super A** key (`supera` 0x6d) is mapped to **⌘+F13** via the legacy
profile protocol and drives Wispr Flow dictation today — no external accessory or
Karabiner needed. See `PLAN.md` Phase 3.
