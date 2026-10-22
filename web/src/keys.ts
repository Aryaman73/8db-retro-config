// Physical layout of the Retro Mechanical Keyboard (87-key ANSI TKL) plus the
// external Super Buttons, and display labels for what keys send.
import { HWKEY, HWKEY_BY_CODE, USAGE, USAGE_BY_CODE } from '../../src/protocol/keys.ts';
import { parseChord } from '../../src/protocol/usage.ts';

export type Cap = 'light' | 'dark' | 'red';

export interface KeyDef {
  hw: number;
  label: string;
  x: number; // in key units (u)
  y: number;
  w: number;
  cap: Cap;
}

export const BOARD_W = 18.25;
export const BOARD_H = 6.25;

const LABEL: Record<string, string> = {
  esc: 'Esc', grave: '`', minus: '-', equal: '=', backspace: 'Backspace', tab: 'Tab',
  leftbrace: '[', rightbrace: ']', backslash: '\\', capslock: 'Caps Lock', semicolon: ';',
  apostrophe: "'", enter: 'Enter', leftshift: 'Shift', comma: ',', dot: '.', slash: '/',
  rightshift: 'Shift', leftctrl: 'Ctrl', windows: 'Win', leftalt: 'Alt', space: '',
  rightalt: 'Alt', superb: 'B', supera: 'A', rightctrl: 'Ctrl', prtsc: 'PrtSc',
  scrlk: 'ScrLk', pause: 'Pause', insert: 'Ins', home: 'Home', pageup: 'PgUp',
  delete: 'Del', end: 'End', pagedown: 'PgDn', up: '↑', down: '↓', left: '←', right: '→',
};

const LIGHT = new Set([
  ...'abcdefghijklmnopqrstuvwxyz0123456789',
  'grave', 'minus', 'equal', 'leftbrace', 'rightbrace', 'backslash', 'semicolon',
  'apostrophe', 'comma', 'dot', 'slash', 'space',
]);

type Item = [name: string, w?: number] | number; // a bare number is a gap of that width

function row(y: number, items: Item[]): KeyDef[] {
  const out: KeyDef[] = [];
  let x = 0;
  for (const it of items) {
    if (typeof it === 'number') {
      x += it;
      continue;
    }
    const [name, w = 1] = it;
    out.push({
      hw: HWKEY[name],
      label: LABEL[name] ?? name.toUpperCase(),
      x,
      y,
      w,
      cap: name === 'supera' || name === 'superb' ? 'red' : LIGHT.has(name) ? 'light' : 'dark',
    });
    x += w;
  }
  return out;
}

const k = (...names: string[]): Item[] => names.map((n) => [n]);
const NAV = 0.25;

export const LAYOUT: KeyDef[] = [
  ...row(0, [['esc'], 1, ...k('f1', 'f2', 'f3', 'f4'), 0.5, ...k('f5', 'f6', 'f7', 'f8'), 0.5,
    ...k('f9', 'f10', 'f11', 'f12'), NAV, ...k('prtsc', 'scrlk', 'pause')]),
  ...row(1.25, [...k('grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal'),
    ['backspace', 2], NAV, ...k('insert', 'home', 'pageup')]),
  ...row(2.25, [['tab', 1.5], ...k('q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'leftbrace', 'rightbrace'),
    ['backslash', 1.5], NAV, ...k('delete', 'end', 'pagedown')]),
  ...row(3.25, [['capslock', 1.75], ...k('a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'apostrophe'),
    ['enter', 2.25]]),
  ...row(4.25, [['leftshift', 2.25], ...k('z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'dot', 'slash'),
    ['rightshift', 2.75], NAV + 1, ['up']]),
  ...row(5.25, [['leftctrl', 1.25], ['windows', 1.25], ['leftalt', 1.25], ['space', 6.25], ['rightalt', 1.25],
    ['superb', 1.25], ['supera', 1.25], ['rightctrl', 1.25], NAV, ...k('left', 'down', 'right')]),
];

/** External 3.5mm Super Buttons, addressed by raw code in the custom profile. */
export const EXTERNAL: { hw: number; label: string }[] = [
  { hw: 0x75, label: 'Left' },
  { hw: 0x74, label: 'Right' },
];

const BY_HW = new Map<number, string>([
  ...LAYOUT.map((d) => [d.hw, d.label] as const),
  ...EXTERNAL.map((d) => [d.hw, `${d.label} Super Button`] as const),
]);

/** Display name for a hardware key. */
export function hwLabel(hw: number): string {
  const name = HWKEY_BY_CODE[hw];
  if (name === 'supera') return 'Super A';
  if (name === 'superb') return 'Super B';
  if (name === 'space') return 'Space';
  const l = BY_HW.get(hw);
  if (l && /^(Shift|Ctrl|Alt)$/.test(l)) return `${name?.startsWith('right') ? 'Right' : 'Left'} ${l}`;
  return l || name || `0x${hw.toString(16)}`;
}

/** What a key sends when it isn't remapped (the usage of the same name). */
export function defaultUsage(hw: number): number {
  const name = HWKEY_BY_CODE[hw];
  return (name ? USAGE[name]?.code : undefined) ?? 0x070000; // unmapped external buttons send nothing
}

// --- targets -----------------------------------------------------------------

const MOD_SYMBOL: Record<string, string> = {
  leftctrl: '⌃', leftshift: '⇧', leftalt: '⌥', leftmeta: '⌘',
  rightctrl: 'R⌃', rightshift: 'R⇧', rightalt: 'R⌥', rightmeta: 'R⌘',
};
const SHORT_MOD: Record<string, string> = {
  ctrl: '⌃', shift: '⇧', opt: '⌥', cmd: '⌘', rctrl: 'R⌃', rshift: 'R⇧', ropt: 'R⌥', rcmd: 'R⌘',
};
const TARGET_LABEL: Record<string, string> = {
  none: 'Nothing', compose: 'Menu', playpause: 'Play/Pause', nextsong: 'Next', previoussong: 'Prev',
  mute: 'Mute', volumeup: 'Vol +', volumedown: 'Vol −', calc: 'Calc', sysrq: 'PrtSc',
  scrolllock: 'ScrLk', '102nd': 'ISO \\', hashtilde: 'ISO #', numlock: 'NumLk',
  kpslash: 'KP /', kpasterisk: 'KP *', kpminus: 'KP −', kpplus: 'KP +', kpenter: 'KP Enter', kpdot: 'KP .',
  space: 'Space', leftmeta: '⌘ Cmd', leftalt: '⌥ Opt', leftctrl: '⌃ Ctrl', leftshift: '⇧ Shift',
  rightmeta: 'R ⌘ Cmd', rightalt: 'R ⌥ Opt', rightctrl: 'R ⌃ Ctrl', rightshift: 'R ⇧ Shift',
};

/** Long-ish label for a target usage name, used in the picker. */
export function targetName(name: string): string {
  if (TARGET_LABEL[name]) return TARGET_LABEL[name];
  if (/^kp\d$/.test(name)) return `KP ${name.slice(2)}`;
  if (LABEL[name] !== undefined) return LABEL[name] || name;
  return name.length <= 3 ? name.toUpperCase() : name[0].toUpperCase() + name.slice(1);
}

/** Compact label for what a key sends, e.g. "⌘F13", "F16", "⌥". */
export function usageLabel(code: number): string {
  const name = USAGE_BY_CODE[code];
  if (name) return MOD_SYMBOL[name] ?? targetName(name);
  const chord = parseChord(code);
  if (chord) return `${SHORT_MOD[chord.mod]}${targetName(chord.key)}`;
  return code.toString(16).padStart(6, '0');
}

const range = (prefix: string, a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => `${prefix}${a + i}`);

/** Picker groups. Mouse buttons are left out: their usages don't fit 3 bytes. */
export const TARGET_GROUPS: { title: string; names: string[] }[] = [
  { title: 'Function', names: range('f', 1, 24) },
  { title: 'Letters', names: [...'abcdefghijklmnopqrstuvwxyz'] },
  { title: 'Numbers', names: [...'1234567890'] },
  { title: 'Modifiers', names: ['leftmeta', 'leftalt', 'leftctrl', 'leftshift', 'rightmeta', 'rightalt', 'rightctrl', 'rightshift'] },
  { title: 'Editing & navigation', names: ['esc', 'enter', 'tab', 'space', 'backspace', 'delete', 'capslock', 'insert',
    'home', 'end', 'pageup', 'pagedown', 'up', 'down', 'left', 'right', 'prtsc', 'scrlk', 'pause', 'compose'] },
  { title: 'Symbols', names: ['grave', 'minus', 'equal', 'leftbrace', 'rightbrace', 'backslash', 'semicolon',
    'apostrophe', 'comma', 'dot', 'slash', '102nd', 'hashtilde'] },
  { title: 'Media', names: ['playpause', 'previoussong', 'nextsong', 'mute', 'volumedown', 'volumeup', 'calc'] },
  { title: 'Keypad', names: ['numlock', 'kpslash', 'kpasterisk', 'kpminus', 'kpplus', 'kpenter',
    ...range('kp', 0, 9), 'kpdot'] },
  { title: 'Other', names: ['none'] },
];

export const CHORD_MODS: { mod: string; label: string }[] = [
  { mod: 'cmd', label: '⌘ Cmd' }, { mod: 'opt', label: '⌥ Opt' },
  { mod: 'ctrl', label: '⌃ Ctrl' }, { mod: 'shift', label: '⇧ Shift' },
];

/** A target that can carry a modifier: a plain keyboard-page key. */
export function chordable(name: string): boolean {
  const code = USAGE[name]?.code ?? 0;
  return code >> 16 === 0x07 && ((code >> 8) & 0xff) === 0 && (code & 0xff) !== 0;
}

/** macOS caveats for a target, confirmed on hardware (see README). */
export function targetWarning(name: string): string | null {
  if (name === 'f14' || name === 'f15') return 'macOS treats F14/F15 as brightness keys, even with a modifier held.';
  if (/^f2[1-4]$/.test(name)) return 'macOS ignores F21–F24, so apps can’t bind them.';
  return null;
}
