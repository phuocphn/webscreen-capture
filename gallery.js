const STORAGE_KEY = "captures";

const emptyState = document.getElementById("emptyState");
const grid = document.getElementById("grid");
const toggleSelectBtn = document.getElementById("toggleSelect");
const selectAllBtn = document.getElementById("selectAll");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const importBtn = document.getElementById("importJson");
const importFileInput = document.getElementById("importFile");
const exportBtn = document.getElementById("exportJson");
const clearBtn = document.getElementById("clearAll");
const viewerModal = document.getElementById("viewerModal");
const viewerImage = document.getElementById("viewerImage");
const viewerTitle = document.getElementById("viewerTitle");
const viewerUrl = document.getElementById("viewerUrl");
const viewerDate = document.getElementById("viewerDate");
const viewerNote = document.getElementById("viewerNote");
const viewerTags = document.getElementById("viewerTags");
const viewerPrev = document.getElementById("viewerPrev");
const viewerNext = document.getElementById("viewerNext");
const viewerClose = document.getElementById("viewerClose");

let capturesState = [];
let selectionMode = false;
let selectedIds = new Set();
let openMenuPanel = null;
let viewerIndex = -1;

init();

async function init() {
  capturesState = await getCaptures();
  render(capturesState);
  updateSelectionActions();

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".card-menu") && openMenuPanel) {
      openMenuPanel.hidden = true;
      openMenuPanel = null;
    }
  });

  viewerModal?.addEventListener("click", (event) => {
    if (event.target === viewerModal) {
      closeViewer();
    }
  });

  viewerClose?.addEventListener("click", () => closeViewer());
  viewerPrev?.addEventListener("click", () => moveViewer(-1));
  viewerNext?.addEventListener("click", () => moveViewer(1));

  document.addEventListener("keydown", (event) => {
    if (!viewerModal || viewerModal.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeViewer();
    } else if (event.key === "ArrowLeft") {
      moveViewer(-1);
    } else if (event.key === "ArrowRight") {
      moveViewer(1);
    }
  });

  toggleSelectBtn?.addEventListener("click", () => {
    selectionMode = !selectionMode;
    selectedIds = new Set();
    updateSelectionActions();
    render(capturesState);
  });

  selectAllBtn?.addEventListener("click", () => {
    if (!capturesState.length) {
      return;
    }

    if (selectedIds.size === capturesState.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(capturesState.map((item, index) => getCaptureId(item, index)));
    }

    updateSelectionActions();
    render(capturesState);
  });

  deleteSelectedBtn?.addEventListener("click", async () => {
    if (!selectedIds.size) {
      return;
    }

    const ok = confirm(`Delete ${selectedIds.size} selected capture(s)?`);
    if (!ok) {
      return;
    }

    await deleteCapturesByIds(selectedIds);
  });

  importBtn?.addEventListener("click", () => {
    importFileInput?.click();
  });

  importFileInput?.addEventListener("change", async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const imported = await readJsonFile(file);
      const normalized = normalizeImportedCaptures(imported);

      if (!normalized.length) {
        alert("No valid captures found in the selected JSON file.");
        return;
      }

      capturesState = dedupeCaptures([...normalized, ...capturesState]);
      await chrome.storage.local.set({ [STORAGE_KEY]: capturesState });
      render(capturesState);
      alert(`Imported ${normalized.length} capture(s).`);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Unable to import JSON. Please choose a valid exported file.");
    }
  });

  exportBtn?.addEventListener("click", () => exportCaptures(capturesState));
  clearBtn?.addEventListener("click", async () => {
    const ok = confirm("Delete all captures from local storage?");
    if (!ok) {
      return;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    capturesState = [];
    selectedIds = new Set();
    selectionMode = false;
    closeViewer();
    updateSelectionActions();
    render([]);
  });
}

async function getCaptures() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || [];
}

function render(captures) {
  if (!grid || !emptyState) {
    return;
  }

  grid.innerHTML = "";
  emptyState.style.display = captures.length ? "none" : "block";

  for (const [index, item] of captures.entries()) {
    const captureId = getCaptureId(item, index);
    const card = document.createElement("article");
    card.className = "card";

    if (!selectionMode) {
      const menu = document.createElement("div");
      menu.className = "card-menu";

      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "card-menu-trigger";
      menuButton.setAttribute("aria-label", "Open item menu");
      menuButton.textContent = "⋯";

      const menuPanel = document.createElement("div");
      menuPanel.className = "card-menu-panel";
      menuPanel.hidden = true;

      const deleteItemBtn = document.createElement("button");
      deleteItemBtn.type = "button";
      deleteItemBtn.className = "card-menu-action danger";
      deleteItemBtn.textContent = "Delete";

      menuButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (openMenuPanel && openMenuPanel !== menuPanel) {
          openMenuPanel.hidden = true;
        }

        menuPanel.hidden = !menuPanel.hidden;
        openMenuPanel = menuPanel.hidden ? null : menuPanel;
      });

      deleteItemBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const ok = confirm("Delete this capture?");
        if (!ok) {
          return;
        }

        await deleteCapturesByIds(new Set([captureId]));
      });

      menuPanel.appendChild(deleteItemBtn);
      menu.appendChild(menuButton);
      menu.appendChild(menuPanel);
      card.appendChild(menu);
    }

    if (selectionMode) {
      card.classList.add("selecting");
      const checkbox = document.createElement("input");
      checkbox.className = "card-check";
      checkbox.type = "checkbox";
      checkbox.checked = selectedIds.has(captureId);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedIds.add(captureId);
        } else {
          selectedIds.delete(captureId);
        }
        updateSelectionActions();
        card.classList.toggle("selected", checkbox.checked);
      });
      card.appendChild(checkbox);
      card.classList.toggle("selected", checkbox.checked);
    }

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.title || "Captured image";

    const imageButton = document.createElement("button");
    imageButton.type = "button";
    imageButton.className = "card-image-btn";
    imageButton.setAttribute("aria-label", "View larger image");
    imageButton.addEventListener("click", () => {
      if (selectionMode) {
        return;
      }

      openViewer(index);
    });
    imageButton.appendChild(image);

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("p");
    title.innerHTML = `<strong>Title:</strong> ${escapeHtml(item.title || "(Untitled)")}`;

    const url = document.createElement("p");
    const safeUrl = item.url || "";
    url.innerHTML = `<strong>URL:</strong> <a href="${safeUrl}" target="_blank" rel="noreferrer">${escapeHtml(safeUrl)}</a>`;

    const date = document.createElement("p");
    date.innerHTML = `<strong>Date:</strong> ${escapeHtml(formatDate(item.timestamp))}`;

    meta.appendChild(title);
    meta.appendChild(url);
    meta.appendChild(date);

    if (item.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.innerHTML = `<strong>Note:</strong> ${escapeHtml(item.note)}`;
      meta.appendChild(note);
    }

    if (item.tags && item.tags.length > 0) {
      const tagsContainer = document.createElement("div");
      tagsContainer.className = "meta-tags";

      for (const tag of item.tags) {
        const tagElement = document.createElement("span");
        tagElement.className = "tag";
        tagElement.textContent = escapeHtml(tag);
        tagsContainer.appendChild(tagElement);
      }

      meta.appendChild(tagsContainer);
    }

    card.appendChild(imageButton);
    card.appendChild(meta);
    grid.appendChild(card);
  }
}

function getCaptureId(item, index) {
  if (item.id) {
    return String(item.id);
  }

  return `${item.timestamp || "no-time"}|${item.url || "no-url"}|${index}`;
}

async function deleteCapturesByIds(ids) {
  capturesState = capturesState.filter((item, index) => !ids.has(getCaptureId(item, index)));
  await chrome.storage.local.set({ [STORAGE_KEY]: capturesState });

  selectedIds = new Set();
  openMenuPanel = null;
  closeViewer();
  updateSelectionActions();
  render(capturesState);
}

function openViewer(index) {
  if (!viewerModal || !capturesState.length) {
    return;
  }

  viewerIndex = Math.max(0, Math.min(index, capturesState.length - 1));
  syncViewer();
  viewerModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeViewer() {
  if (!viewerModal || viewerModal.hidden) {
    return;
  }

  viewerModal.hidden = true;
  viewerIndex = -1;
  document.body.style.overflow = "";
}

function moveViewer(offset) {
  if (viewerIndex < 0) {
    return;
  }

  const nextIndex = viewerIndex + offset;
  if (nextIndex < 0 || nextIndex >= capturesState.length) {
    return;
  }

  viewerIndex = nextIndex;
  syncViewer();
}

function syncViewer() {
  if (
    viewerIndex < 0 ||
    viewerIndex >= capturesState.length ||
    !viewerImage ||
    !viewerTitle ||
    !viewerUrl ||
    !viewerDate ||
    !viewerNote ||
    !viewerTags
  ) {
    return;
  }

  const item = capturesState[viewerIndex];
  viewerImage.src = item.image || "";
  viewerImage.alt = item.title || "Captured image";
  viewerTitle.textContent = item.title || "(Untitled)";
  viewerDate.textContent = formatDate(item.timestamp);
  viewerNote.textContent = item.note || "";
  viewerNote.parentElement.hidden = !item.note;

  const safeUrl = item.url || "";
  viewerUrl.textContent = safeUrl || "N/A";
  if (safeUrl) {
    viewerUrl.href = safeUrl;
  } else {
    viewerUrl.removeAttribute("href");
  }

  viewerTags.innerHTML = "";
  if (item.tags && item.tags.length > 0) {
    for (const tag of item.tags) {
      const tagElement = document.createElement("span");
      tagElement.className = "tag";
      tagElement.textContent = tag;
      viewerTags.appendChild(tagElement);
    }
  }

  if (viewerPrev) {
    viewerPrev.disabled = viewerIndex === 0;
  }

  if (viewerNext) {
    viewerNext.disabled = viewerIndex === capturesState.length - 1;
  }
}

function updateSelectionActions() {
  if (!toggleSelectBtn || !selectAllBtn || !deleteSelectedBtn) {
    return;
  }

  toggleSelectBtn.textContent = selectionMode ? "Cancel Selection" : "Select Items";
  selectAllBtn.hidden = !selectionMode;
  deleteSelectedBtn.hidden = !selectionMode;

  const hasItems = capturesState.length > 0;
  const selectedCount = selectedIds.size;
  selectAllBtn.disabled = !hasItems;
  selectAllBtn.textContent = hasItems && selectedCount === capturesState.length ? "Unselect All" : "Select All";
  deleteSelectedBtn.disabled = selectedCount === 0;
  deleteSelectedBtn.textContent = selectedCount > 0 ? `Delete Selected (${selectedCount})` : "Delete Selected";
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function exportCaptures(captures) {
  const blob = new Blob([JSON.stringify(captures, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url,
    filename: `webscreen-captures-${Date.now()}.json`,
    saveAs: true
  });

  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "[]")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function normalizeImportedCaptures(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && typeof item.image === "string")
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      image: item.image,
      url: item.url || "",
      title: item.title || "",
      timestamp: item.timestamp || new Date().toISOString(),
      tags: Array.isArray(item.tags) ? item.tags : [],
      note: item.note || "",
      rect: item.rect || null
    }));
}

function dedupeCaptures(captures) {
  const seen = new Set();
  const result = [];

  for (const item of captures) {
    const key = item.id || `${item.image}|${item.url}|${item.timestamp}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
