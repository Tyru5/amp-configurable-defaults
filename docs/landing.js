// Browsers without cross-document view transitions fade the page out before
// moving to another page of this site; the next page fades in on load.
if (!window.CSSViewTransitionRule) {
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  addEventListener("pageshow", () => root.classList.remove("page-leave"));
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target ||
      link.hasAttribute("download") ||
      link.origin !== location.origin ||
      link.pathname === location.pathname ||
      reducedMotion.matches
    ) {
      return;
    }
    event.preventDefault();
    root.classList.remove("page-enter");
    root.classList.add("page-leave");
    setTimeout(() => location.assign(link.href), 200);
  });
}

const themeControl = document.querySelector(".theme-control");
for (const input of themeControl.querySelectorAll("input")) {
  input.checked = input.value === (document.documentElement.dataset.theme || "system");
}
themeControl.hidden = false;
themeControl.addEventListener("change", (event) => {
  const theme = event.target.value;
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const dark =
      theme === "dark" || (theme === "system" && meta.media === "(prefers-color-scheme: dark)");
    meta.content = dark ? "#1b2a22" : "#e7eddf";
  }
  try {
    if (theme === "system") {
      localStorage.removeItem("landing-theme");
    } else {
      localStorage.setItem("landing-theme", theme);
    }
  } catch {
    // The selected theme still applies for this page when storage is blocked.
  }
});
