// The Recordings tab (UI audit, section 4): FluxIQ's recordings for this
// browser, 10 to a page, with Refresh. It reloads when it comes into view and
// when a recording stops while it is shown (audit defect S2: the list used to
// omit the recording just made until Refresh). A failure reads as a sentence,
// with Core's raw text beside it (defect E1: "FluxIQ recordings API returned
// 401." used to be the list's empty state).

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { CoreRecordingSummary, CoreRecordingsPage } from "../../shared/protocol";
import { createElement } from "../dom";
import type { PanelViewContext } from "../shell";
import { pageCount } from "./page-count";
import { createPager } from "./pager";
import { recordingRowCopy, recordingsSourceLine } from "./recordings-copy";
import type { AdvancedTabPanel } from "./tab-panel";

const PAGE_SIZE = 10;

/** Mounts the Recordings tab. */
export function mountRecordingsTab(context: PanelViewContext): AdvancedTabPanel {
  const { store } = context;
  let page = 1;
  let visible = false;
  let loading = false;
  let wasRecording = store.current()?.recordingState === "recording";

  const sourceLine = createElement("p", { className: "card-line", hidden: true });
  const refreshButton = createElement("button", { className: "small-button", text: "Refresh", attrs: { type: "button" } });
  const list = createElement("ul", { className: "entry-list", attrs: { "aria-label": "Recordings" } });
  const empty = createElement("p", { className: "card-line", text: "No recordings yet.", hidden: true });
  const notice = createElement("div", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  const pager = createPager((step) => {
    page = Math.max(1, page + step);
    void load();
  });

  const element = createElement("div", { className: "advanced-tab recordings-tab" }, [
    createElement("div", { className: "section-heading" }, [
      createElement("div", {}, [createElement("h2", { className: "card-title", text: "Recordings" }), sourceLine]),
      refreshButton
    ]),
    notice,
    empty,
    list,
    pager.element
  ]);

  function setBusy(busy: boolean): void {
    loading = busy;
    refreshButton.disabled = busy;
    refreshButton.textContent = busy ? "Refreshing..." : "Refresh";
    pager.setBusy(busy);
  }

  async function load(): Promise<void> {
    if (loading) return;
    setBusy(true);
    const result = await store.request<{ recordings?: CoreRecordingsPage }>({ type: RUNTIME_MESSAGES.listRecordings, page, pageSize: PAGE_SIZE });
    setBusy(false);
    const recordings = result.ok ? result.value.recordings : undefined;
    if (recordings === undefined) {
      const sentence = result.ok ? "Couldn't load recordings from FluxIQ." : result.sentence;
      const detail = result.ok ? undefined : result.detail;
      notice.replaceChildren(createElement("span", { text: sentence }));
      if (detail !== undefined && detail !== sentence) notice.append(createElement("span", { className: "notice-detail", text: detail }));
      notice.hidden = false;
      return;
    }
    notice.hidden = true;
    page = recordings.page;
    const source = recordingsSourceLine(recordings.sourceUrl);
    sourceLine.textContent = source ?? "";
    sourceLine.hidden = source === undefined;
    list.replaceChildren(...recordings.items.map(recordingRow));
    empty.hidden = recordings.items.length > 0 || page > 1;
    pager.set(pageCount({ page: recordings.page, pageSize: recordings.pageSize, shown: recordings.items.length, total: recordings.total }));
  }

  refreshButton.addEventListener("click", () => void load());

  store.subscribe((status) => {
    const recording = status.recordingState === "recording";
    if (wasRecording && !recording && visible) void load();
    wasRecording = recording;
  });

  return {
    element,
    shown() {
      visible = true;
      void load();
    },
    hidden() {
      visible = false;
    }
  };
}

function recordingRow(summary: CoreRecordingSummary): HTMLElement {
  const copy = recordingRowCopy(summary);
  return createElement("li", { className: "entry" }, [
    createElement("div", { className: "entry-head" }, [
      createElement("strong", { text: copy.title }),
      createElement("span", { className: "pill", text: copy.pill })
    ]),
    ...(copy.line === undefined ? [] : [createElement("p", { className: "card-line", text: copy.line })])
  ]);
}
