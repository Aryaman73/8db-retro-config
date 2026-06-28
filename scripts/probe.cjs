const HID = require('node-hid');

const VID = 0x2dc8;
const PID = 0x5200;

console.log('=== All 8BitDo HID interfaces (VID 0x2dc8) ===');
const devices = HID.devices().filter(d => d.vendorId === VID);
if (devices.length === 0) {
  console.log('No 8BitDo HID devices found. Is it plugged in via USB?');
}
for (const d of devices) {
  console.log(JSON.stringify({
    product: d.product,
    productId: '0x' + d.productId.toString(16),
    interface: d.interface,
    usagePage: '0x' + (d.usagePage ?? 0).toString(16),
    usage: '0x' + (d.usage ?? 0).toString(16),
    path: d.path,
  }, null, 0));
}

console.log('\n=== Open test (READ-ONLY: open + immediate close, no writes) ===');
for (const d of devices) {
  try {
    const h = new HID.HID(d.path);
    console.log(`OPEN OK   iface=${d.interface} usagePage=0x${(d.usagePage??0).toString(16)} usage=0x${(d.usage??0).toString(16)}`);
    h.close();
  } catch (e) {
    console.log(`OPEN FAIL iface=${d.interface} usagePage=0x${(d.usagePage??0).toString(16)} -> ${e.message}`);
  }
}
