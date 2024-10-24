import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcApp = path.join(rootDir, "release", "Everything Runner.app");
const destApp = "/Applications/Everything Runner.app";

if (!fs.existsSync(srcApp)) {
  throw new Error(`Packaged app not found at ${srcApp}`);
}

// Gracefully stop any running instance of Everything Runner
try {
  execFileSync("/usr/bin/pkill", ["-f", "Everything Runner.app"], {
    stdio: "ignore"
  });
} catch {
  // Ignore if not running
}

fs.rmSync(destApp, { recursive: true, force: true });
execFileSync("/usr/bin/ditto", [srcApp, destApp]);

// Reset stale ad-hoc CDHash in Accessibility TCC so macOS registers the new binary cleanly
try {
  execFileSync(
    "/usr/bin/tccutil",
    ["reset", "Accessibility", "com.everythingrunner.app"],
    { stdio: "ignore" }
  );
} catch {
  // Ignore if not permitted
}

// Launch the newly installed app
const child = spawn("/usr/bin/open", ["-a", destApp], {
  detached: true,
  stdio: "ignore"
});
child.unref();

console.log(`Installed and launched: ${destApp}`);
