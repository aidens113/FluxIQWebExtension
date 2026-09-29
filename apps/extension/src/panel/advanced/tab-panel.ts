// What each Advanced tab gives the Advanced view: its content, and a call when
// it comes into and goes out of view. A tab loads its data and starts its clock
// only while shown, so a hidden tab costs nothing.

/** One Advanced tab's content. */
export type AdvancedTabPanel = {
  readonly element: HTMLElement;
  /** The tab came into view: refresh what it shows. */
  shown(): void;
  /** The tab left view: stop any timer. */
  hidden(): void;
};
