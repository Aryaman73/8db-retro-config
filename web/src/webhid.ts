// WebHID transport: lets the protocol client in src/client.ts drive the
// keyboard straight from the browser (Chrome/Edge), no native helper needed.
import { Keyboard, type Transport } from '../../src/client.ts';
import { VENDOR_ID, PRODUCT_IDS, CONFIG_USAGE_PAGE } from '../../src/protocol/consts.ts';

/** Every device -> host config response uses report ID 0x54. */
const RESPONSE_REPORT_ID = 0x54;

export const REQUEST_FILTERS: HIDDeviceFilter[] = PRODUCT_IDS.map((productId) => ({
  vendorId: VENDOR_ID,
  productId,
  usagePage: CONFIG_USAGE_PAGE,
}));

/** True for the keyboard's vendor config interface (not its typing interfaces). */
export function isConfigInterface(d: HIDDevice): boolean {
  return (
    d.vendorId === VENDOR_ID &&
    PRODUCT_IDS.includes(d.productId) &&
    d.collections.some((c) => c.usagePage === CONFIG_USAGE_PAGE)
  );
}

function webHidTransport(dev: HIDDevice): Transport {
  const queue: number[][] = [];
  let waiter: ((r: number[]) => void) | null = null;

  const onReport = (e: HIDInputReportEvent) => {
    if (e.reportId !== RESPONSE_REPORT_ID) return;
    const r = [e.reportId, ...new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength)];
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(r);
    } else {
      queue.push(r);
    }
  };
  dev.addEventListener('inputreport', onReport);

  return {
    async write(report) {
      // The client reads every response before sending its next command, so
      // anything still queued is a late reply to an earlier, timed-out one.
      queue.length = 0;
      await dev.sendReport(report[0], new Uint8Array(report.slice(1)));
    },
    read(timeoutMs) {
      const next = queue.shift();
      if (next) return Promise.resolve(next);
      return new Promise((resolve) => {
        const done = (r: number[]) => {
          clearTimeout(timer);
          resolve(r);
        };
        const timer = setTimeout(() => {
          if (waiter === done) waiter = null;
          resolve([]);
        }, timeoutMs);
        waiter = done;
      });
    },
    async close() {
      dev.removeEventListener('inputreport', onReport);
      if (dev.opened) await dev.close();
    },
  };
}

export async function openKeyboard(dev: HIDDevice): Promise<Keyboard> {
  if (!dev.opened) await dev.open();
  return new Keyboard(webHidTransport(dev));
}
