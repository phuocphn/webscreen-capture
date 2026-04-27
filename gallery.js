const STORAGE_KEY = "captures";

const emptyState = document.getElementById("emptyState");
const grid = document.getElementById("grid");
const exportBtn = document.getElementById("exportJson");
const clearBtn = document.getElementById("clearAll");

init();

async function init() {
  const captures = await getCaptures();
  render(captures);

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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
