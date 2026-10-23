// Minimal CLI. Run with Node 26 (native TS): `node src/cli.ts <command>`
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { findConfigDevice, openKeyboard } from './device.ts';
import { HWKEY, USAGE } from './protocol/keys.ts';
import { applyProfile, parseProfile, readProfile, toFile } from './profile.ts';

const hex = (a: number[]) => Buffer.from(a).toString('hex');

async function cmdDump(label: string): Promise<void> {
  const probeKeys = ['supera', 'superb', 'a', 'rightctrl', 'rightalt'];
  const kb = openKeyboard();
  const lines: string[] = [];
  const out = (s: string) => {
    lines.push(s);
    console.log(s);
  };
  try {
    out(`# dump "${label}"  profile=${await kb.getProfileName() ?? '(default)'}`);
    (await kb.rawMappedFrames()).forEach((f, i) => out(`mapped_frame[${i}]: ${hex(f)}`));
    for (const k of probeKeys) out(`mapping ${k}(0x${HWKEY[k].toString(16)}): ${hex(await kb.rawKeyMapping(k))}`);
  } finally {
    await kb.close();
  }
  mkdirSync('captures', { recursive: true });
  writeFileSync(`captures/${label}.txt`, lines.join('\n') + '\n');
  console.log(`\nSaved -> captures/${label}.txt`);
}

async function cmdStatus(): Promise<void> {
  const info = findConfigDevice();
  console.log('8BitDo connected:', info ? 'yes' : 'no');
  if (!info) return;
  console.log(
    `Config interface: ${info.product} pid=0x${info.productId.toString(16)} iface=${info.interface} usagePage=0x${info.usagePage.toString(16)}`,
  );
  const kb = openKeyboard();
  try {
    const profile = await kb.getProfileName();
    console.log('Profile name:', profile ?? '(none / default)');
    const mapped = await kb.getMappedKeys();
    console.log(`Remapped keys (${mapped.length}):`, mapped.length ? mapped.join(', ') : '(none)');
    for (const k of mapped) console.log(`    ${k} -> ${await kb.getKeyMapping(k)}`);
  } finally {
    await kb.close();
  }
}

// Read-only scan of the 0x8x get/status command family, with arg variants for
// the Super keys. EXCLUDES every known mutating command (0x70 del/rename, 0x76
// attn/done, 0xfa map, 0xc1-c4 firmware) — only safe queries are sent.
async function cmdScan(label: string): Promise<void> {
  const SAFE_CMDS = [0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f];
  const ARGS: Array<{ tag: string; arg: number[] }> = [
    { tag: 'none', arg: [] },
    { tag: 'superA', arg: [0x6d] },
    { tag: 'superB', arg: [0x6c] },
  ];
  const kb = openKeyboard();
  const lines: string[] = [];
  const out = (s: string) => { lines.push(s); console.log(s); };
  try {
    out(`# scan "${label}"`);
    for (const cmd of SAFE_CMDS) {
      for (const { tag, arg } of ARGS) {
        const resp = await kb.probe([0x52, cmd, ...arg]);
        const nonEmpty = resp.some((b) => b !== 0);
        out(`cmd 0x${cmd.toString(16)} arg=${tag.padEnd(6)} ${nonEmpty ? hex(resp) : '(no response / all-zero)'}`);
      }
    }
  } finally {
    await kb.close();
  }
  mkdirSync('captures', { recursive: true });
  writeFileSync(`captures/${label}.txt`, lines.join('\n') + '\n');
  console.log(`\nSaved -> captures/${label}.txt`);
}

function cmdListKeys(): void {
  console.log('Hardware keys:\n  ' + Object.keys(HWKEY).join(' '));
  console.log('\nMappable target keys:\n  ' + Object.keys(USAGE).join(' '));
}

async function cmdGet(hwKey: string): Promise<void> {
  const kb = openKeyboard();
  try {
    console.log(`${hwKey} -> ${await kb.getKeyMapping(hwKey)}`);
  } finally {
    await kb.close();
  }
}

async function cmdMap(hwKey: string, target: string): Promise<void> {
  const kb = openKeyboard();
  try {
    await kb.mapKey(hwKey, target);
    console.log(`Mapped ${hwKey} -> ${target}. Verifying...`);
    console.log(`${hwKey} now reads: ${await kb.getKeyMapping(hwKey)}`);
  } finally {
    await kb.close();
  }
}

async function cmdMapHid(hwKey: string, hex: string): Promise<void> {
  const kb = openKeyboard();
  try {
    const clean = hex.replace(/[\s:]/g, '');
    if (clean.length % 2 !== 0) throw new Error(`Hex must be whole bytes: ${hex}`);
    const bytes = clean.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
    await kb.mapRawUsage(hwKey, bytes);
    console.log(`Mapped ${hwKey} -> HID ${clean} (${bytes.length} byte(s)).`);
    if (bytes.length === 3) console.log(`${hwKey} now reads: ${await kb.getKeyMapping(hwKey)}`);
    else console.log('(multi-usage buffer; read-back only shows the first 3 bytes — verify physically)');
  } finally {
    await kb.close();
  }
}

async function cmdMapCombo(hwKey: string, mod: string, key: string): Promise<void> {
  const kb = openKeyboard();
  try {
    await kb.mapChord(hwKey, mod, key);
    console.log(`Mapped ${hwKey} -> ${mod}+${key}.`);
    console.log(`Remember: profile create + Profile LED on for it to take effect.`);
  } finally {
    await kb.close();
  }
}

async function cmdProfileCreate(name: string): Promise<void> {
  const kb = openKeyboard();
  try {
    await kb.createProfile(name);
    console.log(`Created/activated profile "${name}". Stored maps are now live on the keyboard.`);
    console.log('Profile name now reads:', await kb.getProfileName());
  } finally {
    await kb.close();
  }
}

async function cmdProfileDelete(): Promise<void> {
  const kb = openKeyboard();
  try {
    await kb.deleteProfile();
    console.log('Deleted profile. Maps cleared; keyboard reverts to default.');
  } finally {
    await kb.close();
  }
}

async function cmdExport(file?: string): Promise<void> {
  const kb = openKeyboard();
  try {
    const json = JSON.stringify(toFile(await readProfile(kb)), null, 2) + '\n';
    if (!file) return void process.stdout.write(json);
    writeFileSync(file, json);
    console.log(`Saved profile -> ${file}`);
  } finally {
    await kb.close();
  }
}

async function cmdImport(file: string): Promise<void> {
  const profile = parseProfile(readFileSync(file, 'utf8'));
  const kb = openKeyboard();
  try {
    const writes = await applyProfile(kb, profile);
    console.log(`Applied ${file}: ${writes} key(s) written, ${profile.maps.size} remapped in total.`);
    console.log('Profile name now reads:', await kb.getProfileName());
  } finally {
    await kb.close();
  }
}

async function main(): Promise<void> {
  const [cmd, a, b] = process.argv.slice(2);
  switch (cmd) {
    case 'profile':
      if (a === 'create' && b) await cmdProfileCreate(b);
      else if (a === 'delete') await cmdProfileDelete();
      else console.log('Usage: profile create <name> | profile delete');
      break;
    case 'export':
      await cmdExport(a);
      break;
    case 'import':
      if (!a) return void console.log('Usage: import <file.json>');
      await cmdImport(a);
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'list-keys':
      cmdListKeys();
      break;
    case 'dump':
      await cmdDump(a || 'dump');
      break;
    case 'scan':
      await cmdScan(a || 'scan');
      break;
    case 'get':
      if (!a) return void console.log('Usage: get <hardware-key>');
      await cmdGet(a);
      break;
    case 'map':
      if (!a || !b) return void console.log('Usage: map <hardware-key> <target-key>');
      await cmdMap(a, b);
      break;
    case 'map-hid':
      if (!a || !b) return void console.log('Usage: map-hid <hardware-key> <hex-usage>');
      await cmdMapHid(a, b);
      break;
    case 'map-combo': {
      const c = process.argv[5];
      if (!a || !b || !c) return void console.log('Usage: map-combo <hardware-key> <modifier> <key>  (e.g. map-combo supera cmd f13)');
      await cmdMapCombo(a, b, c);
      break;
    }
    default:
      console.log('Usage: node src/cli.ts <status|list-keys|get|map|map-combo|map-hid|profile|export|import>');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
