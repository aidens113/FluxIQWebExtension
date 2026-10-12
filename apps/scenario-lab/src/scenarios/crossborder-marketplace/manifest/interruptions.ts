/**
 * The interruption switch's arms, as the variants declare them
 * (`state/interruption.ts` reads them): the page the flash-sale promotion
 * stands over, the load of that page it first stands over, and whether its
 * close glyph works. Kept apart from the manifest so the scenario's tests arm
 * exactly what the Lab arms.
 */
export const INTERRUPTIONS = {
  /** Before the first action: the home page's first load. */
  onArrival: { page: "home", visit: 1, dismiss: "closes" },
  /** A chosen loop pass: the second product page the visit loads. */
  secondItem: { page: "item", visit: 2, dismiss: "closes" },
  /** Midway, with a close glyph that does nothing: the first product page and every one after it. */
  stuck: { page: "item", visit: 1, dismiss: "inert" },
} as const;
