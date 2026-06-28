import HID from 'node-hid';
import { findConfigDevice } from './device.ts';
import {
  REPORT_SIZE,
  ATTN,
  MAP,
  MAP_DONE,
  OK,
  PROFILE_GET_NAME,
  PROFILE_NAME,
  PROFILE_108_NAME,
  PROFILE_NONE,
  PROFILE_GET_MAPPED,
  PROFILE_MAPPED,
  MAPPING_GET,
  MAPPING,
} from './protocol/consts.ts';
import { HWKEY, HWKEY_BY_CODE, USAGE, USAGE_BY_CODE } from './protocol/keys.ts';

function startsWith(buf: number[], prefix: number[]): boolean {
  for (let i = 0; i < prefix.length; i++) if (buf[i] !== prefix[i]) return false;
  return true;
}

/**
 * Userland client for the 8BitDo Retro Mechanical Keyboard config protocol.
 * READ methods (status/profile/mappings) are hardware-validated on macOS.
 * WRITE methods (map*, deleteProfile, renameProfile) are implemented per the
 * reverse-engineered protocol but should be exercised deliberately.
 */
export class Keyboard {
  private dev: HID.HID;

  private constructor(dev: HID.HID) {
    this.dev = dev;
  }

  /** Open the config interface, or throw a friendly error if not found. */
  static open(): Keyboard {
    const info = findConfigDevice();
    if (!info) {
      throw new Error(
        'No 8BitDo keyboard config interface found. Connect it via USB-C with the power switch OFF.',
      );
    }
    return new Keyboard(new HID.HID(info.path));
  }

  close(): void {
    this.dev.close();
  }

  private write(cmd: number[]): void {
    const buf = cmd.concat(Array(Math.max(0, REPORT_SIZE - cmd.length)).fill(0));
    this.dev.write(buf);
  }

  private read(timeoutMs = 1000): number[] {
    return this.dev.readTimeout(timeoutMs);
  }

  private readExpect(prefix: number[], timeoutMs = 1000): number[] {
    const r = this.read(timeoutMs);
    if (!startsWith(r, prefix)) {
      throw new Error(
        `Unexpected response. expected ${Buffer.from(prefix).toString('hex')} got ${Buffer.from(r).toString('hex')}`,
      );
    }
    return r;
  }

  /** ATTN handshake; the device replies READY, which we consume. */
  private handshake(): void {
    this.write(ATTN);
    this.read();
  }

  // --- READS (validated) ---

  getProfileName(): string | null {
    this.handshake();
    this.write(PROFILE_GET_NAME);
    const r = this.read();
    if (startsWith(r, PROFILE_NONE)) return null;
    if (startsWith(r, PROFILE_NAME) || startsWith(r, PROFILE_108_NAME)) {
      let b = Buffer.from(r.slice(4));
      let end = b.length;
      while (end > 0 && b[end - 1] === 0) end--;
      return b.subarray(0, end).swap16().toString('utf16le');
    }
    throw new Error(`Unexpected profile response: ${Buffer.from(r).toString('hex')}`);
  }

  /** Names of hardware keys that currently have a custom mapping. */
  getMappedKeys(): string[] {
    this.handshake();
    this.write(PROFILE_GET_MAPPED);
    let r = this.readExpect(PROFILE_MAPPED);
    const keymap: number[] = [];
    const collect = (resp: number[]) => {
      for (let i = 2; i < resp.length - 1; i++) keymap.push(resp[i]);
    };
    collect(r);
    while (r[r.length - 1] === 0x01) {
      r = this.readExpect(PROFILE_MAPPED);
      collect(r);
    }
    const names: string[] = [];
    for (let i = 0; i < keymap.length; i += 2) {
      const kc = keymap[i];
      if (kc === 0) break;
      names.push(HWKEY_BY_CODE[kc] ?? `0x${kc.toString(16)}`);
    }
    return names;
  }

  /** What a given hardware key is currently mapped to (name or "HID xxxxxx"). */
  getKeyMapping(hwName: string): string {
    const hw = HWKEY[hwName];
    if (hw === undefined) throw new Error(`Unknown hardware key: ${hwName}`);
    this.handshake();
    this.write([...MAPPING_GET, hw]);
    const r = this.readExpect(MAPPING);
    const code = (r[3] << 16) | (r[4] << 8) | r[5];
    return USAGE_BY_CODE[code] ?? `HID ${code.toString(16).padStart(6, '0')}`;
  }

  // --- WRITES (config-modifying; reverse-engineered, exercise deliberately) ---

  /** Remap a hardware key to a HID usage (3-byte big-endian code). */
  mapHidUsage(hwName: string, usageCode: number): void {
    const hw = HWKEY[hwName];
    if (hw === undefined) throw new Error(`Unknown hardware key: ${hwName}`);
    const usageBytes = [(usageCode >> 16) & 0xff, (usageCode >> 8) & 0xff, usageCode & 0xff];
    this.handshake();
    this.write([...MAP, hw, ...usageBytes]);
    this.readExpect(OK);
    this.write(MAP_DONE);
    this.readExpect(OK);
  }

  /** Remap a hardware key to another key by its USAGE name (e.g. "esc"). */
  mapKey(hwName: string, targetName: string): void {
    const u = USAGE[targetName];
    if (u === undefined) throw new Error(`Unknown target key: ${targetName}`);
    this.mapHidUsage(hwName, u.code);
  }
}
