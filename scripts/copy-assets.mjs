import { execFileSync } from "child_process";
import esbuild from "esbuild";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcRenderer = path.join(rootDir, "src", "renderer");
const distRenderer = path.join(rootDir, "dist", "renderer");
const distInfrastructure = path.join(rootDir, "dist", "infrastructure");
const distElectron = path.join(rootDir, "dist", "electron");

fs.mkdirSync(distRenderer, { recursive: true });
fs.mkdirSync(distInfrastructure, { recursive: true });
fs.mkdirSync(distElectron, { recursive: true });

for (const file of ["index.html", "styles.css", "icon.svg", "tray-icon.svg"]) {
  fs.copyFileSync(path.join(srcRenderer, file), path.join(distRenderer, file));
}

esbuild.buildSync({
  entryPoints: [path.join(srcRenderer, "renderer.ts")],
  bundle: true,
  outfile: path.join(distRenderer, "renderer.js"),
  platform: "browser",
  target: "chrome128",
  format: "iife"
});

if (process.platform === "darwin") {
  const helperSrc = path.join(rootDir, "src", "native", "macos-helper.m");
  const helperOut = path.join(distInfrastructure, "macos-helper");
  if (fs.existsSync(helperSrc)) {
    execFileSync("/usr/bin/clang", [
      "-O2",
      "-Wall",
      "-fobjc-arc",
      "-framework",
      "Cocoa",
      "-framework",
      "ApplicationServices",
      "-framework",
      "Carbon",
      helperSrc,
      "-o",
      helperOut
    ]);
    fs.chmodSync(helperOut, 0o755);
  }

  const renderIconSrc = path.join(rootDir, "src", "native", "render-icon.m");
  const iconSvg = path.join(srcRenderer, "icon.svg");
  const traySvg = path.join(srcRenderer, "tray-icon.svg");

  if (fs.existsSync(renderIconSrc) && fs.existsSync(iconSvg)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "er-icon-"));
    const renderBin = path.join(tmpDir, "render-icon");
    const iconsetDir = path.join(tmpDir, "icon.iconset");
    fs.mkdirSync(iconsetDir, { recursive: true });

    try {
      execFileSync("/usr/bin/clang", [
        "-O2",
        "-Wall",
        "-fobjc-arc",
        "-framework",
        "Cocoa",
        renderIconSrc,
        "-o",
        renderBin
      ]);

      const iconSizes = [
        ["icon_16x16.png", 16],
        ["icon_16x16@2x.png", 32],
        ["icon_32x32.png", 32],
        ["icon_32x32@2x.png", 64],
        ["icon_128x128.png", 128],
        ["icon_128x128@2x.png", 256],
        ["icon_256x256.png", 256],
        ["icon_256x256@2x.png", 512],
        ["icon_512x512.png", 512],
        ["icon_512x512@2x.png", 1024]
      ];

      for (const [name, size] of iconSizes) {
        execFileSync(renderBin, [
          iconSvg,
          path.join(iconsetDir, name),
          String(size)
        ]);
      }

      fs.copyFileSync(
        path.join(iconsetDir, "icon_512x512.png"),
        path.join(distRenderer, "icon.png")
      );

      execFileSync("/usr/bin/iconutil", [
        "-c",
        "icns",
        iconsetDir,
        "-o",
        path.join(distElectron, "icon.icns")
      ]);

      if (fs.existsSync(traySvg)) {
        execFileSync(renderBin, [
          traySvg,
          path.join(distRenderer, "trayTemplate.png"),
          "18"
        ]);
        execFileSync(renderBin, [
          traySvg,
          path.join(distRenderer, "trayTemplate@2x.png"),
          "36"
        ]);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}
