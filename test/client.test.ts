// Golden-byte tests for the protocol client. No keyboard needed: a fake device
// records every report written and replays scripted responses.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keyboard, type HidDevice } from '../src/client.ts';
import {
  REPORT_SIZE, ATTN, MAP, MAP_DONE, OK, READY,
  PROFILE_GET_NAME, PROFILE_GET_MAPPED, PROFILE_RENAME, PROFILE_DELETE, MAPPING_GET,
} from '../src/protocol/consts.ts';
import { HWKEY, USAGE } from '../src/protocol/keys.ts';

const pad = (a: number[]) => a.concat(Array(REPORT_SIZE - a.length).fill(0));

/** Fake HID device: `reads` are returned in order; `writes` capture each report. */
function fake(reads: number[][]) {
  const writes: number[][] = [];
  const dev: HidDevice = {
    write: (data: number[] | Buffer) => {
      writes.push(Array.from(data));
      return data.length;
    },
    readTimeout: () => reads.shift() ?? [],
    close: () => {},
  };
  return { kb: Keyboard.fromDevice(dev), writes };
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

test('mapKey: capslock -> esc sends ATTN, MAP+key+usage, MAP_DONE', () => {
  const { kb, writes } = fake([READY, OK, OK]);
  kb.mapKey('capslock', 'esc');
  assert.deepEqual(writes, [
    pad(ATTN),
    pad([...MAP, HWKEY.capslock, 0x07, 0x00, 0x29]),
    pad(MAP_DONE),
  ]);
});

test('mapChord: supera cmd f13 encodes 07 e3 68', () => {
  const { kb, writes } = fake([READY, OK, OK]);
  kb.mapChord('supera', 'cmd', 'f13');
  assert.deepEqual(writes[1], pad([...MAP, 0x6d, 0x07, 0xe3, 0x68]));
});

test('mapChord: modifier aliases resolve to the right usage byte', () => {
  const cases: Array<[string, number]> = [
    ['ctrl', 0xe0], ['shift', 0xe1], ['opt', 0xe2], ['cmd', 0xe3],
    ['rctrl', 0xe4], ['rshift', 0xe5], ['ropt', 0xe6], ['rcmd', 0xe7],
  ];
  for (const [alias, byte] of cases) {
    const { kb, writes } = fake([READY, OK, OK]);
    kb.mapChord('delete', alias, 'f16');
    assert.deepEqual(writes[1].slice(MAP.length, MAP.length + 4), [HWKEY.delete, 0x07, byte, 0x6b], alias);
  }
});

test('mapChord: rejects a non-modifier as the modifier and a modifier as the key', () => {
  const { kb, writes } = fake([]);
  assert.throws(() => kb.mapChord('supera', 'a', 'f13'), /not a modifier/);
  assert.throws(() => kb.mapChord('supera', 'cmd', 'leftshift'), /itself a modifier/);
  assert.throws(() => kb.mapChord('supera', 'hyper', 'f13'), /Unknown modifier/);
  assert.equal(writes.length, 0, 'nothing should be sent on invalid input');
});

test('mapHidUsage: map-to-self clears the override (key -> its own usage)', () => {
  const { kb, writes } = fake([READY, OK, OK]);
  kb.mapKey('insert', 'insert');
  assert.deepEqual(writes[1], pad([...MAP, HWKEY.insert, 0x07, 0x00, 0x49]));
});

test('mapRawUsage: rejects empty and oversized buffers', () => {
  const { kb } = fake([]);
  assert.throws(() => kb.mapRawUsage('a', []), /1-24 bytes/);
  assert.throws(() => kb.mapRawUsage('a', Array(25).fill(0)), /1-24 bytes/);
  assert.throws(() => kb.mapRawUsage('nope', [7, 0, 4]), /Unknown hardware key/);
});

test('writes throw if the device does not ACK', () => {
  const { kb } = fake([READY, [0x54, 0xe4, 0x09]]);
  assert.throws(() => kb.mapKey('a', 'b'), /Unexpected response/);
});

test('createProfile: name is sent as UTF-16BE after PROFILE_RENAME', () => {
  const { kb, writes } = fake([READY, OK]);
  kb.createProfile('main');
  assert.deepEqual(writes[1], pad([...PROFILE_RENAME, 0, 0x6d, 0, 0x61, 0, 0x69, 0, 0x6e]));
});

test('createProfile: enforces 1-24 characters', () => {
  const { kb } = fake([]);
  assert.throws(() => kb.createProfile(''), /1-24/);
  assert.throws(() => kb.createProfile('x'.repeat(25)), /1-24/);
});

test('deleteProfile sends PROFILE_DELETE', () => {
  const { kb, writes } = fake([OK]);
  kb.deleteProfile();
  assert.deepEqual(writes, [pad(PROFILE_DELETE)]);
});

// --- reads ---

test('getProfileName decodes a UTF-16BE name and strips padding', () => {
  const resp = pad([0x54, 0x80, 0x10, 0x00, 0, 0x6d, 0, 0x61, 0, 0x69, 0, 0x6e]);
  const { kb, writes } = fake([READY, resp]);
  assert.equal(kb.getProfileName(), 'main');
  assert.deepEqual(writes[1], pad(PROFILE_GET_NAME));
});

test('getProfileName returns null when no profile exists', () => {
  const { kb } = fake([READY, pad([0x54, 0x80, 0x00, 0x00])]);
  assert.equal(kb.getProfileName(), null);
});

test('getMappedKeys follows continuation frames', () => {
  // Each frame: 54 81, then up to 15 (keycode, x) pairs, last byte = 0x01 if more
  // frames follow. A keycode of 0 ends the list, so a continued frame is full.
  const first15 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];
  const frame1 = [0x54, 0x81, ...first15.flatMap((k) => [HWKEY[k], 0]), 0x01];
  const frame2 = pad([0x54, 0x81, HWKEY.supera, 0]);
  const { kb, writes } = fake([READY, frame1, frame2]);
  assert.deepEqual(kb.getMappedKeys(), [...first15, 'supera']);
  assert.deepEqual(writes[1], pad(PROFILE_GET_MAPPED));
});

test('getKeyMapping names known usages and falls back to raw hex for chords', () => {
  const plain = fake([READY, pad([0x54, 0x83, HWKEY.insert, 0x07, 0x00, 0x6b])]);
  assert.equal(plain.kb.getKeyMapping('insert'), 'f16');
  assert.deepEqual(plain.writes[1], pad([...MAPPING_GET, HWKEY.insert]));

  const chord = fake([READY, pad([0x54, 0x83, 0x6d, 0x07, 0xe3, 0x68])]);
  assert.equal(chord.kb.getKeyMapping('supera'), 'HID 07e368');
});
