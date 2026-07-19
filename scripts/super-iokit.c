// Native IOKit driver for the 8BitDo Advance super-button protocol on macOS.
//
// Replicates EXACTLY what the official macOS app "8BitDo Ultimate Software V2"
// does (verified by RE of its binary):
//     IOHIDDeviceSetReport(dev, kIOHIDReportTypeFeature, 0x81, buf, 64)   // write cmd
//     usleep(1000)
//     IOHIDDeviceGetReport(dev, kIOHIDReportTypeFeature, 0x81, buf, 64)   // read reply
// Report ID 0x81, 64-byte FEATURE reports (GET/SET_REPORT control transfers).
//
// Build:  clang scripts/super-iokit.c -o /tmp/super-iokit \
//               -framework IOKit -framework CoreFoundation
// Run:    /tmp/super-iokit read           # readSuper (0x11) NON-MUTATING
//         /tmp/super-iokit index          # getSuperIndex (0x19) NON-MUTATING
//         /tmp/super-iokit getonly        # pure GET_FEATURE, no write
//         /tmp/super-iokit raw <hex>      # send arbitrary 64B feature report

#include <IOKit/hid/IOHIDManager.h>
#include <IOKit/hid/IOHIDDevice.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define VID 0x2dc8
#define PID 0x5200
#define USAGE_PAGE 0x8c
#define REPORT_ID 0x81
#define RLEN 64

static void put_num(CFMutableDictionaryRef d, const char *k, int v) {
    CFStringRef key = CFStringCreateWithCString(NULL, k, kCFStringEncodingUTF8);
    CFNumberRef num = CFNumberCreate(NULL, kCFNumberIntType, &v);
    CFDictionarySetValue(d, key, num);
    CFRelease(key); CFRelease(num);
}

static void hexprint(const char *label, const uint8_t *b, int n) {
    printf("%s", label);
    for (int i = 0; i < n; i++) printf("%02x ", b[i]);
    printf("\n");
}

static void build_packet(uint8_t *p, uint8_t cmd, uint8_t subcmd, uint8_t dataLen,
                         uint32_t offset, const uint8_t *data, int dlen) {
    memset(p, 0, RLEN);
    p[0] = REPORT_ID; p[1] = 0x04; p[2] = cmd; p[3] = subcmd; p[4] = dataLen;
    uint32_t sum = 0; for (int i = 0; i < dlen; i++) sum += data[i];
    p[5] = sum & 0xff;
    p[6] = offset & 0xff; p[7] = (offset >> 8) & 0xff;
    p[8] = (offset >> 16) & 0xff; p[9] = (offset >> 24) & 0xff;
    for (int i = 0; i < dlen && 10 + i < RLEN; i++) p[10 + i] = data[i];
}

static IOHIDDeviceRef open_device(void) {
    IOHIDManagerRef mgr = IOHIDManagerCreate(kCFAllocatorDefault, kIOHIDOptionsTypeNone);
    CFMutableDictionaryRef m = CFDictionaryCreateMutable(NULL, 0,
        &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
    put_num(m, kIOHIDVendorIDKey, VID);
    put_num(m, kIOHIDProductIDKey, PID);
    put_num(m, kIOHIDDeviceUsagePageKey, USAGE_PAGE);
    put_num(m, kIOHIDDeviceUsageKey, 1);
    IOHIDManagerSetDeviceMatching(mgr, m);
    CFRelease(m);
    IOHIDManagerScheduleWithRunLoop(mgr, CFRunLoopGetCurrent(), kCFRunLoopDefaultMode);
    IOReturn o = IOHIDManagerOpen(mgr, kIOHIDOptionsTypeNone);
    if (o != kIOReturnSuccess) { fprintf(stderr, "IOHIDManagerOpen failed: 0x%08x\n", o); exit(1); }
    CFSetRef devs = IOHIDManagerCopyDevices(mgr);
    if (!devs || CFSetGetCount(devs) == 0) {
        fprintf(stderr, "no matching device (VID 0x2dc8 PID 0x5200 usagePage 0x8c). Plugged in via USB-C?\n");
        exit(1);
    }
    CFIndex n = CFSetGetCount(devs);
    const void **arr = malloc(sizeof(void*) * n);
    CFSetGetValues(devs, arr);
    IOHIDDeviceRef dev = (IOHIDDeviceRef)arr[0];
    CFRetain(dev);
    free(arr); CFRelease(devs);
    IOReturn od = IOHIDDeviceOpen(dev, kIOHIDOptionsTypeNone);
    if (od != kIOReturnSuccess) { fprintf(stderr, "IOHIDDeviceOpen failed: 0x%08x\n", od); exit(1); }
    return dev;
}

static void round_trip(IOHIDDeviceRef dev, const char *label, uint8_t *cmd) {
    printf("\n=== %s ===\n", label);
    hexprint("  TX: ", cmd, 16);
    IOReturn sr = IOHIDDeviceSetReport(dev, kIOHIDReportTypeFeature, cmd[0], cmd, RLEN);
    printf("  SET_FEATURE(0x%02x) -> 0x%08x %s\n", cmd[0], sr, sr == kIOReturnSuccess ? "OK" : "ERR");
    usleep(1000);
    uint8_t buf[RLEN]; memset(buf, 0, RLEN);
    CFIndex rlen = RLEN;
    IOReturn gr = IOHIDDeviceGetReport(dev, kIOHIDReportTypeFeature, REPORT_ID, buf, &rlen);
    if (gr == kIOReturnSuccess) {
        printf("  GET_FEATURE(0x81) -> OK (%ld B):\n", (long)rlen);
        hexprint("    ", buf, (int)rlen);
    } else {
        printf("  GET_FEATURE(0x81) -> ERR 0x%08x\n", gr);
    }
}

int main(int argc, char **argv) {
    const char *mode = argc > 1 ? argv[1] : "read";
    IOHIDDeviceRef dev = open_device();
    printf("opened IOHIDDevice VID 0x2dc8 PID 0x5200 usagePage 0x8c\n");
    uint8_t p[RLEN];

    if (!strcmp(mode, "read")) {
        build_packet(p, 0x11, 0, 0x35, 0, NULL, 0);
        round_trip(dev, "readSuper 0x11 (len=0x35 off=0)", p);
        build_packet(p, 0x11, 0, 0, 0, NULL, 0);
        round_trip(dev, "readSuper 0x11 (len=0 off=0)", p);
    } else if (!strcmp(mode, "index")) {
        build_packet(p, 0x19, 0, 0, 0, NULL, 0);
        round_trip(dev, "getSuperIndex 0x19", p);
    } else if (!strcmp(mode, "getonly")) {
        uint8_t buf[RLEN]; memset(buf, 0, RLEN);
        CFIndex rlen = RLEN;
        IOReturn gr = IOHIDDeviceGetReport(dev, kIOHIDReportTypeFeature, REPORT_ID, buf, &rlen);
        printf("GET_FEATURE(0x81) only -> 0x%08x (%ld):\n", gr, (long)rlen);
        if (gr == kIOReturnSuccess) hexprint("  ", buf, (int)rlen);
    } else if (!strcmp(mode, "raw")) {
        if (argc < 3) { fprintf(stderr, "raw needs hex\n"); return 1; }
        const char *h = argv[2];
        int n = 0;
        for (int i = 0; h[i] && h[i+1] && n < RLEN; i += 2) {
            unsigned v; sscanf(h + i, "%2x", &v); p[n++] = (uint8_t)v;
        }
        for (; n < RLEN; n++) p[n] = 0;
        round_trip(dev, "raw", p);
    } else {
        fprintf(stderr, "unknown mode\n"); return 1;
    }

    IOHIDDeviceClose(dev, kIOHIDOptionsTypeNone);
    return 0;
}
