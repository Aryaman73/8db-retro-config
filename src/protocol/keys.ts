// AUTO-GENERATED from reference/keys.py by scripts/gen-keys.js. Do not edit by hand.
// Source protocol/key tables: github.com/goncalor/8bitdo-kbd-mapper (see NOTICE).

/** Hardware key name -> physical key code used by the keyboard's config protocol. */
export const HWKEY: Record<string, number> = {
  "0": 39,
  "1": 30,
  "2": 31,
  "3": 32,
  "4": 33,
  "5": 34,
  "6": 35,
  "7": 36,
  "8": 37,
  "9": 38,
  "esc": 41,
  "f1": 58,
  "f2": 59,
  "f3": 60,
  "f4": 61,
  "f5": 62,
  "f6": 63,
  "f7": 64,
  "f8": 65,
  "f9": 66,
  "f10": 67,
  "f11": 68,
  "f12": 69,
  "prtsc": 70,
  "scrlk": 71,
  "pause": 72,
  "grave": 53,
  "minus": 45,
  "equal": 46,
  "backspace": 42,
  "insert": 73,
  "home": 74,
  "pageup": 75,
  "tab": 43,
  "q": 20,
  "w": 26,
  "e": 8,
  "r": 21,
  "t": 23,
  "y": 28,
  "u": 24,
  "i": 12,
  "o": 18,
  "p": 19,
  "leftbrace": 47,
  "rightbrace": 48,
  "backslash": 49,
  "delete": 76,
  "end": 77,
  "pagedown": 78,
  "capslock": 57,
  "a": 4,
  "s": 22,
  "d": 7,
  "f": 9,
  "g": 10,
  "h": 11,
  "j": 13,
  "k": 14,
  "l": 15,
  "semicolon": 51,
  "apostrophe": 52,
  "enter": 40,
  "leftshift": 101,
  "z": 29,
  "x": 27,
  "c": 6,
  "v": 25,
  "b": 5,
  "n": 17,
  "m": 16,
  "comma": 54,
  "dot": 55,
  "slash": 56,
  "rightshift": 105,
  "up": 82,
  "leftctrl": 100,
  "windows": 103,
  "leftmeta": 103,
  "leftalt": 102,
  "space": 44,
  "rightalt": 106,
  "superb": 108,
  "rightmeta": 108,
  "supera": 109,
  "compose": 109,
  "menu": 109,
  "rightctrl": 104,
  "left": 80,
  "down": 81,
  "right": 79
};

/** HID usage name -> { code, desc }. `code` is the 3-byte HID usage (page<<16 | usage). */
export const USAGE: Record<string, { code: number; desc: string }> = {
  "0": {
    "code": 458791,
    "desc": "Keyboard 0 and )"
  },
  "1": {
    "code": 458782,
    "desc": "Keyboard 1 and !"
  },
  "2": {
    "code": 458783,
    "desc": "Keyboard 2 and @"
  },
  "3": {
    "code": 458784,
    "desc": "Keyboard 3 and #"
  },
  "4": {
    "code": 458785,
    "desc": "Keyboard 4 and $"
  },
  "5": {
    "code": 458786,
    "desc": "Keyboard 5 and %"
  },
  "6": {
    "code": 458787,
    "desc": "Keyboard 6 and ^"
  },
  "7": {
    "code": 458788,
    "desc": "Keyboard 7 and &"
  },
  "8": {
    "code": 458789,
    "desc": "Keyboard 8 and *"
  },
  "9": {
    "code": 458790,
    "desc": "Keyboard 9 and ("
  },
  "none": {
    "code": 458752,
    "desc": "(no key pressed)"
  },
  "a": {
    "code": 458756,
    "desc": "Keyboard a and A"
  },
  "b": {
    "code": 458757,
    "desc": "Keyboard b and B"
  },
  "c": {
    "code": 458758,
    "desc": "Keyboard c and C"
  },
  "d": {
    "code": 458759,
    "desc": "Keyboard d and D"
  },
  "e": {
    "code": 458760,
    "desc": "Keyboard e and E"
  },
  "f": {
    "code": 458761,
    "desc": "Keyboard f and F"
  },
  "g": {
    "code": 458762,
    "desc": "Keyboard g and G"
  },
  "h": {
    "code": 458763,
    "desc": "Keyboard h and H"
  },
  "i": {
    "code": 458764,
    "desc": "Keyboard i and I"
  },
  "j": {
    "code": 458765,
    "desc": "Keyboard j and J"
  },
  "k": {
    "code": 458766,
    "desc": "Keyboard k and K"
  },
  "l": {
    "code": 458767,
    "desc": "Keyboard l and L"
  },
  "m": {
    "code": 458768,
    "desc": "Keyboard m and M"
  },
  "n": {
    "code": 458769,
    "desc": "Keyboard n and N"
  },
  "o": {
    "code": 458770,
    "desc": "Keyboard o and O"
  },
  "p": {
    "code": 458771,
    "desc": "Keyboard p and P"
  },
  "q": {
    "code": 458772,
    "desc": "Keyboard q and Q"
  },
  "r": {
    "code": 458773,
    "desc": "Keyboard r and R"
  },
  "s": {
    "code": 458774,
    "desc": "Keyboard s and S"
  },
  "t": {
    "code": 458775,
    "desc": "Keyboard t and T"
  },
  "u": {
    "code": 458776,
    "desc": "Keyboard u and U"
  },
  "v": {
    "code": 458777,
    "desc": "Keyboard v and V"
  },
  "w": {
    "code": 458778,
    "desc": "Keyboard w and W"
  },
  "x": {
    "code": 458779,
    "desc": "Keyboard x and X"
  },
  "y": {
    "code": 458780,
    "desc": "Keyboard y and Y"
  },
  "z": {
    "code": 458781,
    "desc": "Keyboard z and Z"
  },
  "enter": {
    "code": 458792,
    "desc": "Keyboard Return (ENTER)"
  },
  "esc": {
    "code": 458793,
    "desc": "Keyboard ESCAPE"
  },
  "backspace": {
    "code": 458794,
    "desc": "Keyboard DELETE (Backspace)"
  },
  "tab": {
    "code": 458795,
    "desc": "Keyboard Tab"
  },
  "space": {
    "code": 458796,
    "desc": "Keyboard Spacebar"
  },
  "minus": {
    "code": 458797,
    "desc": "Keyboard - and _"
  },
  "equal": {
    "code": 458798,
    "desc": "Keyboard = and +"
  },
  "leftbrace": {
    "code": 458799,
    "desc": "Keyboard [ and {"
  },
  "rightbrace": {
    "code": 458800,
    "desc": "Keyboard ] and }"
  },
  "backslash": {
    "code": 458801,
    "desc": "Keyboard \\\\ and |"
  },
  "hashtilde": {
    "code": 458802,
    "desc": "Keyboard Non-US # and ~"
  },
  "semicolon": {
    "code": 458803,
    "desc": "Keyboard ; and :"
  },
  "apostrophe": {
    "code": 458804,
    "desc": "Keyboard ' and \\\""
  },
  "grave": {
    "code": 458805,
    "desc": "Keyboard ` and ~"
  },
  "comma": {
    "code": 458806,
    "desc": "Keyboard , and <"
  },
  "dot": {
    "code": 458807,
    "desc": "Keyboard . and >"
  },
  "slash": {
    "code": 458808,
    "desc": "Keyboard / and ?"
  },
  "capslock": {
    "code": 458809,
    "desc": "Keyboard Caps Lock"
  },
  "f1": {
    "code": 458810,
    "desc": "Keyboard F1"
  },
  "f2": {
    "code": 458811,
    "desc": "Keyboard F2"
  },
  "f3": {
    "code": 458812,
    "desc": "Keyboard F3"
  },
  "f4": {
    "code": 458813,
    "desc": "Keyboard F4"
  },
  "f5": {
    "code": 458814,
    "desc": "Keyboard F5"
  },
  "f6": {
    "code": 458815,
    "desc": "Keyboard F6"
  },
  "f7": {
    "code": 458816,
    "desc": "Keyboard F7"
  },
  "f8": {
    "code": 458817,
    "desc": "Keyboard F8"
  },
  "f9": {
    "code": 458818,
    "desc": "Keyboard F9"
  },
  "f10": {
    "code": 458819,
    "desc": "Keyboard F10"
  },
  "f11": {
    "code": 458820,
    "desc": "Keyboard F11"
  },
  "f12": {
    "code": 458821,
    "desc": "Keyboard F12"
  },
  "f13": {
    "code": 458870,
    "desc": "Keyboard F13"
  },
  "f14": {
    "code": 458871,
    "desc": "Keyboard F14"
  },
  "f15": {
    "code": 458872,
    "desc": "Keyboard F15"
  },
  "f16": {
    "code": 458873,
    "desc": "Keyboard F16"
  },
  "f17": {
    "code": 458874,
    "desc": "Keyboard F17"
  },
  "f18": {
    "code": 458875,
    "desc": "Keyboard F18"
  },
  "f19": {
    "code": 458876,
    "desc": "Keyboard F19"
  },
  "f20": {
    "code": 458877,
    "desc": "Keyboard F20"
  },
  "f21": {
    "code": 458878,
    "desc": "Keyboard F21"
  },
  "f22": {
    "code": 458879,
    "desc": "Keyboard F22"
  },
  "f23": {
    "code": 458880,
    "desc": "Keyboard F23"
  },
  "f24": {
    "code": 458881,
    "desc": "Keyboard F24"
  },
  "sysrq": {
    "code": 458822,
    "desc": "Keyboard PrintScreen"
  },
  "prtsc": {
    "code": 458822,
    "desc": "Keyboard PrintScreen"
  },
  "scrolllock": {
    "code": 458823,
    "desc": "Keyboard Scroll Lock"
  },
  "scrlk": {
    "code": 458823,
    "desc": "Keyboard Scroll Lock"
  },
  "pause": {
    "code": 458824,
    "desc": "Keyboard Pause"
  },
  "insert": {
    "code": 458825,
    "desc": "Keyboard Insert"
  },
  "home": {
    "code": 458826,
    "desc": "Keyboard Home"
  },
  "pageup": {
    "code": 458827,
    "desc": "Keyboard Page Up"
  },
  "delete": {
    "code": 458828,
    "desc": "Keyboard Delete Forward"
  },
  "end": {
    "code": 458829,
    "desc": "Keyboard End"
  },
  "pagedown": {
    "code": 458830,
    "desc": "Keyboard Page Down"
  },
  "right": {
    "code": 458831,
    "desc": "Keyboard Right Arrow"
  },
  "left": {
    "code": 458832,
    "desc": "Keyboard Left Arrow"
  },
  "down": {
    "code": 458833,
    "desc": "Keyboard Down Arrow"
  },
  "up": {
    "code": 458834,
    "desc": "Keyboard Up Arrow"
  },
  "numlock": {
    "code": 458835,
    "desc": "Keyboard Num Lock and Clear"
  },
  "kpslash": {
    "code": 458836,
    "desc": "Keypad /"
  },
  "kpasterisk": {
    "code": 458837,
    "desc": "Keypad *"
  },
  "kpminus": {
    "code": 458838,
    "desc": "Keypad -"
  },
  "kpplus": {
    "code": 458839,
    "desc": "Keypad +"
  },
  "kpenter": {
    "code": 458840,
    "desc": "Keypad ENTER"
  },
  "kp1": {
    "code": 458841,
    "desc": "Keypad 1 and End"
  },
  "kp2": {
    "code": 458842,
    "desc": "Keypad 2 and Down Arrow"
  },
  "kp3": {
    "code": 458843,
    "desc": "Keypad 3 and PageDn"
  },
  "kp4": {
    "code": 458844,
    "desc": "Keypad 4 and Left Arrow"
  },
  "kp5": {
    "code": 458845,
    "desc": "Keypad 5"
  },
  "kp6": {
    "code": 458846,
    "desc": "Keypad 6 and Right Arrow"
  },
  "kp7": {
    "code": 458847,
    "desc": "Keypad 7 and Home"
  },
  "kp8": {
    "code": 458848,
    "desc": "Keypad 8 and Up Arrow"
  },
  "kp9": {
    "code": 458849,
    "desc": "Keypad 9 and Page Up"
  },
  "kp0": {
    "code": 458850,
    "desc": "Keypad 0 and Insert"
  },
  "kpdot": {
    "code": 458851,
    "desc": "Keypad . and Delete"
  },
  "102nd": {
    "code": 458852,
    "desc": "Keyboard Non-US \\\\ and |"
  },
  "compose": {
    "code": 458853,
    "desc": "Keyboard Application"
  },
  "supera": {
    "code": 458853,
    "desc": "Keyboard Application"
  },
  "menu": {
    "code": 458853,
    "desc": "Keyboard Application"
  },
  "leftctrl": {
    "code": 516096,
    "desc": "Keyboard Left Control"
  },
  "leftshift": {
    "code": 516352,
    "desc": "Keyboard Left Shift"
  },
  "leftalt": {
    "code": 516608,
    "desc": "Keyboard Left Alt"
  },
  "leftmeta": {
    "code": 516864,
    "desc": "Keyboard Left GUI"
  },
  "windows": {
    "code": 516864,
    "desc": "Keyboard Left GUI"
  },
  "rightctrl": {
    "code": 517120,
    "desc": "Keyboard Right Control"
  },
  "rightshift": {
    "code": 517376,
    "desc": "Keyboard Right Shift"
  },
  "rightalt": {
    "code": 517632,
    "desc": "Keyboard Right Alt"
  },
  "rightmeta": {
    "code": 517888,
    "desc": "Keyboard Right GUI"
  },
  "superb": {
    "code": 517888,
    "desc": "Keyboard Right GUI"
  },
  "playpause": {
    "code": 838912,
    "desc": "Play/Pause"
  },
  "nextsong": {
    "code": 832768,
    "desc": "Scan Next Track"
  },
  "previoussong": {
    "code": 833024,
    "desc": "Scan Previous Track"
  },
  "mute": {
    "code": 844288,
    "desc": "Mute"
  },
  "volumeup": {
    "code": 846080,
    "desc": "Volume Increment"
  },
  "volumedown": {
    "code": 846336,
    "desc": "Volume Decrement"
  },
  "calc": {
    "code": 823809,
    "desc": "AL Calculator"
  },
  "btn_left": {
    "code": 1103806595072,
    "desc": "left click"
  },
  "btn_right": {
    "code": 1108101562368,
    "desc": "right click"
  },
  "btn_middle": {
    "code": 1116691496960,
    "desc": "scroll click"
  },
  "btn_extra": {
    "code": 1133871366144,
    "desc": "mouse button 4"
  },
  "btn_side": {
    "code": 1168231104512,
    "desc": "mouse button 5"
  }
};

/** Reverse lookup: hardware key code -> name. */
export const HWKEY_BY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(HWKEY).map(([name, code]) => [code, name]),
);

/** Reverse lookup: HID usage code -> name. */
export const USAGE_BY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(USAGE).map(([name, v]) => [v.code, name]),
);
