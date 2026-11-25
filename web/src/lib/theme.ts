// Light / dark / follow-the-phone. The choice is remembered on this device;
// index.html applies it before first paint, and this keeps it current after.

export type Theme = "system" | "light" | "dark";

const KEY = "sitebook-theme";

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // storage blocked (private mode) — fall through to following the device
  }
  return "system";
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // not persisted, but still applies for this visit
  }
  applyTheme(theme);
}
