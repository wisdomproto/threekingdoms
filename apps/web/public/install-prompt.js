// Capture before React/game data loads; retain across client-side navigation.
window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();
  window.__gameInstallPrompt = event;
  window.dispatchEvent(new Event("game-install-ready"));
});
window.addEventListener("appinstalled", function () {
  window.__gameInstallPrompt = null;
});
