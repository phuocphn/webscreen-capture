(() => {
  if (window.__wscActive) {
    return;
  }
  window.__wscActive = true;

  let startX = 0;
  let startY = 0;
  let dragging = false;

  const overlay = document.createElement("div");
  overlay.className = "wsc-overlay";

  const selection = document.createElement("div");
  selection.className = "wsc-selection";

  const hint = document.createElement("div");
  hint.className = "wsc-hint";
  hint.textContent = "Drag to select area. Press Esc to cancel.";

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(selection);
  document.documentElement.appendChild(hint);

  function cleanup() {
    window.__wscActive = false;
    document.removeEventListener("keydown", onKeyDown, true);
    overlay.removeEventListener("mousedown", onMouseDown, true);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    overlay.remove();
    selection.remove();
    hint.remove();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cleanup();
    }
  }

  function onMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    dragging = true;

    startX = event.clientX;
    startY = event.clientY;
    updateSelection(event.clientX, event.clientY);
  }

  function onMouseMove(event) {
    if (!dragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateSelection(event.clientX, event.clientY);
  }

  function onMouseUp(event) {
    if (!dragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragging = false;

    const rect = normalizeRect(startX, startY, event.clientX, event.clientY);

    if (rect.width < 4 || rect.height < 4) {
      cleanup();
      return;
    }

    const payload = {
      type: "CAPTURE_SELECTION",
      rect,
      devicePixelRatio: window.devicePixelRatio || 1,
      metadata: {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString()
      }
    };

    cleanup();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chrome.runtime.sendMessage(payload);
      });
    });
  }

  function updateSelection(currentX, currentY) {
    const rect = normalizeRect(startX, startY, currentX, currentY);
    selection.style.left = `${rect.left}px`;
    selection.style.top = `${rect.top}px`;
    selection.style.width = `${rect.width}px`;
    selection.style.height = `${rect.height}px`;
  }

  function normalizeRect(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.max(1, Math.abs(x2 - x1));
    const height = Math.max(1, Math.abs(y2 - y1));
    return { left, top, width, height };
  }

  document.addEventListener("keydown", onKeyDown, true);
  overlay.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", onMouseUp, true);
})();
