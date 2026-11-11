import { DEFAULT_THEME_CHOICE } from "./default-theme-choice";
import type { ThemeChoice } from "./theme-choice";

/** What was stored, as a choice; anything else is the default. */
export function normaliseThemeChoice(value: unknown): ThemeChoice {
  return value === "dark" || value === "light" || value === "system" ? value : DEFAULT_THEME_CHOICE;
}
