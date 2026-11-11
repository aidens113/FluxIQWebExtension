import type { ThemeChoice } from "./theme-choice";

/** Sets `data-theme` on the document element; Core's tokens read it (`dark` is the `:root` default, `system` follows the OS). */
export function applyThemeChoice(choice: ThemeChoice, root: { setAttribute(name: string, value: string): void } = document.documentElement): void {
  root.setAttribute("data-theme", choice);
}
