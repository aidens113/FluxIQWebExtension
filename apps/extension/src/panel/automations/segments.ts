// The two segments of the Automations tab, Tasks and Library, as buttons. While a search is
// typed, the segment that is not showing says how many it found ("Library (2)"), so one box
// reaches both without switching.

import { createElement } from "../dom";

export type SegmentName = "tasks" | "library";

const WORDS: Record<SegmentName, string> = { tasks: "Tasks", library: "Library" };

/** The mounted segments. */
export type Segments = {
  readonly element: HTMLElement;
  /** Shows `name` as the one on show. */
  select(name: SegmentName): void;
  /** `count` matches for `name`, told only while it is not on show; null says nothing. */
  setCount(name: SegmentName, count: number | null): void;
};

/** Builds the segments for `names`; `onSelect` is called when a person presses one. */
export function createSegments(names: readonly SegmentName[], onSelect: (name: SegmentName) => void): Segments {
  const buttons = new Map<SegmentName, HTMLButtonElement>();
  const counts = new Map<SegmentName, number | null>();
  let current: SegmentName = names[0] ?? "tasks";
  for (const name of names) {
    const button = createElement("button", { className: "segment-button", text: WORDS[name], attrs: { type: "button", "aria-pressed": String(name === current), "data-segment": name } });
    button.addEventListener("click", () => onSelect(name));
    buttons.set(name, button);
  }
  function draw(): void {
    for (const [name, button] of buttons) {
      const count = counts.get(name) ?? null;
      const told = count !== null && name !== current;
      button.textContent = told ? `${WORDS[name]} (${count})` : WORDS[name];
      if (told) button.setAttribute("aria-label", `${WORDS[name]}, ${count} ${count === 1 ? "match" : "matches"}`);
      else button.removeAttribute("aria-label");
      button.setAttribute("aria-pressed", String(name === current));
    }
  }
  return {
    element: createElement("div", { className: "automations-segments", attrs: { role: "group", "aria-label": "Show" } }, [...buttons.values()]),
    select(name) {
      current = name;
      draw();
    },
    setCount(name, count) {
      counts.set(name, count);
      draw();
    }
  };
}
