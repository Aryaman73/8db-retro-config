#!/usr/bin/env python3
# Dump the REAL HID report descriptors macOS exposes for the 8BitDo keyboard,
# decoded to (reportID, direction, size). This is ground truth for what report
# IDs / report sizes are actually reachable via node-hid on this Mac -- node-hid's
# HID.devices() only shows the top-level usage page/usage and hides report IDs.
#
# Usage: python3 scripts/hid-descriptors.py
# Requires the keyboard plugged in via USB-C (power switch OFF).

import subprocess, plistlib

VID = 0x2dc8  # 8BitDo

def collections():
    xml = subprocess.run(["ioreg", "-a", "-r", "-c", "IOHIDInterface", "-l"],
                         capture_output=True).stdout
    docs, buf = [], b""
    for line in xml.splitlines(keepends=True):
        buf += line
        if line.strip() == b"</plist>":
            try: docs.append(plistlib.loads(buf))
            except Exception: pass
            buf = b""
    out = []
    def walk(o):
        if isinstance(o, dict):
            if "ReportDescriptor" in o: out.append(o)
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    for d in docs: walk(d)
    return out

def parse(b):
    i = rid = rsize = rcount = 0
    items = []
    while i < len(b):
        pre = b[i]; i += 1
        if pre == 0xFE:  # long item
            i += 2 + b[i]; continue
        tag, typ, size = pre >> 4, (pre >> 2) & 3, pre & 3
        n = [0, 1, 2, 4][size]
        data = int.from_bytes(b[i:i + n], "little") if n else 0
        i += n
        if typ == 1:      # Global
            if tag == 0x7: rsize = data
            elif tag == 0x9: rcount = data
            elif tag == 0x8: rid = data
        elif typ == 0:    # Main
            d = {0x8: "INPUT", 0x9: "OUTPUT", 0xB: "FEATURE"}.get(tag)
            if d: items.append((rid, d, rsize, rcount))
    return items

def main():
    seen = set()
    any_found = False
    for f in collections():
        if f.get("VendorID") != VID:
            continue
        rd = bytes(f["ReportDescriptor"])
        key = (f.get("ProductID"), rd.hex())
        if key in seen: continue
        seen.add(key); any_found = True
        print(f"\n=== VID=0x{VID:04x} PID=0x{f.get('ProductID', 0):04x}  "
              f"descriptor {len(rd)}B ===")
        agg = {}
        for rid, d, sz, cnt in parse(rd):
            agg[(rid, d)] = agg.get((rid, d), 0) + sz * cnt
        for (rid, d), bits in sorted(agg.items()):
            print(f"  reportID 0x{rid:02x}  {d:7s}  {bits // 8} bytes")
    if not any_found:
        print("No 8BitDo (0x2dc8) HID collections found. Plug in via USB-C (power OFF).")
    else:
        print("\nNote: report ID 0x81 / 64-byte reports (the Advance super-button "
              "channel) are absent from every collection -> not reachable via node-hid.")

if __name__ == "__main__":
    main()
