// Generates src/protocol/keys.ts from the reference keys.py (faithful port).
// Run: node scripts/gen-keys.js
const fs = require('fs');
const path = require('path');

const py = fs.readFileSync(path.join(__dirname, '../reference/keys.py'), 'utf8');

const hwBlock = py.slice(py.indexOf('HWKEY'), py.indexOf('USAGE'));
const usageBlock = py.slice(py.indexOf('USAGE'));

const hw = {};
for (const m of hwBlock.matchAll(/"([^"]+)"\s*:\s*(0x[0-9a-fA-F]+)/g)) {
  hw[m[1]] = parseInt(m[2], 16);
}

const usage = {};
for (const m of usageBlock.matchAll(/"([^"]+)"\s*:\s*\(\s*(0x[0-9a-fA-F]+)\s*,\s*"((?:[^"\\]|\\.)*)"/g)) {
  usage[m[1]] = { code: parseInt(m[2], 16), desc: m[3] };
}

// CORRECTIONS to upstream keys.py: its F13-F24 usages are wrong (off by +14,
// e.g. f13 listed as 0x070076 which is actually "Keyboard Menu"). Standard HID
// F13-F24 = 0x68-0x73. Verified on hardware: cmd+0x68 registers as Cmd+F13.
for (let i = 0; i <= 11; i++) {
  const name = `f${13 + i}`;
  if (usage[name]) usage[name] = { code: 0x070068 + i, desc: `Keyboard F${13 + i}` };
}

const out = `// AUTO-GENERATED from reference/keys.py by scripts/gen-keys.js. Do not edit by hand.
// Source protocol/key tables: github.com/goncalor/8bitdo-kbd-mapper (see NOTICE).

/** Hardware key name -> physical key code used by the keyboard's config protocol. */
export const HWKEY: Record<string, number> = ${JSON.stringify(hw, null, 2)};

/** HID usage name -> { code, desc }. \`code\` is the 3-byte HID usage (page<<16 | usage). */
export const USAGE: Record<string, { code: number; desc: string }> = ${JSON.stringify(usage, null, 2)};

// Reverse lookups use FIRST-wins so aliased codes resolve to the friendly,
// first-defined name (e.g. 0x6c -> "superb" not "rightmeta", 0x6d -> "supera").

/** Reverse lookup: hardware key code -> name. */
export const HWKEY_BY_CODE: Record<number, string> = Object.entries(HWKEY).reduce<Record<number, string>>(
  (acc, [name, code]) => (code in acc ? acc : ((acc[code] = name), acc)),
  {},
);

/** Reverse lookup: HID usage code -> name. */
export const USAGE_BY_CODE: Record<number, string> = Object.entries(USAGE).reduce<Record<number, string>>(
  (acc, [name, v]) => (v.code in acc ? acc : ((acc[v.code] = name), acc)),
  {},
);
`;

fs.writeFileSync(path.join(__dirname, '../src/protocol/keys.ts'), out);
console.log(`Generated keys.ts: ${Object.keys(hw).length} hardware keys, ${Object.keys(usage).length} usages.`);
