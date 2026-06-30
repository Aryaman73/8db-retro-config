// READ-ONLY follow-up probe: interpret the 0x81 response on interface #2.
// Adds the legacy ATTN handshake, drains multiple input frames, and tries a
// couple of NON-MUTATING readSuper framings. Sends ONLY cmd 0x11 (read) and
// the ATTN handshake. Never 0x12/0x15/0x17/0x19-with-uuid.

const HID = require('node-hid');
const VID = 0x2dc8, PIDS = [0x5200, 0x5209];
const hex = (b) => Buffer.from(b).toString('hex');

const ATTN = [0x52, 0x76, 0xff];
const REPORT = 33; // legacy 32-byte report + id

function findCfg() {
  return HID.devices().find(
    (d) => d.vendorId === VID && PIDS.includes(d.productId ?? -1) && (d.usagePage ?? 0) === 0x8c,
  );
}
function pad(arr, n) { return arr.concat(Array(Math.max(0, n - arr.length)).fill(0)); }

function drain(h, label, n = 6) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    let r = [];
    try { r = h.readTimeout(250); } catch {}
    if (!r || r.length === 0) break;
    frames.push(hex(r));
  }
  console.log(`  ${label}: ${frames.length} frame(s)`);
  for (const f of frames) console.log(`     ${f}`);
  return frames;
}

function main() {
  const d = findCfg();
  if (!d) { console.log('No 0x8c config interface. Plug in (power OFF).'); return; }
  const h = new HID.HID(d.path);
  try {
    // Baseline: legacy handshake works?
    h.write(pad(ATTN, REPORT));
    drain(h, 'after ATTN handshake', 2);

    // Advance readSuper packet variants (all NON-MUTATING reads):
    // [0x81,0x04,cmd,subcmd,dataLen,checksum,offset(4 LE),data...]
    const variants = {
      'readSuper sub=00 len64':  pad([0x81, 0x04, 0x11, 0x00, 0x00, 0x00], 64),
      'readSuper sub=00 len33':  pad([0x81, 0x04, 0x11, 0x00, 0x00, 0x00], 33),
      'readSuperFromIndex sub=01': pad([0x81, 0x04, 0x11, 0x01, 0x00, 0x00], 64),
      'readSuper after ATTN':    null, // handled specially below
    };

    for (const [name, pkt] of Object.entries(variants)) {
      if (name === 'readSuper after ATTN') {
        h.write(pad(ATTN, REPORT));
        try { h.readTimeout(250); } catch {}
        const n = h.write(pad([0x81, 0x04, 0x11, 0x00, 0x00, 0x00], 64));
        console.log(`\n[${name}] wrote ${n}B (post-handshake)`);
        drain(h, 'resp');
        continue;
      }
      const n = h.write(pkt);
      console.log(`\n[${name}] wrote ${n}B`);
      drain(h, 'resp');
    }

    // Can we read an 0x81 INPUT report directly? (interface only declares 0x54/0xb1)
    try {
      const r = h.getFeatureReport(0x54, 33);
      console.log(`\ngetFeature(0x54,33) = ${hex(r)}`);
    } catch (e) { console.log(`\ngetFeature(0x54) ERR: ${e.message}`); }
  } finally {
    h.close();
  }
}
main();
