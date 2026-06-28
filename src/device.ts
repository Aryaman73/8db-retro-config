import HID from 'node-hid';
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
