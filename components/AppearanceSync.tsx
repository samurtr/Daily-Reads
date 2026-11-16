"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { applyAppearance, type FontSize, type Theme } from "@/lib/appearance";
import { getSetting } from "@/lib/db";

/** Applies the theme and font-size settings to the page whenever they change. */
export default function AppearanceSync() {
  const appearance = useLiveQuery(async () => ({
    theme: await getSetting<Theme>("theme"),
    fontSize: await getSetting<FontSize>("font_size"),
  }));

  useEffect(() => {
    if (!appearance) return;
    const apply = () => applyAppearance(appearance.theme, appearance.fontSize);
    apply();
    // With no explicit theme, keep following the device preference.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);

  return null;
}
