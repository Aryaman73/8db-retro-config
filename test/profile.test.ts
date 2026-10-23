// Profile export/import, driven end to end against the simulated keyboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemoKeyboard } from '../web/src/demo.ts';
import { applyProfile, parseProfile, readProfile, toFile } from '../src/profile.ts';
import { HWKEY } from '../src/protocol/keys.ts';

test('export -> JSON -> import reproduces the profile on another keyboard', async () => {
  const src = openDemoKeyboard();
  await src.mapChord('capslock', 'ctrl', 'f16');
  const file = toFile(await readProfile(src));
  assert.equal(file.maps.capslock, '07e06b');
  assert.equal(file.maps.supera, '07e368');
  assert.equal(file.maps['0x75'], '07e36e', 'raw-code keys survive the round trip');

  const dst = openDemoKeyboard();
  await dst.mapKey('a', 'b'); // not in the file -> should be reset
  await dst.createProfile('other');
  const writes = await applyProfile(dst, parseProfile(JSON.stringify(file)));

  assert.deepEqual(toFile(await readProfile(dst)), file);
  assert.equal(writes, 2, 'only the differing keys are written (a reset, capslock set)');
});

test('readProfile leaves out keys mapped back to themselves', async () => {
  const kb = openDemoKeyboard();
  await kb.mapKey('insert', 'insert');
  assert.equal((await readProfile(kb)).maps.has(HWKEY.insert), false);
});

test('parseProfile rejects malformed files with readable errors', () => {
  const ok = { format: '8bitdo-retro-profile', version: 1, name: 'main', maps: {} };
  assert.throws(() => parseProfile('{'), /valid JSON/);
  assert.throws(() => parseProfile(JSON.stringify({ ...ok, format: 'x' })), /isn’t an 8BitDo/);
  assert.throws(() => parseProfile(JSON.stringify({ ...ok, version: 2 })), /Unsupported profile version/);
  assert.throws(() => parseProfile(JSON.stringify({ ...ok, name: 'x'.repeat(25) })), /1-24/);
  assert.throws(() => parseProfile(JSON.stringify({ ...ok, maps: { nope: '070004' } })), /Unknown key/);
  assert.throws(() => parseProfile(JSON.stringify({ ...ok, maps: { a: 'zz' } })), /6 hex digits/);
  assert.deepEqual(parseProfile(JSON.stringify({ ...ok, name: null })).name, null);
});
