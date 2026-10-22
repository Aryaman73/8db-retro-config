// Golden-byte tests for the protocol client. No keyboard needed: a fake device
// records every report written and replays scripted responses.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keyboard, type Transport } from '../src/client.ts';
import {
  REPORT_SIZE, ATTN, MAP, MAP_DONE, OK, READY,
  PROFILE_GET_NAME, PROFILE_GET_MAPPED, PROFILE_RENAME, PROFILE_DELETE, PROFILE_NONE, MAPPING_GET,
} from '../src/protocol/consts.ts';
import { HWKEY, USAGE } from '../src/protocol/keys.ts';
import { chordUsage, parseChord, usageName } from '../src/protocol/usage.ts';

const pad = (a: number[]) => a.concat(Array(REPORT_SIZE - a.length).fill(0));

/** Fake HID device: `reads` are returned in order; `writes` capture each report. */
function fake(reads: number[][]) {
  const writes: number[][] = [];
  const dev: Transport = {
    write: async (data) => void writes.push(Array.from(data)),
    read: async () => reads.shift() ?? [],
    close: async () => {},
  };
  return { kb: new Keyboard(dev), writes };
}

// --- key tables ---

test('F13-F24 use the corrected standard HID usages (0x68-0x73)', () => {
  assert.equal(USAGE.f13.code, 0x070068);
  assert.equal(USAGE.f20.code, 0x07006f);
  assert.equal(USAGE.f24.code, 0x070073);
});

test('on-board Super keys have the known hardware codes', () => {
  assert.equal(HWKEY.supera, 0x6d);
  assert.equal(HWKEY.superb, 0x6c);
});

// --- writes ---

test('mapKey: capslock -> esc sends ATTN, MAP+key+usage, MAP_DONE', async () => {
  const { kb, writes } = fake([READY, OK, OK]);
  await kb.mapKey('capslock', 'esc');
  assert.deepEqual(writes, [
    pad(ATTN),
    pad([...MAP, HWKEY.capslock, 0x07, 0x00, 0x29]),
    pad(MAP_DONE),
  ]);
});

test('mapChord: supera cmd f13 encodes 07 e3 68', async () => {
  const { kb, writes } = fake([READY, OK, OK]);
  await kb.mapChord('supera', 'cmd', 'f13');
  assert.deepEqual(writes[1], pad([...MAP, 0x6d, 0x07, 0xe3, 0x68]));
});

test('mapChord: modifier aliases resolve to the right usage byte', async () => {
  const cases: Array<[string, number]> = [
    ['ctrl', 0xe0], ['shift', 0xe1], ['opt', 0xe2], ['cmd', 0xe3],
    ['rctrl', 0xe4], ['rshift', 0xe5], ['ropt', 0xe6], ['rcmd', 0xe7],
  ];
  for (const [alias, byte] of cases) {
    const { kb, writes } = fake([READY, OK, OK]);
    await kb.mapChord('delete', alias, 'f16');
    assert.deepEqual(writes[1].slice(MAP.length, MAP.length + 4), [HWKEY.delete, 0x07, byte, 0x6b], alias);
  }
});

test('mapChord: rejects a non-modifier as the modifier and a modifier as the key', async () => {
  const { kb, writes } = fake([]);
  await assert.rejects(kb.mapChord('supera', 'a', 'f13'), /not a modifier/);
  await assert.rejects(kb.mapChord('supera', 'cmd', 'leftshift'), /itself a modifier/);
  await assert.rejects(kb.mapChord('supera', 'hyper', 'f13'), /Unknown modifier/);
  assert.equal(writes.length, 0, 'nothing should be sent on invalid input');
});

test('mapHidUsage: map-to-self clears the override (key -> its own usage)', async () => {
  const { kb, writes } = fake([READY, OK, OK]);
  await kb.mapKey('insert', 'insert');
  assert.deepEqual(writes[1], pad([...MAP, HWKEY.insert, 0x07, 0x00, 0x49]));
});

test('raw hardware codes ("0x6e") are accepted for keys not in the table', async () => {
  const { kb, writes } = fake([READY, OK, OK]);
  await kb.mapKey('0x6e', '1');
  assert.deepEqual(writes[1], pad([...MAP, 0x6e, 0x07, 0x00, 0x1e]));
});

test('mapRawUsage: rejects empty and oversized buffers', async () => {
  const { kb } = fake([]);
  await assert.rejects(kb.mapRawUsage('a', []), /1-24 bytes/);
  await assert.rejects(kb.mapRawUsage('a', Array(25).fill(0)), /1-24 bytes/);
  await assert.rejects(kb.mapRawUsage('nope', [7, 0, 4]), /Unknown hardware key/);
});

test('writes throw if the device does not ACK', async () => {
  const { kb } = fake([READY, [0x54, 0xe4, 0x09]]);
  await assert.rejects(kb.mapKey('a', 'b'), /Unexpected response/);
});

test('createProfile: name is sent as UTF-16BE after PROFILE_RENAME', async () => {
  const { kb, writes } = fake([READY, OK]);
  await kb.createProfile('main');
  assert.deepEqual(writes[1], pad([...PROFILE_RENAME, 0, 0x6d, 0, 0x61, 0, 0x69, 0, 0x6e]));
});

test('createProfile: enforces 1-24 characters', async () => {
  const { kb } = fake([]);
  await assert.rejects(kb.createProfile(''), /1-24/);
  await assert.rejects(kb.createProfile('x'.repeat(25)), /1-24/);
});

test('deleteProfile sends PROFILE_DELETE', async () => {
  const { kb, writes } = fake([OK]);
  await kb.deleteProfile();
  assert.deepEqual(writes, [pad(PROFILE_DELETE)]);
});

// --- reads ---

test('getProfileName decodes a UTF-16BE name and strips padding', async () => {
  const resp = pad([0x54, 0x80, 0x10, 0x00, 0, 0x6d, 0, 0x61, 0, 0x69, 0, 0x6e]);
  const { kb, writes } = fake([READY, resp]);
  assert.equal(await kb.getProfileName(), 'main');
  assert.deepEqual(writes[1], pad(PROFILE_GET_NAME));
});

test('getProfileName returns null when no profile exists', async () => {
  const { kb } = fake([READY, pad([0x54, 0x80, 0x00, 0x00])]);
  assert.equal(await kb.getProfileName(), null);
});

test('getMappedKeys follows continuation frames', async () => {
  // Each frame: 54 81, then up to 15 (keycode, x) pairs, last byte = 0x01 if more
  // frames follow. A keycode of 0 ends the list, so a continued frame is full.
  const first15 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];
  const frame1 = [0x54, 0x81, ...first15.flatMap((k) => [HWKEY[k], 0]), 0x01];
  const frame2 = pad([0x54, 0x81, HWKEY.supera, 0]);
  const { kb, writes } = fake([READY, frame1, frame2]);
  assert.deepEqual(await kb.getMappedKeys(), [...first15, 'supera']);
  assert.deepEqual(writes[1], pad(PROFILE_GET_MAPPED));
});

test('getKeyMapping names known usages and decodes chords', async () => {
  const plain = fake([READY, pad([0x54, 0x83, HWKEY.insert, 0x07, 0x00, 0x6b])]);
  assert.equal(await plain.kb.getKeyMapping('insert'), 'f16');
  assert.deepEqual(plain.writes[1], pad([...MAPPING_GET, HWKEY.insert]));

  const chord = fake([READY, pad([0x54, 0x83, 0x6d, 0x07, 0xe3, 0x68])]);
  assert.equal(await chord.kb.getKeyMapping('supera'), 'cmd+f13');

  const odd = fake([READY, pad([0x54, 0x83, 0x6d, 0x0c, 0x12, 0x34])]);
  assert.equal(await odd.kb.getKeyMapping('supera'), 'HID 0c1234');
});

test('getProfileName round-trips a name createProfile wrote', async () => {
  const w = fake([READY, OK]);
  await w.kb.createProfile('Ā-mac');
  const name = w.writes[1].slice(PROFILE_RENAME.length);
  const r = fake([READY, pad([0x54, 0x80, 0x10, 0x00, ...name.slice(0, 32 - 4)])]);
  assert.equal(await r.kb.getProfileName(), 'Ā-mac');
});

// --- concurrency ---

test('overlapping calls run one transaction at a time', async () => {
  const { kb, writes } = fake([
    READY, pad([0x54, 0x83, HWKEY.insert, 0x07, 0x00, 0x6b]),
    READY, pad([0x54, 0x83, HWKEY.home, 0x07, 0x00, 0x6c]),
  ]);
  const [a, b] = await Promise.all([kb.getKeyMapping('insert'), kb.getKeyMapping('home')]);
  assert.deepEqual([a, b], ['f16', 'f17']);
  assert.deepEqual(writes, [
    pad(ATTN), pad([...MAPPING_GET, HWKEY.insert]),
    pad(ATTN), pad([...MAPPING_GET, HWKEY.home]),
  ]);
});

test('a failed transaction does not block the next one', async () => {
  const { kb } = fake([READY, [0x54, 0xe4, 0x09], READY, pad(PROFILE_NONE)]);
  await assert.rejects(kb.mapKey('a', 'b'), /Unexpected response/);
  assert.equal(await kb.getProfileName(), null);
});

// --- usage helpers ---

test('chordUsage / parseChord / usageName agree', () => {
  assert.equal(chordUsage('cmd', 'f13'), 0x07e368);
  assert.deepEqual(parseChord(0x07e368), { mod: 'cmd', key: 'f13' });
  assert.equal(parseChord(0x07006b), null, 'plain key is not a chord');
  assert.equal(parseChord(0x07e300), null, 'plain modifier is not a chord');
  assert.equal(usageName(0x07e06b), 'ctrl+f16');
  assert.equal(usageName(0x0ce200), 'mute');
  assert.throws(() => chordUsage('cmd', 'mute'), /not a keyboard key/);
});
