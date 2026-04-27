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

    // Keep overlay visuals during drag, but hide them before requesting capture.
    overlay.style.display = "none";
    selection.style.display = "none";
    hint.style.display = "none";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage(payload, (response) => {
            if (response?.ok && response?.image) {
              showTagModal(response.image);
            } else {
              cleanup();
            }
          });
        }, 150);
      });
    });
  }

  function showTagModal(imageData) {
    const modal = document.createElement("div");
    modal.className = "wsc-tag-modal";

    const dialog = document.createElement("div");
    dialog.className = "wsc-tag-dialog";

    const title = document.createElement("h2");
    title.textContent = "Add Tags (optional)";

    const input = document.createElement("input");
    input.className = "wsc-tag-input";
    input.type = "text";
    input.placeholder = "e.g. chart, diagram, code (comma-separated)";

    const note = document.createElement("textarea");
    note.className = "wsc-note-input";
    note.rows = 4;
    note.placeholder = "Add a short note about this capture...";

    const hint = document.createElement("p");
    hint.className = "wsc-tag-hint";
    hint.textContent = "Separate tags with commas";

    const actions = document.createElement("div");
    actions.className = "wsc-tag-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      modal.remove();
      cleanup();
    });

    const saveBtn = document.createElement("button");
    saveBtn.className = "primary";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
      const tagsRaw = input.value.trim();
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        type: "SAVE_CAPTURE",
        image: imageData,
        tags,
        note: note.value.trim(),
        metadata: {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString()
        }
      };

      chrome.runtime.sendMessage(payload, () => {
        modal.remove();
        cleanup();
      });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    dialog.appendChild(title);
    dialog.appendChild(input);
  dialog.appendChild(note);
    dialog.appendChild(hint);
    dialog.appendChild(actions);

    modal.appendChild(dialog);
    document.documentElement.appendChild(modal);

    input.focus();
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
