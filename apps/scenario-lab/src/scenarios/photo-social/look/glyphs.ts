/** Icon paths. Every icon is one path in a 24-unit box, drawn in the current colour. */
export const GLYPHS = {
  home: "M3 11l9-8 9 8v10h-6v-6H9v6H3z",
  search: "M10.5 3a7.5 7.5 0 1 0 4.7 13.3L21 22l1-1-5.7-5.8A7.5 7.5 0 0 0 10.5 3z",
  explore: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3 7-2 4-4 2 2-4z",
  reels: "M3 3h18v18H3zM3 8h18M9 3l3 5M15 3l3 5M10 12v6l5-3z",
  messages: "M12 2C6.5 2 2 6 2 11c0 2.8 1.4 5.3 3.6 6.9V22l3.4-2c1 .3 2 .4 3 .4 5.5 0 10-4 10-9S17.5 2 12 2z",
  heart: "M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z",
  create: "M3 3h18v18H3zM12 7v10M7 12h10",
  comment: "M20.7 17.6A9 9 0 1 0 17 20.7L22 22z",
  share: "M22 3 9.2 10.1M22 3l-7 19-3-9-9-3z",
  bookmark: "M20 21 12 13.4 4 21V3h16z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  next: "M9 5l7 7-7 7",
  back: "M15 5l-7 7 7 7",
  close: "M5 5l14 14M19 5 5 19",
  plus: "M12 4v16M4 12h16",
  check: "M5 12l5 5L20 7",
  badge: "M12 1l2.7 2 3.3-.2.9 3.2 2.8 1.8-1.2 3.2 1.2 3.2-2.8 1.8-.9 3.2-3.3-.2L12 23l-2.7-2-3.3.2-.9-3.2-2.8-1.8L3.5 13 2.3 9.8l2.8-1.8L6 4.8l3.3.2z",
  pin: "M9 2h6l-1 7 4 4H6l4-4zM12 13v9",
  play: "M7 4v16l13-8z",
  stack: "M7 3h14v14H7zM3 7v14h14",
  chevronDown: "M5 9l7 7 7-7",
  chevronUp: "M5 15l7-7 7 7",
} as const;

export type GlyphName = keyof typeof GLYPHS;

/**
 * One icon. `label` becomes the svg's `aria-label`, which is the only name the
 * div-buttons around most icons ever get; without one the icon is hidden and
 * the control around it is nameless.
 */
export function glyph(name: GlyphName, className: string, label?: string): string {
  const a11y = label === undefined ? `aria-hidden="true"` : `aria-label="${label}" role="img"`;
  const fill = name === "badge" ? "currentColor" : "none";
  return `<svg class="${className}" ${a11y} viewBox="0 0 24 24" width="24" height="24"><path d="${GLYPHS[name]}" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
