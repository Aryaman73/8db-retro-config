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

const out = `// AUTO-GENERATED from reference/keys.py by scripts/gen-keys.js. Do not edit by hand.
// Source protocol/key tables: github.com/goncalor/8bitdo-kbd-mapper (see NOTICE).

/** Hardware key name -> physical key code used by the keyboard's config protocol. */
export const HWKEY: Record<string, number> = ${JSON.stringify(hw, null, 2)};

/** HID usage name -> { code, desc }. \`code\` is the 3-byte HID usage (page<<16 | usage). */
export const USAGE: Record<string, { code: number; desc: string }> = ${JSON.stringify(usage, null, 2)};

/** Reverse lookup: hardware key code -> name. */
export const HWKEY_BY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(HWKEY).map(([name, code]) => [code, name]),
);

/** Reverse lookup: HID usage code -> name. */
export const USAGE_BY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(USAGE).map(([name, v]) => [v.code, name]),
);
`;

fs.writeFileSync(path.join(__dirname, '../src/protocol/keys.ts'), out);
console.log(`Generated keys.ts: ${Object.keys(hw).length} hardware keys, ${Object.keys(usage).length} usages.`);
