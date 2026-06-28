// Minimal CLI. Run with Node 26 (native TS): `node src/cli.ts <command>`
import { writeFileSync, mkdirSync } from 'node:fs';
import { findConfigDevice } from './device.ts';
import { Keyboard } from './client.ts';
import { HWKEY, USAGE } from './protocol/keys.ts';

const hex = (a: number[]) => Buffer.from(a).toString('hex');

function cmdDump(label: string): void {
  const probeKeys = ['supera', 'superb', 'a', 'rightctrl', 'rightalt'];
  const kb = Keyboard.open();
  const lines: string[] = [];
  const out = (s: string) => {
    lines.push(s);
    console.log(s);
  };
  try {
    out(`# dump "${label}"  profile=${kb.getProfileName() ?? '(default)'}`);
    kb.rawMappedFrames().forEach((f, i) => out(`mapped_frame[${i}]: ${hex(f)}`));
    for (const k of probeKeys) out(`mapping ${k}(0x${HWKEY[k].toString(16)}): ${hex(kb.rawKeyMapping(k))}`);
  } finally {
    kb.close();
  }
  mkdirSync('captures', { recursive: true });
  writeFileSync(`captures/${label}.txt`, lines.join('\n') + '\n');
  console.log(`\nSaved -> captures/${label}.txt`);
}

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

function cmdGet(hwKey: string): void {
  const kb = Keyboard.open();
  try {
    console.log(`${hwKey} -> ${kb.getKeyMapping(hwKey)}`);
  } finally {
    kb.close();
  }
}

function cmdMap(hwKey: string, target: string): void {
  const kb = Keyboard.open();
  try {
    kb.mapKey(hwKey, target);
    console.log(`Mapped ${hwKey} -> ${target}. Verifying...`);
    console.log(`${hwKey} now reads: ${kb.getKeyMapping(hwKey)}`);
  } finally {
    kb.close();
  }
}

function cmdMapHid(hwKey: string, hex: string): void {
  const kb = Keyboard.open();
  try {
    const clean = hex.replace(/[\s:]/g, '');
    if (clean.length % 2 !== 0) throw new Error(`Hex must be whole bytes: ${hex}`);
    const bytes = clean.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
    kb.mapRawUsage(hwKey, bytes);
    console.log(`Mapped ${hwKey} -> HID ${clean} (${bytes.length} byte(s)).`);
    if (bytes.length === 3) console.log(`${hwKey} now reads: ${kb.getKeyMapping(hwKey)}`);
    else console.log('(multi-usage buffer; read-back only shows the first 3 bytes — verify physically)');
  } finally {
    kb.close();
  }
}

function cmdProfileCreate(name: string): void {
  const kb = Keyboard.open();
  try {
    kb.createProfile(name);
    console.log(`Created/activated profile "${name}". Stored maps are now live on the keyboard.`);
    console.log('Profile name now reads:', kb.getProfileName());
  } finally {
    kb.close();
  }
}

function cmdProfileDelete(): void {
  const kb = Keyboard.open();
  try {
    kb.deleteProfile();
    console.log('Deleted profile. Maps cleared; keyboard reverts to default.');
  } finally {
    kb.close();
  }
}

function main(): void {
  const [cmd, a, b] = process.argv.slice(2);
  switch (cmd) {
    case 'profile':
      if (a === 'create' && b) cmdProfileCreate(b);
      else if (a === 'delete') cmdProfileDelete();
      else console.log('Usage: profile create <name> | profile delete');
      break;
    case 'status':
      cmdStatus();
      break;
    case 'list-keys':
      cmdListKeys();
      break;
    case 'dump':
      cmdDump(a || 'dump');
      break;
    case 'get':
      if (!a) return void console.log('Usage: get <hardware-key>');
      cmdGet(a);
      break;
    case 'map':
      if (!a || !b) return void console.log('Usage: map <hardware-key> <target-key>');
      cmdMap(a, b);
      break;
    case 'map-hid':
      if (!a || !b) return void console.log('Usage: map-hid <hardware-key> <hex-usage>');
      cmdMapHid(a, b);
      break;
    default:
      console.log('Usage: node src/cli.ts <status|list-keys|get|map|map-hid|profile>');
  }
}

main();
