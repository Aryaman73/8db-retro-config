// 8BitDo Retro Mechanical Keyboard config protocol constants.
// The leading byte of each command is the HID *report ID*; the rest is payload.
// Reverse-engineered by github.com/goncalor/8bitdo-kbd-mapper (see NOTICE).

export const VENDOR_ID = 0x2dc8;
export const PRODUCT_IDS = [0x5200, 0x5209]; // 0x5200 = Retro Mechanical (incl. N Edition), 0x5209 = Retro 108

/** Vendor config interface lives on USB interface #2 (HID usage page 0x8c). */
export const CONFIG_INTERFACE = 2;
export const CONFIG_USAGE_PAGE = 0x8c;

/** Reports are report-ID + 32-byte payload = 33 bytes on the wire. */
export const REPORT_SIZE = 33;

// --- host -> device (writes) ---
export const ATTN = [0x52, 0x76, 0xff]; // attention / handshake
export const MAP = [0x52, 0xfa, 0x03, 0x0c, 0x00, 0xaa, 0x09, 0x71]; // WRITE: remap a key
export const MAP_DONE = [0x52, 0x76, 0xa5]; // WRITE: commit map
export const PROFILE_GET_NAME = [0x52, 0x80];
export const PROFILE_GET_MAPPED = [0x52, 0x81];
export const PROFILE_DELETE = [0x52, 0x70]; // WRITE
export const PROFILE_RENAME = [0x52, 0x70, 0x10, 0x00]; // WRITE
export const MAPPING_GET = [0x52, 0x83];

// --- device -> host (response prefixes) ---
export const READY = [0x54, 0x8a, 0x07, 0x01];
export const OK = [0x54, 0xe4, 0x08];
export const PROFILE_NAME = [0x54, 0x80, 0x10, 0x00];
export const PROFILE_108_NAME = [0x54, 0x80, 0x0a, 0x00];
export const PROFILE_NONE = [0x54, 0x80, 0x00, 0x00];
export const PROFILE_MAPPED = [0x54, 0x81];
export const MAPPING = [0x54, 0x83];
