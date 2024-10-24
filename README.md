# Everything Runner

A Spotlight-style macOS on-the-fly script & text tool executor.

Select text anywhere on your Mac, press **⌘ + ⌥ + ⇧ + Space** (`Command+Option+Shift+Space`), and run tools like **Sort Text**, **Count Words**, **Remove Duplicate Lines**, **Change Case**, or **Format / Minify JSON** with a live preview.

## Keyboard Shortcuts (Inside Overlay)

- **`↑` / `↓`**: Navigate tools
- **`Tab` / `Shift+Tab`**: Customize parameters for the active tool (e.g., Ascending/Descending order, split delimiter, join separator, target case)
- **`Enter` (`↵`) / `Cmd + Enter` (`⌘↵`)**: Replace selected text directly in the active app (and copy to clipboard)
- **`Option + Enter` (`⌥↵`)**: Copy result to clipboard without replacing in the active app
- **`Cmd + ,` (`⌘,`)**: Open **Settings** to configure your Custom Scripts directory
- **`Esc`**: Return focus to search bar or dismiss overlay

## Custom Scripts

Everything Runner can load user-written CommonJS scripts (`.js`) from any directory:

1. Click **⚙ Settings** in the overlay header (or press **`⌘,`**), or edit `~/.everything-runner/settings.json`:
   ```json
   {
     "customScriptsDir": "~/runner-custom-scripts"
   }
   ```
2. Place scripts in that directory (for example `~/runner-custom-scripts/base64_encode.js`). Everything Runner automatically discovers and reloads them. Note: only `.js` files are supported.

## Development & Installation

- **Build**: `npm run build`
- **Test**: `npm run test`
- **Lint**: `npm run lint`
- **Run in Dev Mode**: `npm start`
- **Package `.app` Bundle**: `npm run package:mac`
- **Install to `/Applications`**: `npm run install:mac`

> **Note on Auto-Grabbing Selection & Auto-Paste**: On first use, grant **Everything Runner** permission in **System Settings → Privacy & Security → Accessibility** (or click the **⚡ Enable Auto-Grab** pill in the overlay header / menu bar icon) so it can automatically copy your selected text and paste replacements in-place.
