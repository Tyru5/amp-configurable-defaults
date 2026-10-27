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
