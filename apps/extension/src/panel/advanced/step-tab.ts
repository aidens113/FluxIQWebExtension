// The Current step tab (was the Recorder tab's runtime card; UI audit,
// section 4): the step FluxIQ last ran, with its page element, browser tab,
// outcome and start time. Redrawn on every status and, while shown, every few
// seconds so "Started" stays true (audit defect S3).

import { createElement } from "../dom";
import type { PanelViewContext } from "../shell";
import { stepRows } from "./step-rows";
import type { AdvancedTabPanel } from "./tab-panel";

const CLOCK_MS = 5_000;

/** Mounts the Current step tab. */
export function mountStepTab(context: PanelViewContext): AdvancedTabPanel {
  const { store } = context;
  let clock: ReturnType<typeof setInterval> | undefined;

  const empty = createElement("p", { className: "card-line", text: "Nothing has run yet." });
  const rows = createElement("dl", { className: "diagnostics step-rows", hidden: true });
  const element = createElement("div", { className: "advanced-tab step-tab" }, [
    createElement("h2", { className: "card-title", text: "Current step" }),
    empty,
    rows
  ]);

  function render(): void {
    const described = stepRows(store.current()?.runtime, Date.now());
    empty.hidden = described !== undefined;
    rows.hidden = described === undefined;
    rows.replaceChildren(...(described ?? []).map((row) => createElement("div", {}, [
      createElement("dt", { text: row.label }),
      createElement("dd", { text: row.value })
    ])));
  }

  store.subscribe(render);

  return {
    element,
    shown() {
      render();
      clock ??= setInterval(render, CLOCK_MS);
    },
    hidden() {
      if (clock !== undefined) clearInterval(clock);
      clock = undefined;
    }
  };
}
