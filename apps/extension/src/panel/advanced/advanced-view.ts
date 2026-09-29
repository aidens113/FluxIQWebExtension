// The Advanced view (UI audit, section 4, "What moves to Advanced"): four tabs
// -- Activity, Recordings, Current step, Connection -- holding everything the
// simple view leaves out, where raw states, selectors, ids and error text are
// allowed.
//
// The shell routes here with `{ mode: "advanced", tab }` from the header's
// View switch, the Settings gear (Connection) and every Details link
// (Activity). Picking a tab goes back through `navigate`, so the shell
// remembers it. The way back is the header's "Simple"; this view has no Close.
//
//   advanced-view.ts      this file: tab strip, panels, routing
//   tab-strip.ts          the tablist and its keyboard
//   tab-panel.ts          the seam each tab implements
//   activity-tab.ts       the activity log, paged
//   recordings-tab.ts     FluxIQ's recordings, paged, with Refresh
//   step-tab.ts           the last step's detail
//   connection/           settings with Save, Disconnect, ids, Forget this pairing
//   pager.ts, page-count.ts, recordings-copy.ts, step-rows.ts, time-copy.ts
//                         the pager and the pure words the tabs show

import type { AdvancedTab, PanelRoute, PanelView, PanelViewContext } from "../shell";
import { createElement } from "../dom";
import { mountActivityTab } from "./activity-tab";
import { mountConnectionTab } from "./connection";
import { mountRecordingsTab } from "./recordings-tab";
import { mountStepTab } from "./step-tab";
import type { AdvancedTabPanel } from "./tab-panel";
import { createTabStrip, panelId, TAB_LABELS, tabId } from "./tab-strip";
import "./advanced.css";

/** Mounts the Advanced view (pinned by the UI audit, section 5). */
export function mountAdvancedView(context: PanelViewContext): PanelView {
  const panels: Record<AdvancedTab, AdvancedTabPanel> = {
    activity: mountActivityTab(context),
    recordings: mountRecordingsTab(context),
    step: mountStepTab(context),
    connection: mountConnectionTab(context)
  };
  const strip = createTabStrip((tab) => context.navigate({ mode: "advanced", tab }));
  const hosts = TAB_LABELS.map(({ tab }) => createElement("section", {
    id: panelId(tab),
    className: "tab-panel",
    hidden: true,
    attrs: { role: "tabpanel", "aria-labelledby": tabId(tab), tabindex: "0", "data-tab": tab }
  }, [panels[tab].element]));

  const element = createElement("section", { className: "advanced-view card", hidden: true, attrs: { "aria-label": "Advanced" } }, [strip.element, ...hosts]);
  let current: AdvancedTab | undefined;

  function select(tab: AdvancedTab): void {
    strip.select(tab);
    if (tab === current) return;
    if (current !== undefined) panels[current].hidden();
    current = tab;
    for (const host of hosts) host.hidden = host.dataset.tab !== tab;
    panels[tab].shown();
  }

  return {
    element,
    show(route: PanelRoute) {
      const wasHidden = element.hidden;
      element.hidden = false;
      const tab = route.mode === "advanced" ? route.tab : current ?? "activity";
      // Coming back into view refreshes the tab even when it is the same one.
      if (wasHidden && tab === current) {
        panels[tab].shown();
        strip.select(tab);
        return;
      }
      select(tab);
    },
    hide() {
      element.hidden = true;
      if (current !== undefined) panels[current].hidden();
    }
  };
}
