// Minimal CLI. Run with Node 26 (native TS): `node src/cli.ts <command>`
import { findConfigDevice } from './device.ts';
import { Keyboard } from './client.ts';
import { HWKEY, USAGE } from './protocol/keys.ts';

function cmdStatus(): void {
  const info = findConfigDevice();
  console.log('8BitDo connected:', info ? 'yes' : 'no');
  if (!info) return;
  console.log(
    `Config interface: ${info.product} pid=0x${info.productId.toString(16)} iface=${info.interface} usagePage=0x${info.usagePage.toString(16)}`,
  );
  const kb = Keyboard.open();
  try {
    const profile = kb.getProfileName();
    console.log('Profile name:', profile ?? '(none / default)');
    const mapped = kb.getMappedKeys();
    console.log(`Remapped keys (${mapped.length}):`, mapped.length ? mapped.join(', ') : '(none)');
    for (const k of mapped) console.log(`    ${k} -> ${kb.getKeyMapping(k)}`);
  } finally {
    kb.close();
  }
}

function cmdListKeys(): void {
  console.log('Hardware keys:\n  ' + Object.keys(HWKEY).join(' '));
  console.log('\nMappable target keys:\n  ' + Object.keys(USAGE).join(' '));
}

function main(): void {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'status':
      cmdStatus();
      break;
    case 'list-keys':
      cmdListKeys();
      break;
    default:
      console.log('Usage: node src/cli.ts <status|list-keys>');
      console.log('  (map/map-hid are implemented in client.ts but not yet wired to the CLI — Phase 1)');
  }
}

main();
