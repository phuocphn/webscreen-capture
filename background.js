const STORAGE_KEY = "captures";

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-area") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  await injectOverlay(tab.id);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) {
    return;
  }

  await injectOverlay(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CAPTURE_SELECTION") {
    handleCapture(message, sender)
      .then((image) => sendResponse({ ok: true, image }))
      .catch((error) => {
        console.error("Capture failed:", error);
        sendResponse({ ok: false, error: String(error) });
      });
    return true;
  }

  if (message?.type === "SAVE_CAPTURE") {
    saveCapture(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("Save failed:", error);
        sendResponse({ ok: false, error: String(error) });
      });
    return true;
  }
});

async function injectOverlay(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content.css"]
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function handleCapture(message, sender) {
  const windowId = sender?.tab?.windowId;
  if (windowId == null) {
    throw new Error("Missing tab context");
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  const croppedDataUrl = await cropDataUrl(dataUrl, message.rect, message.devicePixelRatio);
  return croppedDataUrl;
}

async function cropDataUrl(dataUrl, rect, devicePixelRatio = 1) {
  const bitmap = await dataUrlToImageBitmap(dataUrl);
  const sx = Math.max(0, Math.floor(rect.left * devicePixelRatio));
  const sy = Math.max(0, Math.floor(rect.top * devicePixelRatio));
  const sw = Math.max(1, Math.floor(rect.width * devicePixelRatio));
  const sh = Math.max(1, Math.floor(rect.height * devicePixelRatio));

  const canvas = new OffscreenCanvas(sw, sh);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get canvas context");
  }

  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return await blobToDataUrl(blob);
}

async function dataUrlToImageBitmap(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return await createImageBitmap(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function saveCapture(message) {
  const item = {
    id: crypto.randomUUID(),
    image: message.image,
    url: message.metadata.url,
    title: message.metadata.title,
    timestamp: message.metadata.timestamp,
    tags: message.tags || [],
    rect: null
  };

  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const captures = result[STORAGE_KEY] || [];
  captures.unshift(item);
  await chrome.storage.local.set({ [STORAGE_KEY]: captures });
}
