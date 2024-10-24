#import <Cocoa/Cocoa.h>
#import <ApplicationServices/ApplicationServices.h>
#include <Carbon/Carbon.h>

static const int kWaitPasteboardAxTimeoutMs = 70;
static const int kWaitPasteboardCgEventTimeoutMs = 50;
static const int kPasteboardPollStepMs = 2;
static const int kTargetAppActivationTimeoutMs = 250;
static const useconds_t kTargetAppActivationPollStepUs = 4000;
static const useconds_t kTargetFocusSettleDelayUs = 35000;
static const useconds_t kCommandKeyReleaseDelayUs = 4000;
static const useconds_t kPasteKeyReleaseDelayUs = 5000;

static pid_t gTargetPid = 0;
static NSString *gTargetAppName = @"";
static NSLock *gTargetLock = nil;

static void setTarget(pid_t pid, NSString *name) {
  [gTargetLock lock];
  gTargetPid = pid;
  gTargetAppName = [name copy];
  [gTargetLock unlock];
}

static void getTarget(pid_t *outPid, NSString **outName) {
  [gTargetLock lock];
  if (outPid) *outPid = gTargetPid;
  if (outName) *outName = [gTargetAppName copy];
  [gTargetLock unlock];
}

static BOOL isEverythingRunnerApp(NSRunningApplication *app, pid_t selfPid, pid_t parentPid) {
  if (!app) return YES;
  pid_t pid = app.processIdentifier;
  if (pid <= 0 || pid == selfPid || pid == parentPid) return YES;
  NSString *bundleId = app.bundleIdentifier ?: @"";
  NSString *name = app.localizedName ?: @"";
  if ([bundleId isEqualToString:@"com.everythingrunner.app"]) return YES;
  if ([name isEqualToString:@"Everything Runner"]) return YES;
  return NO;
}

static void updateFrontmostTargetIfNeeded(void) {
  pid_t selfPid = getpid();
  pid_t parentPid = getppid();
  NSRunningApplication *front = [[NSWorkspace sharedWorkspace] frontmostApplication];
  if (front && !isEverythingRunnerApp(front, selfPid, parentPid)) {
    setTarget(front.processIdentifier, front.localizedName ?: @"App");
  }
}

static BOOL activateProcessByPid(pid_t targetPid) {
  if (targetPid <= 0) return NO;

  AXUIElementRef appElem = AXUIElementCreateApplication(targetPid);
  if (appElem) {
    AXUIElementSetAttributeValue(appElem, kAXFrontmostAttribute, kCFBooleanTrue);
    CFRelease(appElem);
  }

  NSRunningApplication *targetApp = [NSRunningApplication runningApplicationWithProcessIdentifier:targetPid];
  if (targetApp) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    [targetApp activateWithOptions:(NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps)];
#pragma clang diagnostic pop
    return YES;
  }
  return NO;
}

static void sendJsonResponse(NSDictionary *dict) {
  NSError *err = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:&err];
  if (!data) {
    fprintf(stdout, "{\"ok\":false}\n");
    fflush(stdout);
    return;
  }
  fwrite(data.bytes, 1, data.length, stdout);
  fputc('\n', stdout);
  fflush(stdout);
}

static BOOL isMenuItemEnabled(AXUIElementRef item) {
  CFTypeRef enabledVal = NULL;
  if (AXUIElementCopyAttributeValue(item, kAXEnabledAttribute, &enabledVal) == kAXErrorSuccess && enabledVal) {
    BOOL enabled = YES;
    if (CFGetTypeID(enabledVal) == CFBooleanGetTypeID()) {
      enabled = CFBooleanGetValue((CFBooleanRef)enabledVal) ? YES : NO;
    }
    CFRelease(enabledVal);
    return enabled;
  }
  return YES;
}

// Searches a top-level AXMenuBarItem -> its child AXMenu -> direct AXMenuItems (depth <= 1, never enters submenus like Services)
static AXUIElementRef findMenuItemInBarItem(AXUIElementRef barItem, NSString *cmdChar, NSArray<NSString *> *fallbackTitles) {
  if (!barItem) return NULL;

  CFTypeRef menusRef = NULL;
  if (AXUIElementCopyAttributeValue(barItem, kAXChildrenAttribute, &menusRef) != kAXErrorSuccess || !menusRef) {
    return NULL;
  }

  AXUIElementRef found = NULL;
  if (CFGetTypeID(menusRef) == CFArrayGetTypeID()) {
    NSArray *menus = (__bridge NSArray *)menusRef;
    for (id menuObj in menus) {
      AXUIElementRef menuElem = (__bridge AXUIElementRef)menuObj;
      CFTypeRef itemsRef = NULL;
      if (AXUIElementCopyAttributeValue(menuElem, kAXChildrenAttribute, &itemsRef) != kAXErrorSuccess || !itemsRef) {
        continue;
      }

      if (CFGetTypeID(itemsRef) == CFArrayGetTypeID()) {
        NSArray *items = (__bridge NSArray *)itemsRef;
        for (id itemObj in items) {
          AXUIElementRef item = (__bridge AXUIElementRef)itemObj;

          // Match by Command shortcut character (e.g. Cmd+C or Cmd+V with no extra modifiers)
          CFTypeRef cmdCharRef = NULL;
          if (AXUIElementCopyAttributeValue(item, kAXMenuItemCmdCharAttribute, &cmdCharRef) == kAXErrorSuccess && cmdCharRef) {
            if (CFGetTypeID(cmdCharRef) == CFStringGetTypeID()) {
              NSString *itemChar = (__bridge NSString *)cmdCharRef;
              if ([itemChar caseInsensitiveCompare:cmdChar] == NSOrderedSame) {
                NSInteger mods = 0;
                CFTypeRef modsRef = NULL;
                if (AXUIElementCopyAttributeValue(item, kAXMenuItemCmdModifiersAttribute, &modsRef) == kAXErrorSuccess && modsRef) {
                  if (CFGetTypeID(modsRef) == CFNumberGetTypeID()) {
                    mods = [(__bridge NSNumber *)modsRef integerValue];
                  }
                  CFRelease(modsRef);
                }
                if (mods == 0) {
                  found = (AXUIElementRef)CFRetain(item);
                }
              }
            }
            CFRelease(cmdCharRef);
          }

          if (found) break;

          // Fallback match by localized menu item title
          CFTypeRef titleRef = NULL;
          if (AXUIElementCopyAttributeValue(item, kAXTitleAttribute, &titleRef) == kAXErrorSuccess && titleRef) {
            if (CFGetTypeID(titleRef) == CFStringGetTypeID()) {
              NSString *title = [(__bridge NSString *)titleRef stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
              for (NSString *candidate in fallbackTitles) {
                if ([title caseInsensitiveCompare:candidate] == NSOrderedSame) {
                  found = (AXUIElementRef)CFRetain(item);
                  break;
                }
              }
            }
            CFRelease(titleRef);
          }

          if (found) break;
        }
      }

      CFRelease(itemsRef);
      if (found) break;
    }
  }

  CFRelease(menusRef);
  return found;
}

static AXUIElementRef findAppMenuItem(pid_t pid, NSString *cmdChar, NSArray<NSString *> *fallbackTitles) {
  if (pid <= 0) return NULL;
  AXUIElementRef appElem = AXUIElementCreateApplication(pid);
  if (!appElem) return NULL;

  CFTypeRef menuBarRef = NULL;
  AXError err = AXUIElementCopyAttributeValue(appElem, kAXMenuBarAttribute, &menuBarRef);
  CFRelease(appElem);
  if (err != kAXErrorSuccess || !menuBarRef) {
    return NULL;
  }

  CFTypeRef topItemsRef = NULL;
  err = AXUIElementCopyAttributeValue((AXUIElementRef)menuBarRef, kAXChildrenAttribute, &topItemsRef);
  CFRelease(menuBarRef);
  if (err != kAXErrorSuccess || !topItemsRef) {
    return NULL;
  }

  AXUIElementRef result = NULL;
  if (CFGetTypeID(topItemsRef) == CFArrayGetTypeID()) {
    NSArray *topItems = (__bridge NSArray *)topItemsRef;
    NSUInteger count = topItems.count;
    // Check Edit menu (index 3) first, then adjacent menus (skipping index 0 Apple and index 1 App menu)
    NSMutableArray<NSNumber *> *order = [NSMutableArray array];
    if (count > 3) [order addObject:@3];
    if (count > 2) [order addObject:@2];
    if (count > 4) [order addObject:@4];
    for (NSUInteger i = 2; i < count && i < 7; i++) {
      if (![order containsObject:@(i)]) {
        [order addObject:@(i)];
      }
    }

    for (NSNumber *idxNum in order) {
      AXUIElementRef barItem = (__bridge AXUIElementRef)topItems[idxNum.unsignedIntegerValue];
      result = findMenuItemInBarItem(barItem, cmdChar, fallbackTitles);
      if (result) break;
    }
  }

  CFRelease(topItemsRef);
  return result;
}

static NSString *readSelectedTextViaAX(pid_t pid) {
  if (pid <= 0) return nil;
  AXUIElementRef appElem = AXUIElementCreateApplication(pid);
  if (!appElem) return nil;

  // Enable accessibility in Chromium/Electron browsers (Brave, Chrome, Arc, Edge)
  AXUIElementSetAttributeValue(appElem, CFSTR("AXManualAccessibility"), kCFBooleanTrue);

  CFTypeRef focusedRef = NULL;
  AXError err = AXUIElementCopyAttributeValue(appElem, kAXFocusedUIElementAttribute, &focusedRef);
  CFRelease(appElem);

  if (err != kAXErrorSuccess || !focusedRef) {
    AXUIElementRef sysWide = AXUIElementCreateSystemWide();
    err = AXUIElementCopyAttributeValue(sysWide, kAXFocusedUIElementAttribute, &focusedRef);
    CFRelease(sysWide);
  }

  if (err != kAXErrorSuccess || !focusedRef) {
    return nil;
  }

  NSString *selectedStr = nil;
  CFTypeRef selTextRef = NULL;
  if (AXUIElementCopyAttributeValue((AXUIElementRef)focusedRef, kAXSelectedTextAttribute, &selTextRef) == kAXErrorSuccess && selTextRef) {
    if (CFGetTypeID(selTextRef) == CFStringGetTypeID()) {
      NSString *s = (__bridge NSString *)selTextRef;
      if (s.length > 0) {
        selectedStr = [s copy];
      }
    }
    CFRelease(selTextRef);
  }

  CFRelease(focusedRef);
  return selectedStr;
}

static void postCleanCommandShortcut(pid_t pid, CGKeyCode keyCode) {
  CGEventSourceRef src = CGEventSourceCreate(kCGEventSourceStatePrivate);
  if (!src) return;

  // Explicitly set modifier state to Command-only so physically held Option/Shift keys
  // from Command+Option+Shift+Space never turn Cmd+C into Cmd+Opt+Shift+C.
  CGEventRef flagsCmdOnly = CGEventCreateKeyboardEvent(src, (CGKeyCode)kVK_Command, true);
  if (flagsCmdOnly) {
    CGEventSetType(flagsCmdOnly, kCGEventFlagsChanged);
    CGEventSetFlags(flagsCmdOnly, kCGEventFlagMaskCommand);
    if (pid > 0) {
      CGEventPostToPid(pid, flagsCmdOnly);
    } else {
      CGEventPost(kCGSessionEventTap, flagsCmdOnly);
    }
    CFRelease(flagsCmdOnly);
  }

  CGEventRef keyDown = CGEventCreateKeyboardEvent(src, keyCode, true);
  CGEventRef keyUp = CGEventCreateKeyboardEvent(src, keyCode, false);

  CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
  CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);

  if (pid > 0) {
    CGEventPostToPid(pid, keyDown);
    usleep(kCommandKeyReleaseDelayUs);
    CGEventPostToPid(pid, keyUp);
  } else {
    CGEventPost(kCGSessionEventTap, keyDown);
    usleep(kCommandKeyReleaseDelayUs);
    CGEventPost(kCGSessionEventTap, keyUp);
  }

  CFRelease(keyDown);
  CFRelease(keyUp);
  CFRelease(src);
}

static NSString *waitForPasteboardChange(NSPasteboard *pb, NSInteger beforeCount, int maxWaitMs) {
  int elapsedMs = 0;
  while (elapsedMs < maxWaitMs) {
    if ([pb changeCount] != beforeCount) {
      NSString *str = [pb stringForType:NSPasteboardTypeString];
      return str ?: @"";
    }
    usleep(kPasteboardPollStepMs * 1000);
    elapsedMs += kPasteboardPollStepMs;
  }
  if ([pb changeCount] != beforeCount) {
    return [pb stringForType:NSPasteboardTypeString] ?: @"";
  }
  return nil;
}

static NSArray<NSPasteboardItem *> *snapshotPasteboardItems(NSPasteboard *pb) {
  NSMutableArray<NSPasteboardItem *> *snapshot = [NSMutableArray array];
  for (NSPasteboardItem *item in pb.pasteboardItems) {
    NSPasteboardItem *cloned = [[NSPasteboardItem alloc] init];
    BOOL hasData = NO;
    for (NSPasteboardType type in item.types) {
      NSData *data = [item dataForType:type];
      if (data) {
        [cloned setData:data forType:type];
        hasData = YES;
      }
    }
    if (hasData) {
      [snapshot addObject:cloned];
    }
  }
  return snapshot;
}

static void restorePasteboardSnapshot(NSPasteboard *pb, NSArray<NSPasteboardItem *> *snapshot) {
  [pb clearContents];
  if (snapshot.count > 0) {
    [pb writeObjects:snapshot];
  }
}

static NSDictionary *handleCapture(void) {
  updateFrontmostTargetIfNeeded();

  BOOL trusted = AXIsProcessTrusted() ? YES : NO;
  NSPasteboard *pb = [NSPasteboard generalPasteboard];
  NSString *previousClipboard = [pb stringForType:NSPasteboardTypeString];
  NSString *safePrevious = previousClipboard ?: @"";
  NSArray<NSPasteboardItem *> *savedItems = snapshotPasteboardItems(pb);
  NSInteger initialChangeCount = [pb changeCount];

  pid_t targetPid = 0;
  NSString *appName = @"";
  getTarget(&targetPid, &appName);

  if (trusted && targetPid > 0) {
    // Enable Chromium/Brave accessibility on the target app early
    AXUIElementRef appElem = AXUIElementCreateApplication(targetPid);
    if (appElem) {
      AXUIElementSetAttributeValue(appElem, CFSTR("AXManualAccessibility"), kCFBooleanTrue);
      CFRelease(appElem);
    }

    // Tier 1: Trigger target app's Edit -> Copy menu item directly via Accessibility.
    AXUIElementRef copyItem = findAppMenuItem(targetPid, @"C", @[@"Copy", @"Copier", @"Kopieren", @"Copiar"]);
    if (copyItem) {
      if (isMenuItemEnabled(copyItem)) {
        AXError pressErr = AXUIElementPerformAction(copyItem, kAXPressAction);
        if (pressErr == kAXErrorSuccess) {
          NSString *copied = waitForPasteboardChange(pb, initialChangeCount, kWaitPasteboardAxTimeoutMs);
          if (copied && copied.length > 0) {
            restorePasteboardSnapshot(pb, savedItems);
            CFRelease(copyItem);
            return @{
              @"ok": @YES,
              @"text": copied,
              @"source": @"selection",
              @"accessibilityTrusted": @YES,
              @"appName": appName,
              @"targetPid": @(targetPid)
            };
          }
        }
      }
      CFRelease(copyItem);
    }

    // Tier 2: Direct AXSelectedText attribute read from focused UI element
    NSString *axSelected = readSelectedTextViaAX(targetPid);
    if (axSelected && axSelected.length > 0) {
      return @{
        @"ok": @YES,
        @"text": axSelected,
        @"source": @"selection",
        @"accessibilityTrusted": @YES,
        @"appName": appName,
        @"targetPid": @(targetPid)
      };
    }

    // Tier 3: Clean CGEvent Cmd+C posted directly to targetPid with ONLY Command flag
    NSInteger countBeforeEvent = [pb changeCount];
    postCleanCommandShortcut(targetPid, (CGKeyCode)kVK_ANSI_C);
    NSString *copiedViaEvent = waitForPasteboardChange(pb, countBeforeEvent, kWaitPasteboardCgEventTimeoutMs);
    if (copiedViaEvent && copiedViaEvent.length > 0) {
      restorePasteboardSnapshot(pb, savedItems);
      return @{
        @"ok": @YES,
        @"text": copiedViaEvent,
        @"source": @"selection",
        @"accessibilityTrusted": @YES,
        @"appName": appName,
        @"targetPid": @(targetPid)
      };
    }
  }

  if (safePrevious.length > 0) {
    return @{
      @"ok": @YES,
      @"text": safePrevious,
      @"source": @"clipboard",
      @"accessibilityTrusted": (trusted ? @YES : @NO),
      @"appName": appName,
      @"targetPid": @(targetPid)
    };
  }

  return @{
    @"ok": @YES,
    @"text": @"",
    @"source": @"empty",
    @"accessibilityTrusted": (trusted ? @YES : @NO),
    @"appName": appName,
    @"targetPid": @(targetPid)
  };
}

static NSDictionary *handleReplace(NSString *text, pid_t requestedPid) {
  NSPasteboard *pb = [NSPasteboard generalPasteboard];
  [pb clearContents];
  [pb setString:(text ?: @"") forType:NSPasteboardTypeString];

  BOOL trusted = AXIsProcessTrusted() ? YES : NO;
  pid_t currentTargetPid = 0;
  getTarget(&currentTargetPid, NULL);
  pid_t targetPid = requestedPid > 0 ? requestedPid : currentTargetPid;

  if (targetPid > 0) {
    activateProcessByPid(targetPid);
    NSRunningApplication *targetApp = [NSRunningApplication runningApplicationWithProcessIdentifier:targetPid];
    if (targetApp) {
      int waitedMs = 0;
      while (waitedMs < kTargetAppActivationTimeoutMs) {
        NSRunningApplication *front = [[NSWorkspace sharedWorkspace] frontmostApplication];
        if ([targetApp isActive] || (front && front.processIdentifier == targetPid)) {
          break;
        }
        usleep(kTargetAppActivationPollStepUs);
        waitedMs += (int)(kTargetAppActivationPollStepUs / 1000);
      }
      // Give the target window / webview responder chain a brief moment to settle focus
      usleep(kTargetFocusSettleDelayUs);
    }
  }

  if (!trusted) {
    return @{ @"ok": @NO, @"accessibilityTrusted": @NO };
  }

  BOOL pasted = NO;

  if (targetPid > 0) {
    AXUIElementRef pasteItem = findAppMenuItem(targetPid, @"V", @[@"Paste", @"Coller", @"Einfügen", @"Pegar"]);
    if (pasteItem) {
      if (isMenuItemEnabled(pasteItem)) {
        if (AXUIElementPerformAction(pasteItem, kAXPressAction) == kAXErrorSuccess) {
          pasted = YES;
        }
      }
      CFRelease(pasteItem);
    }
  }

  if (!pasted) {
    // Fallback: Post clean Cmd+V via CGEvent
    CGEventSourceRef src = CGEventSourceCreate(kCGEventSourceStatePrivate);
    if (src) {
      CGEventRef vDown = CGEventCreateKeyboardEvent(src, (CGKeyCode)kVK_ANSI_V, true);
      CGEventRef vUp = CGEventCreateKeyboardEvent(src, (CGKeyCode)kVK_ANSI_V, false);
      CGEventSetFlags(vDown, kCGEventFlagMaskCommand);
      CGEventSetFlags(vUp, kCGEventFlagMaskCommand);

      CGEventPost(kCGSessionEventTap, vDown);
      usleep(kPasteKeyReleaseDelayUs);
      CGEventPost(kCGSessionEventTap, vUp);

      CFRelease(vDown);
      CFRelease(vUp);
      CFRelease(src);
      pasted = YES;
    }
  }

  return @{ @"ok": (pasted ? @YES : @NO), @"accessibilityTrusted": @YES };
}

static NSDictionary *handleActivateTarget(pid_t requestedPid) {
  pid_t currentTargetPid = 0;
  getTarget(&currentTargetPid, NULL);
  pid_t targetPid = requestedPid > 0 ? requestedPid : currentTargetPid;
  if (activateProcessByPid(targetPid)) {
    return @{ @"ok": @YES, @"targetPid": @(targetPid) };
  }
  return @{ @"ok": @NO };
}

static NSDictionary *handleFocusSelf(void) {
  pid_t parentPid = getppid();
  if (activateProcessByPid(parentPid)) {
    return @{ @"ok": @YES };
  }
  return @{ @"ok": @NO };
}

int main(int argc, const char * argv[]) {
  @autoreleasepool {
    if (argc > 1 && strcmp(argv[1], "--prompt") == 0) {
      NSDictionary *options = @{ (__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES };
      Boolean trusted = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
      fprintf(stdout, "{\"ok\":true,\"accessibilityTrusted\":%s}\n", trusted ? "true" : "false");
      fflush(stdout);
      return 0;
    }

    gTargetLock = [[NSLock alloc] init];
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];

    updateFrontmostTargetIfNeeded();

    pid_t selfPid = getpid();
    pid_t parentPid = getppid();

    [[[NSWorkspace sharedWorkspace] notificationCenter]
      addObserverForName:NSWorkspaceDidActivateApplicationNotification
                  object:nil
                   queue:[NSOperationQueue mainQueue]
              usingBlock:^(NSNotification *note) {
                NSRunningApplication *app = note.userInfo[NSWorkspaceApplicationKey];
                if (app && !isEverythingRunnerApp(app, selfPid, parentPid)) {
                  setTarget(app.processIdentifier, app.localizedName ?: @"App");
                }
              }];

    dispatch_queue_t commandQueue = dispatch_queue_create("com.everythingrunner.helper.commandQueue", DISPATCH_QUEUE_SERIAL);

    // Read newline-delimited JSON commands from stdin on a background queue
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
      char *line = NULL;
      size_t linecap = 0;
      ssize_t linelen;
      while ((linelen = getline(&line, &linecap, stdin)) > 0) {
        @autoreleasepool {
          NSData *lineData = [NSData dataWithBytes:line length:(NSUInteger)linelen];
          NSDictionary *req = [NSJSONSerialization JSONObjectWithData:lineData options:0 error:nil];
          if (![req isKindOfClass:[NSDictionary class]]) {
            continue;
          }
          NSNumber *reqId = req[@"id"] ?: @0;
          NSString *cmd = req[@"cmd"] ?: @"";

          dispatch_async(commandQueue, ^{
            NSDictionary *result = nil;
            if ([cmd isEqualToString:@"capture"]) {
              result = handleCapture();
            } else if ([cmd isEqualToString:@"replace"]) {
              NSString *text = [req[@"text"] isKindOfClass:[NSString class]] ? req[@"text"] : @"";
              pid_t pid = [req[@"targetPid"] respondsToSelector:@selector(intValue)] ? [req[@"targetPid"] intValue] : 0;
              result = handleReplace(text, pid);
            } else if ([cmd isEqualToString:@"activate-target"]) {
              pid_t pid = [req[@"targetPid"] respondsToSelector:@selector(intValue)] ? [req[@"targetPid"] intValue] : 0;
              result = handleActivateTarget(pid);
            } else if ([cmd isEqualToString:@"focus-self"]) {
              result = handleFocusSelf();
            } else {
              result = @{ @"ok": @NO, @"error": @"unknown_command" };
            }

            NSMutableDictionary *resp = [NSMutableDictionary dictionaryWithDictionary:(result ?: @{})];
            resp[@"id"] = reqId;
            sendJsonResponse(resp);
          });
        }
      }
      if (line) free(line);
      exit(0);
    });

    [[NSRunLoop mainRunLoop] run];
  }
  return 0;
}
