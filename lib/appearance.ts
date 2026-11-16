export type Theme = "light" | "dark";
export type FontSize = "small" | "medium" | "large";

/** localStorage mirrors of the theme and font-size settings, read before first paint. */
export const THEME_MIRROR_KEY = "dr-theme";
export const FONT_MIRROR_KEY = "dr-font";

/** Until a theme is chosen in Settings, the app follows the device's light/dark preference. */
export function effectiveTheme(theme: Theme | undefined): Theme {
  if (theme) return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyAppearance(theme: Theme | undefined, fontSize: FontSize | undefined) {
  const root = document.documentElement;
  root.classList.toggle("dark", effectiveTheme(theme) === "dark");
  root.dataset.font = fontSize ?? "medium";
  try {
    if (theme) localStorage.setItem(THEME_MIRROR_KEY, theme);
    else localStorage.removeItem(THEME_MIRROR_KEY);
    if (fontSize) localStorage.setItem(FONT_MIRROR_KEY, fontSize);
    else localStorage.removeItem(FONT_MIRROR_KEY);
  } catch {
    // Storage unavailable: the settings still apply for this visit.
  }
}

/** Runs in <head> before first paint so the saved theme and font size never flash. */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var r=document.documentElement,t=localStorage.getItem("${THEME_MIRROR_KEY}"),f=localStorage.getItem("${FONT_MIRROR_KEY}");if(t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)r.classList.add("dark");if(f)r.dataset.font=f}catch(e){}})()`;
