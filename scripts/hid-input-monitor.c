// Passive HID input-value monitor for the 8BitDo keyboard.
//
// Registers an IOHIDManager input-value callback (non-exclusive,
// kIOHIDOptionsTypeNone) and prints the usagePage/usage of every key event.
// Unlike node-hid it does NOT seize the interface, so it coexists with the
// macOS driver and reveals the RAW usage the firmware emits for a physical key
// (e.g. does SCRLK send ScrollLock 0x07/0x47, or F14 0x07/0x69?) — even when
// macOS separately consumes that usage (F14/F15 -> brightness).
//
// NOTE: monitoring keyboard usages requires Input Monitoring permission
// (System Settings > Privacy & Security > Input Monitoring) for the terminal.
// If no events print when you press keys, grant it and re-run.
//
// Build: clang scripts/hid-input-monitor.c -o /tmp/hid-mon \
//              -framework IOKit -framework CoreFoundation
// Run:   /tmp/hid-mon           # listens ~20s, press the keys under test

#include <IOKit/hid/IOHIDManager.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>

#define VID 0x2dc8

static const char *usage_name(uint32_t page, uint32_t usage) {
    if (page == 0x07) {
        switch (usage) {
            case 0x47: return "ScrollLock";
            case 0x48: return "Pause";
            case 0x46: return "PrintScreen";
            case 0x68: return "F13"; case 0x69: return "F14"; case 0x6a: return "F15";
            case 0x6b: return "F16"; case 0x6c: return "F17"; case 0x6d: return "F18";
            case 0x6e: return "F19"; case 0x6f: return "F20"; case 0x70: return "F21";
            case 0x71: return "F22"; case 0x72: return "F23"; case 0x73: return "F24";
            case 0x3a: return "F1"; case 0x3b: return "F2"; case 0x3c: return "F3";
            case 0x3d: return "F4"; case 0x3e: return "F5"; case 0x3f: return "F6";
            case 0x40: return "F7"; case 0x41: return "F8"; case 0x42: return "F9";
            case 0x43: return "F10"; case 0x44: return "F11"; case 0x45: return "F12";
            case 0x49: return "Insert"; case 0x4a: return "Home"; case 0x4b: return "PageUp";
            case 0x4c: return "Delete"; case 0x4d: return "End"; case 0x4e: return "PageDown";
        }
    }
    if (page == 0x0c) {
        switch (usage) {
            case 0x6f: return "Brightness Up (consumer)";
            case 0x70: return "Brightness Down (consumer)";
            case 0xe9: return "Volume Up (consumer)";
            case 0xea: return "Volume Down (consumer)";
            case 0xe2: return "Mute (consumer)";
        }
    }
    return "";
}

static void put_num(CFMutableDictionaryRef d, const char *k, int v) {
    CFStringRef key = CFStringCreateWithCString(NULL, k, kCFStringEncodingUTF8);
    CFNumberRef num = CFNumberCreate(NULL, kCFNumberIntType, &v);
    CFDictionarySetValue(d, key, num);
    CFRelease(key); CFRelease(num);
}

static void input_cb(void *ctx, IOReturn res, void *sender, IOHIDValueRef value) {
    (void)ctx; (void)res; (void)sender;
    IOHIDElementRef el = IOHIDValueGetElement(value);
    uint32_t page = IOHIDElementGetUsagePage(el);
    uint32_t usage = IOHIDElementGetUsage(el);
    CFIndex v = IOHIDValueGetIntegerValue(value);
    // Only report keyboard (0x07) and consumer (0x0c) pages, on key-DOWN (v!=0).
    if ((page == 0x07 || page == 0x0c) && v != 0) {
        const char *name = usage_name(page, usage);
        printf("page=0x%02x usage=0x%02x val=%ld  %s\n", page, usage, (long)v, name);
        fflush(stdout);
    }
}

int main(void) {
    IOHIDManagerRef mgr = IOHIDManagerCreate(kCFAllocatorDefault, kIOHIDOptionsTypeNone);
    CFMutableDictionaryRef m = CFDictionaryCreateMutable(NULL, 0,
        &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
    put_num(m, kIOHIDVendorIDKey, VID);
    IOHIDManagerSetDeviceMatching(mgr, m);
    CFRelease(m);
    IOHIDManagerRegisterInputValueCallback(mgr, input_cb, NULL);
    IOHIDManagerScheduleWithRunLoop(mgr, CFRunLoopGetCurrent(), kCFRunLoopDefaultMode);
    IOReturn r = IOHIDManagerOpen(mgr, kIOHIDOptionsTypeNone);
    if (r != kIOReturnSuccess) {
        fprintf(stderr, "IOHIDManagerOpen failed: 0x%08x\n", r);
        return 1;
    }
    fprintf(stderr, "Listening ~20s. Press the keys under test now...\n");
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, 20.0, false);
    fprintf(stderr, "Done.\n");
    return 0;
}
