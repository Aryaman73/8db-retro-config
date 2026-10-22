// Raw-USB probe for the external Super-Button ("Advance") channel via macOS
// device CAPTURE — the same mechanism UTM/VMware USB passthrough uses. It takes
// the keyboard away from macOS's HID driver for a few seconds, talks to iface 2's
// INTERRUPT OUT/IN endpoints directly (what the Windows app's WriteFile/ReadFile
// use), then hands the keyboard back. This sidesteps the kIOReturnExclusiveAccess
// wall that super-usb.c hit with USBInterfaceOpen/Seize.
//
// Capture needs root (or the com.apple.vm.device-access entitlement).
//
// NON-MUTATING: sends only reads — legacy PROFILE_GET_NAME as a sanity check of
// the interrupt-OUT path, then Advance readSuper (0x11). The keyboard won't type
// on the Mac while captured; it's released on exit. If anything goes wrong,
// unplug/replug the keyboard to give it back to macOS.
//
// Build: clang scripts/super-capture.c -o /tmp/super-capture \
//          -I/opt/homebrew/include -L/opt/homebrew/lib -lusb-1.0
// Run:   sudo /tmp/super-capture

#include <libusb-1.0/libusb.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#define VID 0x2dc8
#define PID 0x5200
#define IFACE 2

static void hexp(const char *l, const uint8_t *b, int n) {
    printf("%s", l);
    for (int i = 0; i < n; i++) printf("%02x ", b[i]);
    printf("\n");
}

// Print interrupt-IN reports until one read times out.
static void read_in(libusb_device_handle *h, uint8_t ep, int max) {
    for (int i = 0; i < 4; i++) {
        uint8_t rx[64] = {0};
        int got = 0;
        int r = libusb_interrupt_transfer(h, ep, rx, max, &got, 500);
        if (r == LIBUSB_ERROR_TIMEOUT) {
            if (i == 0) printf("  RX: (timeout, no reply)\n");
            return;
        }
        if (r != 0) {
            printf("  RX error: %s\n", libusb_error_name(r));
            return;
        }
        hexp("  RX: ", rx, got);
    }
}

static void send(libusb_device_handle *h, uint8_t out, uint8_t in, int inMax,
                 const char *label, uint8_t *tx, int n) {
    printf("\n[%s]\n", label);
    hexp("  TX: ", tx, n < 16 ? n : 16);
    int sent = 0;
    int r = libusb_interrupt_transfer(h, out, tx, n, &sent, 1000);
    printf("  interrupt OUT (%d B) -> %s\n", sent, r ? libusb_error_name(r) : "OK");
    if (r == 0) read_in(h, in, inMax);
}

int main(void) {
    if (geteuid() != 0) {
        fprintf(stderr, "Device capture needs root: sudo %s\n", "/tmp/super-capture");
        return 1;
    }
    libusb_context *ctx = NULL;
    if (libusb_init(&ctx) != 0) return 1;
    libusb_device_handle *h = libusb_open_device_with_vid_pid(ctx, VID, PID);
    if (!h) {
        fprintf(stderr, "8BitDo keyboard 0x%04x/0x%04x not found\n", VID, PID);
        return 1;
    }

    // Endpoints of iface 2, from the device's own config descriptor.
    uint8_t epOut = 0, epIn = 0;
    int outMax = 0, inMax = 0;
    struct libusb_config_descriptor *cfg = NULL;
    libusb_get_active_config_descriptor(libusb_get_device(h), &cfg);
    if (cfg && IFACE < cfg->bNumInterfaces) {
        const struct libusb_interface_descriptor *alt = &cfg->interface[IFACE].altsetting[0];
        printf("iface %d: class=0x%02x endpoints=%d\n", IFACE, alt->bInterfaceClass, alt->bNumEndpoints);
        for (int i = 0; i < alt->bNumEndpoints; i++) {
            const struct libusb_endpoint_descriptor *e = &alt->endpoint[i];
            int isIn = e->bEndpointAddress & LIBUSB_ENDPOINT_IN;
            int type = e->bmAttributes & 3;
            printf("  ep 0x%02x %s %s maxPacket=%d interval=%d\n", e->bEndpointAddress,
                   isIn ? "IN " : "OUT", type == 3 ? "interrupt" : "other", e->wMaxPacketSize, e->bInterval);
            if (type == 3 && isIn && !epIn) { epIn = e->bEndpointAddress; inMax = e->wMaxPacketSize; }
            if (type == 3 && !isIn && !epOut) { epOut = e->bEndpointAddress; outMax = e->wMaxPacketSize; }
        }
    }
    libusb_free_config_descriptor(cfg);
    if (!epOut || !epIn) {
        fprintf(stderr, "iface %d has no interrupt OUT/IN pair\n", IFACE);
        libusb_close(h);
        return 1;
    }

    // Capture: detach macOS's drivers (whole device) and claim iface 2.
    libusb_set_auto_detach_kernel_driver(h, 1);
    printf("\nCapturing keyboard from macOS (it won't type until released)...\n");
    int r = libusb_claim_interface(h, IFACE);
    if (r != 0) {
        fprintf(stderr, "claim iface %d failed: %s\n", IFACE, libusb_error_name(r));
        libusb_close(h);
        libusb_exit(ctx);
        return 2;
    }
    printf("CAPTURED + claimed iface %d\n", IFACE);

    // The HID report descriptor straight from the device (not via IOKit).
    uint8_t rd[512];
    r = libusb_control_transfer(h, 0x81, LIBUSB_REQUEST_GET_DESCRIPTOR, (LIBUSB_DT_REPORT << 8) | 0,
                                IFACE, rd, sizeof rd, 1000);
    if (r > 0) { printf("\nreport descriptor (%d B):\n", r); hexp("  ", rd, r); }
    else printf("\nreport descriptor: %s\n", libusb_error_name(r));

    // 1) Sanity: legacy 0x52 channel over interrupt OUT (33-byte report).
    uint8_t attn[33] = {0x52, 0x76, 0xff};
    send(h, epOut, epIn, inMax, "legacy ATTN 52 76 ff", attn, sizeof attn);
    uint8_t name[33] = {0x52, 0x80};
    send(h, epOut, epIn, inMax, "legacy PROFILE_GET_NAME 52 80", name, sizeof name);

    // 2) Advance readSuper: [0x81, 0x04, 0x11, sub=0, len=0x35, Σ=0, off(4)=0], 64 B.
    uint8_t rs[64] = {0x81, 0x04, 0x11, 0x00, 0x35, 0x00};
    send(h, epOut, epIn, inMax, "Advance readSuper 0x11", rs, sizeof rs);

    printf("\n(outMax=%d inMax=%d)\nReleasing keyboard back to macOS...\n", outMax, inMax);
    libusb_release_interface(h, IFACE); // auto-detach => libusb re-attaches macOS drivers
    libusb_close(h);
    libusb_exit(ctx);
    printf("Released. If the keyboard doesn't type again, unplug/replug it.\n");
    return 0;
}
