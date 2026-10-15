// Apply the saved appearance before the first paint, including offline launches.
(() => {
  let preference;
  try {
    preference = localStorage.getItem("spintrack_theme");
  } catch {}
  const theme =
    preference === "light" || preference === "dark"
      ? preference
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#101917" : "#f4f6f2");
})();
