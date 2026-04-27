# Webscreen Capture (Chrome Extension)

Capture a selected area from the current tab and save image + metadata locally.

## Features

- Hotkey capture: `Command/Ctrl + Shift + L`
- Drag-to-select overlay on webpage
- Saved metadata per capture:
  - URL
  - Title
  - Timestamp
- Gallery page to view all captures
- Export saved captures to a JSON file

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder.

## Usage

1. Open any webpage.
2. Press `Command/Ctrl + Shift + L`.
3. Drag to select an area.
4. Open extension popup and click **Open Gallery**.

## Files

- `manifest.json` - Extension configuration (MV3)
- `background.js` - Command handling, screenshot capture, crop, storage
- `content.js` + `content.css` - Selection overlay UI and interaction
- `popup.html` / `popup.js` / `popup.css` - Quick controls
- `gallery.html` / `gallery.js` / `gallery.css` - Saved capture browsing and export
