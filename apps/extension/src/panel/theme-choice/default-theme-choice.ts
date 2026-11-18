import type { ThemeChoice } from "./theme-choice";

/** First run follows the device (t925); Dark and Light are the person's choice. Core's `styles/tokens.css` reads `system` as the OS setting. */
export const DEFAULT_THEME_CHOICE: ThemeChoice = "system";
