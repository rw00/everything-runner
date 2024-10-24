import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import plist from "plist";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
);
const appVersion = pkg.version || "1.0.0";

const electronDir = path.join(rootDir, "node_modules", "electron");
const electronDist = path.join(electronDir, "dist");
const electronAppSrc = path.join(electronDist, "Electron.app");
const releaseDir = path.join(rootDir, "release");
const targetApp = path.join(releaseDir, "Everything Runner.app");
const targetZip = path.join(releaseDir, "Everything-Runner-macOS.zip");

if (!fs.existsSync(path.join(electronAppSrc, "Contents", "Info.plist"))) {
  throw new Error(`Electron.app not found at ${electronAppSrc}`);
}

fs.rmSync(targetApp, { recursive: true, force: true });
fs.rmSync(targetZip, { force: true });
fs.mkdirSync(releaseDir, { recursive: true });

// Copy Electron.app preserving macOS framework symlinks
execFileSync("/usr/bin/ditto", [electronAppSrc, targetApp]);

// Populate Contents/Resources/app with package.json and compiled dist/
const resourcesDir = path.join(targetApp, "Contents", "Resources");
const resourcesAppDir = path.join(resourcesDir, "app");
fs.rmSync(path.join(resourcesDir, "default_app.asar"), {
  force: true
});
fs.mkdirSync(resourcesAppDir, { recursive: true });

fs.copyFileSync(
  path.join(rootDir, "package.json"),
  path.join(resourcesAppDir, "package.json")
);
execFileSync("/usr/bin/ditto", [
  path.join(rootDir, "dist"),
  path.join(resourcesAppDir, "dist")
]);

// Replace default Electron icon with custom Everything Runner icon
const customIcns = path.join(rootDir, "dist", "electron", "icon.icns");
if (fs.existsSync(customIcns)) {
  fs.rmSync(path.join(resourcesDir, "electron.icns"), { force: true });
  fs.copyFileSync(customIcns, path.join(resourcesDir, "icon.icns"));
}

// Rename main executable from Electron to Everything Runner so macOS System Settings
// and Activity Monitor always identify the process as "Everything Runner"
const macosDir = path.join(targetApp, "Contents", "MacOS");
const oldExec = path.join(macosDir, "Electron");
const newExec = path.join(macosDir, "Everything Runner");
if (fs.existsSync(oldExec)) {
  fs.renameSync(oldExec, newExec);
}

// Update Info.plist cleanly using structured plist parser instead of regex surgery
const infoPlistPath = path.join(targetApp, "Contents", "Info.plist");
const parsedPlist = plist.parse(fs.readFileSync(infoPlistPath, "utf8"));

parsedPlist.CFBundleExecutable = "Everything Runner";
parsedPlist.CFBundleDisplayName = "Everything Runner";
parsedPlist.CFBundleName = "Everything Runner";
parsedPlist.CFBundleIdentifier = "com.everythingrunner.app";
parsedPlist.CFBundleIconFile = "icon.icns";
parsedPlist.CFBundleShortVersionString = appVersion;
parsedPlist.CFBundleVersion = appVersion;
parsedPlist.LSUIElement = true;

fs.writeFileSync(infoPlistPath, plist.build(parsedPlist), "utf8");

// Ensure native helper binary is executable and signed before bundle signing
const packagedHelper = path.join(
  resourcesAppDir,
  "dist",
  "infrastructure",
  "macos-helper"
);
if (fs.existsSync(packagedHelper)) {
  fs.chmodSync(packagedHelper, 0o755);
  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", packagedHelper]);
}

// Ad-hoc sign the bundle for Apple Silicon macOS
execFileSync("/usr/bin/codesign", [
  "--force",
  "--deep",
  "--sign",
  "-",
  targetApp
]);

// Create a downloadable macOS .zip archive preserving framework symlinks and signatures
execFileSync("/usr/bin/ditto", [
  "-c",
  "-k",
  "--sequesterRsrc",
  "--keepParent",
  targetApp,
  targetZip
]);

console.log(`Packaged macOS app at: ${targetApp}`);
console.log(`Created downloadable archive at: ${targetZip}`);
