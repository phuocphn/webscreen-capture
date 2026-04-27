> From: https://chatgpt.com/c/69ef050a-fb10-83eb-ba65-37b185458f5b

# you asked

I want to make a chrome extension so that I can press  a hotkey in a webpage for capture portion of webscreen and save the captured figure and web metadata (url, title, accessed date) into a database (simple textfile would be okay), also give me a simple gallery page of saved images together with metadata.

---

# chatgpt response

That’s a solid, very doable Chrome extension project—and a great fit for your workflow (especially if you’re collecting figures for research). I’ll outline a clean architecture and give you a minimal working template you can build on.

---

# 🧠 What you’re building

**Core features:**
1. Press a **hotkey** → activate selection mode  
2. **Drag to capture part of the webpage**
3. Save:
   - Image (screenshot)
   - Metadata:
     - URL
     - Title
     - Timestamp
4. Store locally (JSON or IndexedDB)
5. A **gallery page** to browse saved items

---

# 🏗️ Architecture Overview

Chrome extension (Manifest V3):

### Components
- **background.js (service worker)**
  - Handles screenshot capture
- **content.js**
  - Handles user interaction (selection box)
- **popup.html (optional)**
- **gallery.html**
  - Displays saved images + metadata
- **storage**
  - `chrome.storage.local` (easy)
  - or IndexedDB (better scalability)

---

# ⚙️ Step 1: Manifest

```json
{
  "manifest_version": 3,
  "name": "Web Capture Tool",
  "version": "1.0",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "commands": {
    "capture-area": {
      "suggested_key": {
        "default": "Ctrl+Shift+S"
      },
      "description": "Capture selected area"
    }
  },
  "action": {
    "default_title": "Capture"
  }
}
```

---

# 🎯 Step 2: Hotkey → Inject Selection Tool

### `background.js`

```javascript
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-area") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["content.js"]
      });
    });
  }
});
```

---

# 🖱️ Step 3: Area Selection (content.js)

This creates a draggable selection box.

```javascript
let startX, startY, box;

document.body.style.cursor = "crosshair";

document.addEventListener("mousedown", (e) => {
  startX = e.pageX;
  startY = e.pageY;

  box = document.createElement("div");
  box.style.position = "absolute";
  box.style.border = "2px dashed red";
  box.style.left = startX + "px";
  box.style.top = startY + "px";
  document.body.appendChild(box);

  document.addEventListener("mousemove", onMouseMove);
});

function onMouseMove(e) {
  const width = e.pageX - startX;
  const height = e.pageY - startY;

  box.style.width = Math.abs(width) + "px";
  box.style.height = Math.abs(height) + "px";
  box.style.left = Math.min(e.pageX, startX) + "px";
  box.style.top = Math.min(e.pageY, startY) + "px";
}

document.addEventListener("mouseup", async (e) => {
  document.removeEventListener("mousemove", onMouseMove);

  const rect = box.getBoundingClientRect();
  box.remove();

  const metadata = {
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    rect
  };

  chrome.runtime.sendMessage({
    type: "CAPTURE",
    rect: rect,
    metadata: metadata
  });
});
```

---

# 📸 Step 4: Capture Screenshot

### `background.js`

```javascript
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === "CAPTURE") {
    const tabId = sender.tab.id;

    chrome.tabs.captureVisibleTab(null, {}, async (dataUrl) => {
      const cropped = await cropImage(dataUrl, msg.rect);

      const item = {
        image: cropped,
        ...msg.metadata
      };

      saveItem(item);
    });
  }
});

async function cropImage(dataUrl, rect) {
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());

  const canvas = new OffscreenCanvas(rect.width, rect.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    img,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );

  const blob = await canvas.convertToBlob();
  return await blobToBase64(blob);
}

function blobToBase64(blob) {
  return new Promise((res) => {
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result);
    reader.readAsDataURL(blob);
  });
}
```

---

# 💾 Step 5: Storage (simple JSON-like)

```javascript
function saveItem(item) {
  chrome.storage.local.get(["captures"], (result) => {
    const captures = result.captures || [];
    captures.push(item);

    chrome.storage.local.set({ captures });
  });
}
```

---

# 🖼️ Step 6: Gallery Page

### `gallery.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Gallery</title>
  <style>
    .card {
      border: 1px solid #ccc;
      margin: 10px;
      padding: 10px;
    }
    img {
      max-width: 300px;
    }
  </style>
</head>
<body>
  <h1>Saved Captures</h1>
  <div id="gallery"></div>

  <script src="gallery.js"></script>
</body>
</html>
```

---

### `gallery.js`

```javascript
chrome.storage.local.get(["captures"], (result) => {
  const gallery = document.getElementById("gallery");

  (result.captures || []).forEach((item) => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${item.image}" />
      <p><b>Title:</b> ${item.title}</p>
      <p><b>URL:</b> <a href="${item.url}" target="_blank">${item.url}</a></p>
      <p><b>Date:</b> ${item.timestamp}</p>
    `;

    gallery.appendChild(div);
  });
});
```

---

# 🚀 Nice Upgrades (worth doing)

### 1. Better storage
- Switch to **IndexedDB** (handles large images better)

### 2. Tagging system
```json
{
  "tags": ["analog", "opamp", "layout"]
}
```

### 3. Search
- Filter by URL / title / tags

### 4. Export dataset
- JSON download → useful for research datasets

### 5. Clipboard copy
- Copy image + metadata for papers

---

# ⚠️ Practical Gotchas

- `captureVisibleTab` only captures **visible area**
- Scrolling pages need stitching (more complex)
- Retina displays → scaling issues (`devicePixelRatio`)
- Permissions must be correct

---

# 🧩 If you want next step

I can help you extend this into something much more powerfreenssing ver c circuit work

Just tell me how far you want to take it.