// The Activity tab (was the Events tab's "Event Log"; UI audit, section 4): the
// background's activity log, newest first, 25 to a page. This is where the raw
// labels live -- "Evidence: ...", screenshot hashes, timings -- that the simple
// view never shows.
//
// It reloads when it comes into view and whenever the background reports new
// activity while it is shown, and redraws its relative times every few seconds
// (audit defect S3: they used to freeze at render). The list scrolls inside
// its own box, so the pager stays in view (defect L1).

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ActivityEntry, RecordingLogPage } from "../../shared/protocol";
import { createElement } from "../dom";
import type { PanelViewContext } from "../shell";
import { pageCount } from "./page-count";
import { createPager } from "./pager";
import type { AdvancedTabPanel } from "./tab-panel";
import { relativeTime } from "./time-copy";

const PAGE_SIZE = 25;
const CLOCK_MS = 5_000;

/** Mounts the Activity tab. */
export function mountActivityTab(context: PanelViewContext): AdvancedTabPanel {
  const { store } = context;
  let page = 1;
  let log: RecordingLogPage | undefined;
  let visible = false;
  let loading = false;
  let reloadAgain = false;
  let seenActivityAt: number | undefined;
  let clock: ReturnType<typeof setInterval> | undefined;

  const lastLine = createElement("p", { className: "card-line", hidden: true });
  const list = createElement("ol", { className: "entry-list", attrs: { "aria-label": "Activity" } });
  const empty = createElement("p", { className: "card-line", text: "Nothing has happened yet.", hidden: true });
  const notice = createElement("p", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  const pager = createPager((step) => {
    page = Math.max(1, page + step);
    void load();
  });

  const element = createElement("div", { className: "advanced-tab activity-tab" }, [
    createElement("h2", { className: "card-title", text: "Activity" }),
    lastLine,
    notice,
    empty,
    list,
    pager.element
  ]);

  async function load(): Promise<void> {
    if (loading) {
      reloadAgain = true;
      return;
    }
    loading = true;
    pager.setBusy(true);
    const result = await store.request<{ log?: RecordingLogPage }>({ type: RUNTIME_MESSAGES.getRecordingLog, page, pageSize: PAGE_SIZE });
    loading = false;
    pager.setBusy(false);
    if (!result.ok || result.value.log === undefined) {
      notice.textContent = result.ok ? "Couldn't read the activity log." : result.sentence;
      notice.title = result.ok ? "" : result.detail ?? "";
      notice.hidden = false;
    } else {
      notice.hidden = true;
      log = result.value.log;
      page = log.page;
      pager.set(pageCount({ page: log.page, pageSize: log.pageSize, shown: log.items.length, total: log.total }));
      renderList();
    }
    if (reloadAgain) {
      reloadAgain = false;
      void load();
    }
  }

  function renderList(): void {
    const now = Date.now();
    const items = log?.items ?? [];
    list.replaceChildren(...items.map((entry) => entryRow(entry, now)));
    empty.hidden = log === undefined || items.length > 0 || page > 1;
    renderLastLine(now);
  }

  function renderLastLine(now: number): void {
    const at = store.current()?.lastActivityAt ?? log?.items[0]?.timestamp;
    lastLine.hidden = at === undefined;
    lastLine.textContent = at === undefined ? "" : `Last activity: ${relativeTime(at, now)}`;
  }

  store.subscribe((status) => {
    const changed = status.lastActivityAt !== seenActivityAt;
    seenActivityAt = status.lastActivityAt;
    if (visible && changed) void load();
  });

  return {
    element,
    shown() {
      visible = true;
      seenActivityAt = store.current()?.lastActivityAt;
      void load();
      clock ??= setInterval(renderList, CLOCK_MS);
    },
    hidden() {
      visible = false;
      if (clock !== undefined) clearInterval(clock);
      clock = undefined;
    }
  };
}

function entryRow(entry: ActivityEntry, now: number): HTMLElement {
  return createElement("li", { className: `entry tone-${entry.tone ?? "neutral"}` }, [
    createElement("div", { className: "entry-head" }, [
      createElement("strong", { text: entry.label }),
      createElement("time", { text: relativeTime(entry.timestamp, now), attrs: { datetime: new Date(entry.timestamp).toISOString() } })
    ]),
    ...(entry.detail ? [createElement("p", { className: "card-line", text: entry.detail })] : [])
  ]);
}
