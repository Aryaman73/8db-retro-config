// A simulated keyboard that speaks the same config protocol, so the page can be
// tried without the hardware. It only ever lives in memory.
import { Keyboard, type Transport } from '../../src/client.ts';
import { REPORT_SIZE } from '../../src/protocol/consts.ts';
import { HWKEY } from '../../src/protocol/keys.ts';

const READY = [0x54, 0x8a, 0x07, 0x01];
const OK = [0x54, 0xe4, 0x08];
const PAIRS_PER_FRAME = 15; // bytes 2..31 of a 33-byte report

const pad = (a: number[]) => a.concat(Array(Math.max(0, REPORT_SIZE - a.length)).fill(0));

function demoTransport(): Transport {
  let name: string | null = 'demo';
  const maps = new Map<number, number>([
    [HWKEY.supera, 0x07e368], // ⌘F13
    [HWKEY.insert, 0x07006b], // F16
    [HWKEY.f12, 0x0ce200], // Mute
    [0x75, 0x07e36e], // left Super Button -> ⌘F19
  ]);
  const out: number[][] = [];

  function handle(r: number[]) {
    const cmd = r[1];
    if (cmd === 0x76) return out.push(pad(r[2] === 0xff ? READY : OK));
    if (cmd === 0x80) {
      if (name === null) return out.push(pad([0x54, 0x80, 0x00, 0x00]));
      const bytes = [...name].flatMap((c) => [c.charCodeAt(0) >> 8, c.charCodeAt(0) & 0xff]);
      return out.push(pad([0x54, 0x80, 0x10, 0x00, ...bytes]));
    }
    if (cmd === 0x81) {
      const codes = [...maps.keys()];
      do {
        const chunk = codes.splice(0, PAIRS_PER_FRAME);
        const frame = pad([0x54, 0x81, ...chunk.flatMap((c) => [c, 0])]);
        frame[REPORT_SIZE - 1] = codes.length ? 0x01 : 0x00;
        out.push(frame);
      } while (codes.length);
      return;
    }
    if (cmd === 0x83) {
      const u = maps.get(r[2]) ?? 0;
      return out.push(pad([0x54, 0x83, r[2], (u >> 16) & 0xff, (u >> 8) & 0xff, u & 0xff]));
    }
    if (cmd === 0xfa) {
      maps.set(r[8], (r[9] << 16) | (r[10] << 8) | r[11]);
      return out.push(pad(OK));
    }
    if (cmd === 0x70 && r[2] === 0x10) {
      let s = '';
      for (let i = 4; i + 1 < r.length && (r[i] || r[i + 1]); i += 2) s += String.fromCharCode((r[i] << 8) | r[i + 1]);
      name = s;
      return out.push(pad(OK));
    }
    if (cmd === 0x70) {
      name = null;
      maps.clear();
      return out.push(pad(OK));
    }
  }

  return {
    async write(report) {
      out.length = 0;
      handle(report);
    },
    async read() {
      await new Promise((r) => setTimeout(r, 4)); // feel like a device, not a function call
      return out.shift() ?? [];
    },
    async close() {},
  };
}

export function openDemoKeyboard(): Keyboard {
  return new Keyboard(demoTransport());
}
