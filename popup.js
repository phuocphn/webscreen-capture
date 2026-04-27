document.getElementById("openGallery")?.addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("gallery.html") });
  window.close();
});
