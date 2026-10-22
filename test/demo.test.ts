// The web app's simulated keyboard must speak the same protocol the real one
// does, so drive it with the real client end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemoKeyboard } from '../web/src/demo.ts';
import { HWKEY } from '../src/protocol/keys.ts';

test('demo keyboard: read, map, rename, delete through the real client', async () => {
  const kb = openDemoKeyboard();
  assert.equal(await kb.getProfileName(), 'demo');
  assert.equal(await kb.getKeyMapping('supera'), 'cmd+f13');

  await kb.mapChord('capslock', 'ctrl', 'f16');
  assert.equal(await kb.getKeyMapping('capslock'), 'ctrl+f16');
  assert.ok((await kb.getMappedKeys()).includes('capslock'));

  await kb.createProfile('work');
  assert.equal(await kb.getProfileName(), 'work');

  await kb.deleteProfile();
  assert.equal(await kb.getProfileName(), null);
  assert.deepEqual(await kb.getMappedKeys(), []);
});

test('demo keyboard: more than 15 maps span continuation frames', async () => {
  const kb = openDemoKeyboard();
  await kb.deleteProfile();
  const keys = 'abcdefghijklmnopqrst'.split('');
  for (const k of keys) await kb.mapKey(k, 'f13');
  assert.deepEqual(await kb.getMappedCodes(), keys.map((k) => HWKEY[k]));
});
