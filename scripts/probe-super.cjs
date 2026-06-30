// READ-ONLY probe for the external Super-Button (Advance) transport on macOS.
//
// Background: the Advance protocol uses report ID 0x81 with 64-byte reports.
// PLAN.md/SUPER-BUTTON-PROTOCOL.md parked the work on a "transport gap": the
// macOS config interface (#2, usage page 0x8c) declares only 32-byte reports,
// so the doc *inferred* a 64-byte 0x81 report "can't be delivered".
//
// Two things make that worth retesting on macOS WITHOUT a Windows capture:
//   1. 8BitDoAdvance.dll links the SAME hidapi node-hid wraps (hid_write /
//      hid_open_path / hid_read_timeout) -> node-hid is byte-equivalent.
//   2. The doc never actually *tried* (a) a 64-byte 0x81 OUTPUT write, nor
//      (b) FEATURE reports (HidD_SetFeature/GetFeature also appear in the DLL),
//      whose length is independent of the declared 32-byte output report.
//
// This script ONLY sends the non-mutating readSuper command (cmd 0x11) and
// performs feature-report GETs. It NEVER sends write/delete/recognize
// (0x12/0x15/0x17). Safe to run against the keyboard (power switch OFF, USB-C).

const HID = require('node-hid');

const VID = 0x2dc8;
const PIDS = [0x5200, 0x5209];
const hex = (b) => Buffer.from(b).toString('hex');

// Advance packet: [reportID,0x04,cmd,subcmd,dataLen,checksum,offset(4 LE),data...]
// readSuper (0x11) with no args: everything after the header is zero.
function advancePacket(cmd, totalLen) {
  const p = new Array(totalLen).fill(0);
  p[0] = 0x81; // report ID
  p[1] = 0x04; // prefix/type for the keyboard PID family
  p[2] = cmd;  // 0x11 = readSuper (NON-MUTATING)
  // subcmd, dataLen, checksum, offset, data all 0
  return p;
}

function listCollections() {
  const all = HID.devices().filter(
    (d) => d.vendorId === VID && PIDS.includes(d.productId ?? -1),
  );
  console.log(`=== ${all.length} keyboard HID collection(s) ===`);
  for (const d of all) {
    console.log(
      JSON.stringify({
        product: d.product,
        pid: '0x' + (d.productId ?? 0).toString(16),
        interface: d.interface,
        usagePage: '0x' + (d.usagePage ?? 0).toString(16),
        usage: '0x' + (d.usage ?? 0).toString(16),
        path: d.path,
      }),
    );
  }
  return all;
}

function tryOutput81(d) {
  console.log(`\n--- OUTPUT 0x81 readSuper on iface=${d.interface} usagePage=0x${(d.usagePage ?? 0).toString(16)} ---`);
  for (const len of [64, 65, 32, 33]) {
    let h;
    try {
      h = new HID.HID(d.path);
    } catch (e) {
      console.log(`  open fail: ${e.message}`);
      return;
    }
    try {
      const pkt = advancePacket(0x11, len);
      const n = h.write(pkt);
      let resp = [];
      try { resp = h.readTimeout(300); } catch {}
      console.log(`  len=${len} write=${n}B resp(${resp.length})=${hex(resp).slice(0, 64) || '<none>'}`);
    } catch (e) {
      console.log(`  len=${len} write ERROR: ${e.message}`);
    } finally {
      try { h.close(); } catch {}
    }
  }
}

function tryFeature81(d) {
  console.log(`\n--- FEATURE 0x81 on iface=${d.interface} usagePage=0x${(d.usagePage ?? 0).toString(16)} ---`);
  let h;
  try {
    h = new HID.HID(d.path);
  } catch (e) {
    console.log(`  open fail: ${e.message}`);
    return;
  }
  try {
    // GET feature on report 0x81 (non-mutating) at a few candidate lengths.
    for (const len of [64, 65, 33]) {
      try {
        const r = h.getFeatureReport(0x81, len);
        console.log(`  getFeature(0x81,${len}) = (${r.length}) ${hex(r).slice(0, 64)}`);
      } catch (e) {
        console.log(`  getFeature(0x81,${len}) ERROR: ${e.message}`);
      }
    }
    // SET feature with the readSuper command, then GET to see if state appeared.
    try {
      const n = h.sendFeatureReport(advancePacket(0x11, 64));
      console.log(`  sendFeature readSuper = ${n}B`);
      const r = h.getFeatureReport(0x81, 64);
      console.log(`  getFeature after send = (${r.length}) ${hex(r).slice(0, 64)}`);
    } catch (e) {
      console.log(`  sendFeature readSuper ERROR: ${e.message}`);
    }
  } finally {
    try { h.close(); } catch {}
  }
}

function main() {
  const all = listCollections();
  if (all.length === 0) {
    console.log('\nNo keyboard found. Connect via USB-C with the power switch OFF.');
    return;
  }
  // Probe every vendor-ish collection, not just interface #2: the Advance path
  // may open a different usage page/collection we never tried.
  for (const d of all) {
    if (!d.path) continue;
    tryOutput81(d);
    tryFeature81(d);
  }
  console.log('\nDone. Any non-empty 0x81 response on ANY collection closes the transport gap.');
}

main();
