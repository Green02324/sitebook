import { useEffect, useState } from "react";
import { applyTheme, getTheme, setTheme, type Theme } from "../lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  // In Auto, follow the phone as it flips between light and dark (e.g. at sunset).
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function choose(value: Theme) {
    setTheme(value);
    setThemeState(value);
  }

  return (
    <div className="mb-1 px-3 py-2">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Appearance</div>
      <div className="flex rounded-md bg-slate-800 p-0.5" role="group" aria-label="Appearance">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => choose(o.value)}
            aria-pressed={theme === o.value}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium ${theme === o.value ? "bg-slate-600 text-white" : "text-slate-300 hover:text-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
