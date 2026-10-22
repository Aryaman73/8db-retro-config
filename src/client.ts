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
  PROFILE_RENAME,
  PROFILE_DELETE,
  MAPPING_GET,
  MAPPING,
} from './protocol/consts.ts';
import { HWKEY, HWKEY_BY_CODE, USAGE } from './protocol/keys.ts';
import { chordUsage, hex, usageBytes, usageName } from './protocol/usage.ts';

/**
 * How the client reaches the keyboard. Reports are report-ID-led (byte 0 is the
 * report ID), exactly as they appear on the wire. `read` resolves to [] on
 * timeout. Implemented over node-hid (src/device.ts) and WebHID (web/).
 */
export interface Transport {
  write(report: number[]): Promise<void>;
  read(timeoutMs: number): Promise<number[]>;
  close(): Promise<void>;
}

function startsWith(buf: number[], prefix: number[]): boolean {
  for (let i = 0; i < prefix.length; i++) if (buf[i] !== prefix[i]) return false;
  return true;
}

/** Resolve a hardware key name, a raw code like "0x6e", or a numeric code. */
function hwCode(hw: string | number): number {
  if (typeof hw === 'number') return hw;
  const named = HWKEY[hw];
  if (named !== undefined) return named;
  if (/^0x[0-9a-f]{1,2}$/i.test(hw)) return parseInt(hw, 16);
  throw new Error(`Unknown hardware key: ${hw}`);
}

/** Profile names travel as UTF-16BE. */
function encodeName(name: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    out.push(c >> 8, c & 0xff);
  }
  return out;
}

function decodeName(bytes: number[]): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  if (end % 2) end++; // keep a trailing 0x00 high byte's partner
  let s = '';
  for (let i = 0; i + 1 < end; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return s;
}

/**
 * Client for the 8BitDo Retro Mechanical Keyboard config protocol.
 * READ methods (status/profile/mappings) are hardware-validated on macOS.
 * WRITE methods (map*, deleteProfile, createProfile) are implemented per the
 * reverse-engineered protocol but should be exercised deliberately.
 *
 * Every public method is one exclusive transaction: calls made while another
 * is in flight queue behind it, so request/response pairs never interleave.
 */
export class Keyboard {
  private dev: Transport;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dev: Transport) {
    this.dev = dev;
  }

  close(): Promise<void> {
    return this.exclusive(() => this.dev.close());
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  private write(cmd: number[]): Promise<void> {
    return this.dev.write(cmd.concat(Array(Math.max(0, REPORT_SIZE - cmd.length)).fill(0)));
  }

  private read(timeoutMs = 1000): Promise<number[]> {
    return this.dev.read(timeoutMs);
  }

  private async readExpect(prefix: number[], timeoutMs = 1000): Promise<number[]> {
    const r = await this.read(timeoutMs);
    if (!startsWith(r, prefix)) {
      throw new Error(`Unexpected response. expected ${hex(prefix)} got ${hex(r)}`);
    }
    return r;
  }

  /** ATTN handshake; the device replies (READY or OK), which we consume. */
  private async handshake(): Promise<void> {
    await this.write(ATTN);
    await this.read();
  }

  /**
   * Diagnostic: send a single query (report-ID-led) after a handshake and
   * return the raw response. CALLER MUST pass only safe, non-mutating commands.
   */
  probe(cmd: number[], timeoutMs = 300): Promise<number[]> {
    return this.exclusive(async () => {
      await this.handshake();
      await this.write(cmd);
      return this.read(timeoutMs).catch(() => []);
    });
  }

  // --- READS (validated) ---

  getProfileName(): Promise<string | null> {
    return this.exclusive(async () => {
      await this.handshake();
      await this.write(PROFILE_GET_NAME);
      const r = await this.read();
      if (startsWith(r, PROFILE_NONE)) return null;
      if (startsWith(r, PROFILE_NAME) || startsWith(r, PROFILE_108_NAME)) return decodeName(r.slice(4));
      throw new Error(`Unexpected profile response: ${hex(r)}`);
    });
  }

  /** Hardware codes of keys that currently have a custom mapping. */
  getMappedCodes(): Promise<number[]> {
    return this.exclusive(async () => {
      await this.handshake();
      await this.write(PROFILE_GET_MAPPED);
      let r = await this.readExpect(PROFILE_MAPPED);
      const keymap: number[] = [];
      const collect = (resp: number[]) => {
        for (let i = 2; i < resp.length - 1; i++) keymap.push(resp[i]);
      };
      collect(r);
      while (r[r.length - 1] === 0x01) {
        r = await this.readExpect(PROFILE_MAPPED);
        collect(r);
      }
      const codes: number[] = [];
      for (let i = 0; i < keymap.length; i += 2) {
        if (keymap[i] === 0) break;
        codes.push(keymap[i]);
      }
      return codes;
    });
  }

  /** Names of hardware keys that currently have a custom mapping. */
  async getMappedKeys(): Promise<string[]> {
    return (await this.getMappedCodes()).map((kc) => HWKEY_BY_CODE[kc] ?? `0x${kc.toString(16)}`);
  }

  /** The 3-byte usage value a hardware key is currently mapped to. */
  getKeyUsage(hw: string | number): Promise<number> {
    const code = hwCode(hw);
    return this.exclusive(async () => {
      await this.handshake();
      await this.write([...MAPPING_GET, code]);
      const r = await this.readExpect(MAPPING);
      return (r[3] << 16) | (r[4] << 8) | r[5];
    });
  }

  /** What a hardware key is currently mapped to: "f16", "cmd+f13", or "HID xxxxxx". */
  async getKeyMapping(hw: string | number): Promise<string> {
    return usageName(await this.getKeyUsage(hw));
  }

  /** Diagnostic: FULL raw MAPPING_GET response for a key (to inspect chords). */
  rawKeyMapping(hw: string | number): Promise<number[]> {
    const code = hwCode(hw);
    return this.exclusive(async () => {
      await this.handshake();
      await this.write([...MAPPING_GET, code]);
      return this.read();
    });
  }

  /** Diagnostic: all raw PROFILE_GET_MAPPED frames. */
  rawMappedFrames(): Promise<number[][]> {
    return this.exclusive(async () => {
      await this.handshake();
      await this.write(PROFILE_GET_MAPPED);
      const frames: number[][] = [];
      let r = await this.read();
      frames.push(r);
      while (r.length > 0 && r[r.length - 1] === 0x01) {
        r = await this.read();
        frames.push(r);
      }
      return frames;
    });
  }

  // --- WRITES (config-modifying; reverse-engineered, exercise deliberately) ---

  /**
   * Remap a hardware key to a raw usage buffer (1..24 bytes). A single key is
   * 3 bytes (e.g. 07 00 68 = F13; 07 e3 68 = ⌘+F13). Concatenating several
   * 3-byte usages does NOT chord — verified on hardware, the keyboard honours
   * only the first cell.
   */
  mapRawUsage(hw: string | number, bytes: number[]): Promise<void> {
    // Validate up front so bad input rejects before anything is queued or sent.
    let code: number;
    try {
      code = hwCode(hw);
      if (bytes.length < 1 || bytes.length > 24) throw new Error('Usage buffer must be 1-24 bytes.');
    } catch (e) {
      return Promise.reject(e);
    }
    return this.exclusive(async () => {
      await this.handshake();
      await this.write([...MAP, code, ...bytes]);
      await this.readExpect(OK);
      await this.write(MAP_DONE);
      await this.readExpect(OK);
    });
  }

  /** Remap a hardware key to a single 3-byte HID usage code. */
  mapHidUsage(hw: string | number, usageCode: number): Promise<void> {
    return this.mapRawUsage(hw, usageBytes(usageCode));
  }

  /** Remap a hardware key to another key by its USAGE name (e.g. "esc"). */
  mapKey(hw: string | number, targetName: string): Promise<void> {
    const u = USAGE[targetName];
    if (u === undefined) return Promise.reject(new Error(`Unknown target key: ${targetName}`));
    return this.mapHidUsage(hw, u.code);
  }

  /** Remap a hardware key to a modifier+key CHORD (e.g. cmd + f13). */
  mapChord(hw: string | number, modName: string, keyName: string): Promise<void> {
    let code: number;
    try {
      code = chordUsage(modName, keyName);
    } catch (e) {
      return Promise.reject(e);
    }
    return this.mapHidUsage(hw, code);
  }

  /**
   * Name the current profile. This is what PERSISTS and ACTIVATES the stored
   * maps on the keyboard itself — an unnamed profile only exists on the PC, so
   * maps don't take physical effect until the profile is created/named.
   */
  createProfile(name: string): Promise<void> {
    if (name.length < 1 || name.length > 24) {
      return Promise.reject(new Error('Profile name must be 1-24 characters.'));
    }
    return this.exclusive(async () => {
      await this.handshake();
      await this.write([...PROFILE_RENAME, ...encodeName(name)]);
      await this.readExpect(OK);
    });
  }

  /** Delete the current profile, clearing its maps (reverts to default). */
  deleteProfile(): Promise<void> {
    return this.exclusive(async () => {
      await this.write(PROFILE_DELETE);
      await this.readExpect(OK);
    });
  }
}
