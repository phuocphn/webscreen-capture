const STORAGE_KEY = "captures";

const emptyState = document.getElementById("emptyState");
const grid = document.getElementById("grid");
const importBtn = document.getElementById("importJson");
const importFileInput = document.getElementById("importFile");
const exportBtn = document.getElementById("exportJson");
const clearBtn = document.getElementById("clearAll");

init();

async function init() {
  let captures = await getCaptures();
  render(captures);

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

      captures = dedupeCaptures([...normalized, ...captures]);
      await chrome.storage.local.set({ [STORAGE_KEY]: captures });
      render(captures);
      alert(`Imported ${normalized.length} capture(s).`);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Unable to import JSON. Please choose a valid exported file.");
    }
  });

  exportBtn?.addEventListener("click", () => exportCaptures(captures));
  clearBtn?.addEventListener("click", async () => {
    const ok = confirm("Delete all captures from local storage?");
    if (!ok) {
      return;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
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

  for (const item of captures) {
    const card = document.createElement("article");
    card.className = "card";

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.title || "Captured image";

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

    card.appendChild(image);
    card.appendChild(meta);
    grid.appendChild(card);
  }
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
