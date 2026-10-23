// Helpers for encoding/decoding the 3-byte mapping values the keyboard stores.
// Pure data — no Node or browser APIs — so the CLI and the web app share it.
import { HWKEY_BY_CODE, USAGE, USAGE_BY_CODE } from './keys.ts';

/** Mac-friendly modifier aliases -> USAGE table name. */
export const MOD_ALIAS: Record<string, string> = {
  cmd: 'leftmeta', command: 'leftmeta', win: 'leftmeta', gui: 'leftmeta',
  opt: 'leftalt', option: 'leftalt', alt: 'leftalt',
  ctrl: 'leftctrl', control: 'leftctrl', shift: 'leftshift',
  rcmd: 'rightmeta', ropt: 'rightalt', rctrl: 'rightctrl', rshift: 'rightshift',
};

/** Modifier usage byte (0xe0-0xe7) -> the short alias `map-combo` accepts. */
export const MOD_SHORT: Record<number, string> = {
  0xe0: 'ctrl', 0xe1: 'shift', 0xe2: 'opt', 0xe3: 'cmd',
  0xe4: 'rctrl', 0xe5: 'rshift', 0xe6: 'ropt', 0xe7: 'rcmd',
};

export const hex = (a: number[]): string => a.map((b) => b.toString(16).padStart(2, '0')).join('');

/** Split a 3-byte usage code into the bytes the MAP command carries. */
export function usageBytes(code: number): number[] {
  return [(code >> 16) & 0xff, (code >> 8) & 0xff, code & 0xff];
}

/**
 * Chord encoding, discovered empirically: `07 <modifier-usage> <key-usage>` —
 * the modifier byte slot that a plain key leaves as 00, and a plain modifier
 * fills while leaving the key slot 00.
 */
export function chordUsage(modName: string, keyName: string): number {
  const mod = USAGE[MOD_ALIAS[modName] ?? modName];
  const key = USAGE[keyName];
  if (!mod) throw new Error(`Unknown modifier: ${modName} (try cmd/opt/ctrl/shift)`);
  if (!key) throw new Error(`Unknown key: ${keyName}`);
  const modByte = (mod.code >> 8) & 0xff; // e.g. 0xe3 for Left GUI
  if (modByte < 0xe0 || modByte > 0xe7) throw new Error(`${modName} is not a modifier key`);
  if (key.code >> 16 !== 0x07) throw new Error(`${keyName} is not a keyboard key; chords need one`);
  if (((key.code >> 8) & 0xff) !== 0x00) throw new Error(`${keyName} is itself a modifier; pick a normal key`);
  return 0x070000 | (modByte << 8) | (key.code & 0xff);
}

/** Decode a chord value into its parts, or null if it isn't one. */
export function parseChord(code: number): { mod: string; key: string } | null {
  if (code >> 16 !== 0x07) return null;
  const mod = MOD_SHORT[(code >> 8) & 0xff];
  const keyByte = code & 0xff;
  if (!mod || keyByte === 0) return null;
  return { mod, key: USAGE_BY_CODE[0x070000 | keyByte] ?? `0x${keyByte.toString(16)}` };
}

/** Human/CLI name for a mapping value: "f16", "cmd+f13", or "HID xxxxxx". */
export function usageName(code: number): string {
  const named = USAGE_BY_CODE[code];
  if (named !== undefined) return named;
  const chord = parseChord(code);
  if (chord) return `${chord.mod}+${chord.key}`;
  return `HID ${code.toString(16).padStart(6, '0')}`;
}

/** What a key sends when it isn't remapped: the usage of the same name, or nothing. */
export function defaultUsage(hw: number): number {
  const name = HWKEY_BY_CODE[hw];
  return (name ? USAGE[name]?.code : undefined) ?? 0x070000; // unmapped external buttons send nothing
}
