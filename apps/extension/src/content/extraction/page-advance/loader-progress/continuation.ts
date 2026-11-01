import { detectPagination } from "../../detect-pagination";
import { textOutsideSensitiveControls } from "../../../sensitive-text";
import { loadMoreControlOnPage } from "../appending-control";
import { listGrowth } from "./list-growth";

type Binding = { readonly control: Element | undefined };
type Origin = { document: Document; address: string; container: Element; item: string; rows: readonly Element[]; records: readonly string[]; control: Element };
const origins = new WeakMap<Binding, Origin>();

/** Browser-owned list/control identity. A copied binding cannot establish continuation provenance. */
export const loadMoreContinuations = {
  bind(named: Element | null, item: string, shown: readonly Element[]): Binding {
    const control = loadMoreControlOnPage(named, shown);
    const binding = Object.freeze({ control });
    const container = shown[0]?.parentElement;
    if (!control || !container || !sameRows([...document.querySelectorAll(item)], shown)
      || shown.some((row) => row.parentElement !== container) || !safeControl(control)) return binding;
    try { if (detected(shown, container) !== control) return binding; } catch { return binding; }
    origins.set(binding, { document, address: document.URL, container, item, rows: [...shown], records: shown.map(record), control });
    return binding;
  },
  /** Re-detect against the actual originating list; never resolve an old control position. */
  current(binding: Binding): Element | undefined {
    const origin = liveOrigin(binding);
    if (!origin || loadMoreContinuations.state(binding) !== "unchanged") return undefined;
    const control = detected([...document.querySelectorAll(origin.item)], origin.container);
    return control && safeControl(control) ? control : undefined;
  },
  /** Only appended semantic records count; missing/replaced origins remain uncertain. */
  state(binding: Binding): "unchanged" | "advanced" | "unknown" {
    const origin = liveOrigin(binding);
    if (!origin) return "unknown";
    const rows = [...document.querySelectorAll(origin.item)];
    if (rows.length < origin.rows.length || rows.some((row) => row.parentElement !== origin.container)) return "unknown";
    if (rows.slice(0, origin.rows.length).some((row, index) => record(row) !== origin.records[index])) return "unknown";
    if (rows.length === origin.rows.length) return sameRows(rows, origin.rows) ? "unchanged" : "unknown";
    return rows.slice(origin.rows.length).every((row) => listGrowth.unmarked(row)
      && record(row) !== '["",[]]') ? "advanced" : "unknown";
  }
};

function liveOrigin(binding: Binding): Origin | undefined {
  const origin = origins.get(binding);
  return origin && origin.document === document && origin.address === document.URL && origin.container.isConnected ? origin : undefined;
}

function detected(rows: readonly Element[], container: Element): Element | undefined {
  const way = detectPagination(rows, container);
  if (way?.mode !== "loadMore") return undefined;
  const matches = [...document.querySelectorAll(way.control)];
  return matches.length === 1 ? matches[0] : undefined;
}

function safeControl(control: Element): boolean {
  return control.isConnected && typeof control.closest === "function" && typeof control.tagName === "string"
    && control.getAttribute("href") === null && control.getAttribute("form") === null
    && control.getAttribute("type")?.toLowerCase() !== "submit" && control.closest("form") === null
    && (control.tagName.toUpperCase() === "BUTTON" || control.getAttribute("role")?.toLowerCase() === "button");
}

function sameRows(left: readonly Element[], right: readonly Element[]): boolean {
  return left.length === right.length && left.every((row, index) => row === right[index]);
}

/** Compared only in this content script; record text and addresses never enter a receipt. */
function record(row: Element): string {
  return JSON.stringify([textOutsideSensitiveControls(row).replace(/\s+/gu, " ").trim(),
    [...row.querySelectorAll("a[href]")].map((link) => link.getAttribute("href"))]);
}
