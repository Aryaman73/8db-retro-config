import HID from 'node-hid';
import { Keyboard, type Transport } from './client.ts';
import {
  VENDOR_ID,
  PRODUCT_IDS,
  CONFIG_INTERFACE,
  CONFIG_USAGE_PAGE,
} from './protocol/consts.ts';

export interface FoundDevice {
  product: string;
  productId: number;
  path: string;
  interface: number;
  usagePage: number;
}

/**
 * Locate the keyboard's vendor *config* interface (USB interface #2).
 * On macOS the keyboard interfaces are protected, but this vendor interface
 * (usage page 0x8c) is openable from userland with no special entitlement.
 */
export function findConfigDevice(): FoundDevice | undefined {
  const all = HID.devices().filter(
    (d) => d.vendorId === VENDOR_ID && PRODUCT_IDS.includes(d.productId ?? -1),
  );
  const d =
    all.find((x) => x.interface === CONFIG_INTERFACE) ??
    all.find((x) => (x.usagePage ?? 0) === CONFIG_USAGE_PAGE);
  if (!d || !d.path) return undefined;
  return {
    product: d.product ?? 'unknown',
    productId: d.productId ?? 0,
    path: d.path,
    interface: d.interface ?? -1,
    usagePage: d.usagePage ?? 0,
  };
}

/** Transport over node-hid's (synchronous) device API. */
export function nodeHidTransport(dev: Pick<HID.HID, 'write' | 'readTimeout' | 'close'>): Transport {
  return {
    write: async (report) => void dev.write(report),
    read: async (timeoutMs) => dev.readTimeout(timeoutMs),
    close: async () => dev.close(),
  };
}

/** Open the config interface, or throw a friendly error if not found. */
export function openKeyboard(): Keyboard {
  const info = findConfigDevice();
  if (!info) {
    throw new Error(
      'No 8BitDo keyboard config interface found. Connect it via USB-C with the power switch OFF.',
    );
  }
  return new Keyboard(nodeHidTransport(new HID.HID(info.path)));
}
