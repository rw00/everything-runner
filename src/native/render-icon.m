#import <Cocoa/Cocoa.h>

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 4) {
      fprintf(stderr, "Usage: render-icon <input.svg> <output.png> <size>\n");
      return 1;
    }

    NSString *svgPath = [NSString stringWithUTF8String:argv[1]];
    NSString *outPath = [NSString stringWithUTF8String:argv[2]];
    int size = atoi(argv[3]);
    if (size <= 0) {
      fprintf(stderr, "Invalid size: %s\n", argv[3]);
      return 1;
    }

    NSImage *img = [[NSImage alloc] initWithContentsOfFile:svgPath];
    if (!img) {
      fprintf(stderr, "Failed to load image: %s\n", [svgPath UTF8String]);
      return 1;
    }

    NSBitmapImageRep *rep = [[NSBitmapImageRep alloc]
      initWithBitmapDataPlanes:NULL
                    pixelsWide:size
                    pixelsHigh:size
                 bitsPerSample:8
               samplesPerPixel:4
                      hasAlpha:YES
                      isPlanar:NO
                colorSpaceName:NSDeviceRGBColorSpace
                   bytesPerRow:0
                  bitsPerPixel:0];
    if (!rep) {
      fprintf(stderr, "Failed to allocate bitmap representation\n");
      return 1;
    }

    [NSGraphicsContext saveGraphicsState];
    NSGraphicsContext *ctx = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
    [NSGraphicsContext setCurrentContext:ctx];
    [ctx setImageInterpolation:NSImageInterpolationHigh];
    [img drawInRect:NSMakeRect(0, 0, size, size)
           fromRect:NSZeroRect
          operation:NSCompositingOperationCopy
           fraction:1.0];
    [NSGraphicsContext restoreGraphicsState];

    NSData *png = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    if (!png || ![png writeToFile:outPath atomically:YES]) {
      fprintf(stderr, "Failed to write PNG: %s\n", [outPath UTF8String]);
      return 1;
    }
  }
  return 0;
}

