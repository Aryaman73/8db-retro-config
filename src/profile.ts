// Profiles as portable JSON files: back up the keyboard, share a layout, or
// move it between keyboards. Shared by the CLI (export/import) and the web app.
import type { Keyboard } from './client.ts';
import { HWKEY, HWKEY_BY_CODE } from './protocol/keys.ts';
import { defaultUsage } from './protocol/usage.ts';

export const PROFILE_FORMAT = '8bitdo-retro-profile';

/**
 * On-disk shape. Keys are hardware key names ("supera") or raw codes ("0x75");
 * values are the 3-byte mapping as 6 hex digits ("07e368" = ⌘F13), so the file
 * stays readable and diffable.
 */
export interface ProfileFile {
  format: typeof PROFILE_FORMAT;
  version: 1;
  name: string | null;
  maps: Record<string, string>;
}

/** A parsed profile: hardware code -> usage. */
export interface Profile {
  name: string | null;
  maps: Map<number, number>;
}

const hwKeyName = (hw: number) => HWKEY_BY_CODE[hw] ?? `0x${hw.toString(16)}`;

export function toFile(p: Profile): ProfileFile {
  const maps: Record<string, string> = {};
  for (const [hw, u] of p.maps) maps[hwKeyName(hw)] = u.toString(16).padStart(6, '0');
  return { format: PROFILE_FORMAT, version: 1, name: p.name, maps };
}

/** Read the keyboard's profile. Keys mapped back to themselves are left out. */
export async function readProfile(kb: Keyboard): Promise<Profile> {
  const name = await kb.getProfileName();
  const maps = new Map<number, number>();
  for (const hw of await kb.getMappedCodes()) {
    const u = await kb.getKeyUsage(hw);
    if (u !== defaultUsage(hw)) maps.set(hw, u);
  }
  return { name, maps };
}

/** Validate an untrusted profile file. Throws a message fit to show a person. */
export function parseProfile(text: string): Profile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const d = data as Partial<ProfileFile> | null;
  if (!d || typeof d !== 'object' || d.format !== PROFILE_FORMAT) {
    throw new Error('That isn’t an 8BitDo Retro profile file.');
  }
  if (d.version !== 1) throw new Error(`Unsupported profile version: ${String(d.version)}`);

  let name: string | null = null;
  if (d.name !== null && d.name !== undefined) {
    if (typeof d.name !== 'string' || d.name.length < 1 || d.name.length > 24) {
      throw new Error('Profile name must be 1-24 characters.');
    }
    name = d.name;
  }

  if (!d.maps || typeof d.maps !== 'object' || Array.isArray(d.maps)) throw new Error('Profile has no "maps" object.');
  const maps = new Map<number, number>();
  for (const [key, value] of Object.entries(d.maps)) {
    const hw = HWKEY[key] ?? (/^0x[0-9a-f]{1,2}$/i.test(key) ? parseInt(key, 16) : undefined);
    if (hw === undefined) throw new Error(`Unknown key in profile: ${key}`);
    if (typeof value !== 'string' || !/^[0-9a-f]{6}$/i.test(value)) {
      throw new Error(`Mapping for ${key} must be 6 hex digits, got ${JSON.stringify(value)}`);
    }
    maps.set(hw, parseInt(value, 16));
  }
  return { name, maps };
}

/**
 * Make the keyboard match `target`: reset remapped keys the profile doesn't
 * mention, write the ones that differ, then name the profile (which is what
 * makes the maps live). Returns how many keys were written.
 */
export async function applyProfile(kb: Keyboard, target: Profile): Promise<number> {
  const current = await readProfile(kb);
  let writes = 0;
  for (const hw of current.maps.keys()) {
    if (!target.maps.has(hw)) {
      await kb.mapHidUsage(hw, defaultUsage(hw));
      writes++;
    }
  }
  for (const [hw, u] of target.maps) {
    if ((current.maps.get(hw) ?? defaultUsage(hw)) !== u) {
      await kb.mapHidUsage(hw, u);
      writes++;
    }
  }
  if (target.name && target.name !== current.name) await kb.createProfile(target.name);
  return writes;
}
