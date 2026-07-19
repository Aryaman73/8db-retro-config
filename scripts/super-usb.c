// Raw-USB test: deliver the Advance super-button command over interface 2's
// INTERRUPT OUT endpoint (and read the INTERRUPT IN), exactly like the Windows
// app's WriteFile/ReadFile — instead of macOS HID's control SET_REPORT (which
// only ever gets the reject `54 e4 09`).
//
// This is the decisive test of the "Windows uses interrupt OUT, macOS HID uses
// control" hypothesis. Command sent is readSuper (0x11) — NON-MUTATING.
//
// clang scripts/super-usb.c -o /tmp/super-usb -framework IOKit -framework CoreFoundation

#include <IOKit/IOKitLib.h>
#include <IOKit/IOCFPlugIn.h>
#include <IOKit/usb/IOUSBLib.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#define VID 0x2dc8
#define PID 0x5200
#define TARGET_IFACE 2

static void hexp(const char*l,const uint8_t*b,int n){printf("%s",l);for(int i=0;i<n;i++)printf("%02x ",b[i]);printf("\n");}

static IOUSBDeviceInterface **find_device(void) {
    CFMutableDictionaryRef m = IOServiceMatching(kIOUSBDeviceClassName);
    int vid=VID,pid=PID;
    CFDictionarySetValue(m, CFSTR(kUSBVendorID), CFNumberCreate(NULL,kCFNumberIntType,&vid));
    CFDictionarySetValue(m, CFSTR(kUSBProductID), CFNumberCreate(NULL,kCFNumberIntType,&pid));
    io_iterator_t it;
    if (IOServiceGetMatchingServices(kIOMainPortDefault, m, &it)!=KERN_SUCCESS) return NULL;
    io_service_t svc;
    IOUSBDeviceInterface **dev=NULL;
    while ((svc=IOIteratorNext(it))) {
        IOCFPlugInInterface **plug=NULL; SInt32 score;
        if (IOCreatePlugInInterfaceForService(svc,kIOUSBDeviceUserClientTypeID,kIOCFPlugInInterfaceID,&plug,&score)==KERN_SUCCESS && plug) {
            (*plug)->QueryInterface(plug,CFUUIDGetUUIDBytes(kIOUSBDeviceInterfaceID),(LPVOID*)&dev);
            (*plug)->Release(plug);
        }
        IOObjectRelease(svc);
        if (dev) break;
    }
    IOObjectRelease(it);
    return dev;
}

static IOUSBInterfaceInterface **get_iface(IOUSBDeviceInterface **dev, int want) {
    IOUSBFindInterfaceRequest req;
    req.bInterfaceClass=kIOUSBFindInterfaceDontCare;
    req.bInterfaceSubClass=kIOUSBFindInterfaceDontCare;
    req.bInterfaceProtocol=kIOUSBFindInterfaceDontCare;
    req.bAlternateSetting=kIOUSBFindInterfaceDontCare;
    io_iterator_t it;
    if ((*dev)->CreateInterfaceIterator(dev,&req,&it)!=KERN_SUCCESS) return NULL;
    io_service_t svc; IOUSBInterfaceInterface **intf=NULL;
    while ((svc=IOIteratorNext(it))) {
        IOCFPlugInInterface **plug=NULL; SInt32 score; IOUSBInterfaceInterface **cand=NULL;
        if (IOCreatePlugInInterfaceForService(svc,kIOUSBInterfaceUserClientTypeID,kIOCFPlugInInterfaceID,&plug,&score)==KERN_SUCCESS && plug) {
            (*plug)->QueryInterface(plug,CFUUIDGetUUIDBytes(kIOUSBInterfaceInterfaceID),(LPVOID*)&cand);
            (*plug)->Release(plug);
        }
        IOObjectRelease(svc);
        if (cand) {
            UInt8 num=255; (*cand)->GetInterfaceNumber(cand,&num);
            if (num==want) { intf=cand; break; }
            (*cand)->Release(cand);
        }
    }
    IOObjectRelease(it);
    return intf;
}

int main(void){
    IOUSBDeviceInterface **dev = find_device();
    if (!dev){ fprintf(stderr,"device not found\n"); return 1; }
    printf("found device 0x%04x/0x%04x\n",VID,PID);

    IOUSBInterfaceInterface **intf = get_iface(dev,TARGET_IFACE);
    if (!intf){ fprintf(stderr,"iface %d not found\n",TARGET_IFACE); return 1; }
    printf("got interface %d\n",TARGET_IFACE);

    IOReturn o = (*intf)->USBInterfaceOpen(intf);
    if (o!=kIOReturnSuccess){
        printf("USBInterfaceOpen -> 0x%08x; trying Seize...\n",o);
        o = (*intf)->USBInterfaceOpenSeize(intf);
        printf("USBInterfaceOpenSeize -> 0x%08x %s\n",o,o==0?"OK":"FAIL");
        if (o!=kIOReturnSuccess){
            fprintf(stderr,"cannot open interface (claimed by HID driver). This confirms the obstacle.\n");
            return 2;
        }
    } else printf("USBInterfaceOpen OK\n");

    UInt8 npipes=0; (*intf)->GetNumEndpoints(intf,&npipes);
    printf("endpoints (pipes): %d\n",npipes);
    int outPipe=-1,inPipe=-1;
    for (UInt8 p=1;p<=npipes;p++){
        UInt8 dir,num,tt,interval; UInt16 mps;
        if ((*intf)->GetPipeProperties(intf,p,&dir,&num,&tt,&mps,&interval)==kIOReturnSuccess){
            const char*ds=dir==kUSBIn?"IN":dir==kUSBOut?"OUT":"?";
            const char*ts=tt==kUSBInterrupt?"interrupt":tt==kUSBBulk?"bulk":"?";
            printf("  pipe %d: dir=%s epnum=%d type=%s maxPacket=%d interval=%d\n",p,ds,num,ts,mps,interval);
            if (dir==kUSBOut && outPipe<0) outPipe=p;
            if (dir==kUSBIn && inPipe<0) inPipe=p;
        }
    }
    if (outPipe<0){ fprintf(stderr,"no OUT pipe\n"); return 3; }

    // readSuper 0x11 framing: [0x81,0x04,0x11,0,0x35,cksum,off(4),data...]
    uint8_t tx[64]; memset(tx,0,64); tx[0]=0x81;tx[1]=0x04;tx[2]=0x11;tx[4]=0x35;
    hexp("TX (interrupt OUT): ",tx,16);
    IOReturn w = (*intf)->WritePipe(intf,outPipe,tx,64);
    printf("WritePipe(out) -> 0x%08x %s\n",w,w==0?"OK":"ERR");

    if (inPipe>0){
        uint8_t rx[64]; memset(rx,0,64); UInt32 rn=64;
        IOReturn r = (*intf)->ReadPipeTO(intf,inPipe,rx,&rn,200,500);
        if (r==kIOReturnSuccess){ printf("ReadPipe(in) OK (%u B):\n",rn); hexp("  ",rx,rn<48?rn:48); }
        else printf("ReadPipe(in) -> 0x%08x\n",r);
    }

    (*intf)->USBInterfaceClose(intf);
    return 0;
}
