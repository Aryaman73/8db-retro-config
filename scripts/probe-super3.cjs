// READ-ONLY probe #3 for the external Super-Button (Advance) transport on macOS.
//
// NEW INSIGHT (from RE of the *native macOS* app "8BitDo Ultimate Software V2"):
// the app programs the S68 super buttons purely through FEATURE reports via
//   IOHIDDeviceSetReport(dev, kIOHIDReportTypeFeature=2, reportID=0x81, buf, 64)
//   usleep(1000)
//   IOHIDDeviceGetReport(dev, kIOHIDReportTypeFeature=2, reportID=0x81, buf, 64)
// i.e. SET_FEATURE then GET_FEATURE control transfers on report ID 0x81, len 64.
// This is NOT the interrupt OUT/IN path node-hid's write()/readTimeout() use.
//
// node-hid maps sendFeatureReport()->SetReport(Feature) and
// getFeatureReport()->GetReport(Feature), so we can replicate the app exactly.
// This script ONLY sends readSuper (cmd 0x11, NON-MUTATING). Safe to run.

const HID = require('node-hid');
const VID = 0x2dc8;
const hex = (b) => Buffer.from(b).toString('hex');
const sleep = (ms) => { const t = Date.now(); while (Date.now() - t < ms) {} };

// Advance packet: [reportID,0x04,cmd,subcmd,dataLen,checksum,offset(4 LE),data...]
function advancePacket(cmd, { subcmd = 0, dataLen = 0, offset = 0, data = [] } = {}) {
  const p = new Array(64).fill(0);
  p[0] = 0x81;          // report ID
  p[1] = 0x04;          // type/prefix for keyboard PID family
  p[2] = cmd;           // 0x11 readSuper (NON-MUTATING)
  p[3] = subcmd;
  p[4] = dataLen & 0xff;
  let sum = 0; for (const d of data) sum = (sum + d) & 0xff;
  p[5] = sum;
  p[6] = offset & 0xff;
  p[7] = (offset >> 8) & 0xff;
  p[8] = (offset >> 16) & 0xff;
  p[9] = (offset >> 24) & 0xff;
  for (let i = 0; i < data.length; i++) p[10 + i] = data[i];
  return p;
}

function main() {
  const all = HID.devices().filter((d) => d.vendorId === VID && d.productId === 0x5200);
  const iface2 = all.find((d) => d.usagePage === 0x8c);
  console.log('vendor collections:', all.map(d => `iface${d.interface}/up0x${(d.usagePage||0).toString(16)}`).join(' '));
  if (!iface2) { console.log('no 0x8c collection found'); return; }
  console.log('opening', iface2.path, '(iface', iface2.interface, 'usagePage 0x8c)');

  let h;
  try { h = new HID.HID(iface2.path); }
  catch (e) { console.log('open failed:', e.message); return; }

  // ---- Variant A: exact app sequence — SET_FEATURE readSuper, 1ms, GET_FEATURE 0x81 ----
  const readCmds = [
    ['readSuper 0x11 (len=0x35 off=0)', advancePacket(0x11, { dataLen: 0x35, offset: 0 })],
    ['readSuper 0x11 (len=0 off=0)',    advancePacket(0x11, {})],
    ['getSuperIndex 0x19',              advancePacket(0x19, {})],
  ];

  for (const [label, cmd] of readCmds) {
    console.log(`\n=== ${label} ===`);
    console.log('  TX:', hex(cmd).slice(0, 32), '...');
    try {
      const n = h.sendFeatureReport(cmd);
      console.log('  SET_FEATURE ->', n, 'bytes');
    } catch (e) {
      console.log('  SET_FEATURE ERROR:', e.message);
    }
    sleep(2);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = h.getFeatureReport(0x81, 64);
        console.log(`  GET_FEATURE[${attempt}] (${r.length}):`, hex(r).slice(0, 96));
      } catch (e) {
        console.log(`  GET_FEATURE[${attempt}] ERROR:`, e.message);
      }
      sleep(2);
    }
  }

  try { h.close(); } catch {}
  console.log('\nDone. A non-uniform, structured GET_FEATURE(0x81) reply = transport OPEN.');
}

main();
