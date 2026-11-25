// A list read detects its own list (t1038, D13).
//
// Until t1038 a read took two calls: `web.detect_repeating_structure` issued an
// `extraction.N` and its column keys, and the read named that handle and
// copied the keys. The five bigbox runs of 2026-11-24 made 102 detections for
// 44 reads, and 11 reads were refused for a key copied wrong
// (`data-first-simplification-plan/reports/t1035-agent-structure-audit.md`,
// change 2). So the read names its list the way every other step names what it
// acts on, and detects it itself:
//
// - `{handle: "tN"}`: a line of the page view inside the list, or the heading
//   it sits under. The list is detected around that element exactly as the
//   detection tool detects it (`../../structure/detect.ts`, which searches
//   outward when nothing repeats around it). A list the element is in is read;
//   where the page also sends the one record the element sits in, outside the
//   list it found, that record is read, since it is what was pointed at -- unless
//   the element is a heading or shows the list's own name, which names the list
//   under it: on the bigbox fixture the heading over a product shelf sent its own
//   header block as the record, and reading that answered one row, not the shelf.
// - `{words: "..."}`: the words of a line the page view shows in or above the
//   list; the first line in page order that shows them is the element.
// - no `handle`, `words` or `item` at all: the page's largest readable list.
//
// The detection is retained like the tool's (`../../structure/handles.ts`), and
// the call goes on as a read of the `extraction.N` it issued, through the
// resolver every read goes through (`../../plan-resolution/extraction/slot.ts`):
// every column kept, those `fields` does not name under their readable names
// (`../../structure/column-names.ts`), `fields` only picking the ones asked.
// The step the draft keeps names that handle and holds what it stands for
// (`../../plan-resolution/extraction/saved-list.ts`), so it runs again without
// detecting anything.
//
// **One element is still a one-row table (t903).** A read naming an element
// with `fields` that are only that element's own columns -- `text`, `value`,
// `link` -- reads the element itself, as before, and detects nothing; so does a
// `tN` around which no list can be found anywhere on the page.
//
// What it never does is guess. A read that names an `extraction.N`, a literal
// `item`, or a handle inside its fields goes to the resolver untouched; words
// no line shows are refused (`list_not_on_page`), never read as the page's
// largest list; a handle no view of this page binds goes to the resolver, which refuses it as stale or unknown as it
// refuses any read's; and a client that declares no detection reads exactly as before.

import type { JsonObject } from "fluxiq/core";
import { canonicalWebLlmTargetHandle } from "../../handle-spelling";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { detectRepeatingStructure, type WebLlmRepeatingStructure } from "../../structure";
import { recoverable, RecoverableToolRejection, rejectionDetail } from "../../tool-rejection";
import { isJsonRecord } from "../../untrusted-json";
import { webLlmListWords } from "../../rejection-next";
import type { WebNodeRun } from "../context";

/** The node that reads a list (`../call-words.ts` names it the same way). */
const LIST_NODE = "web.output.dom-extract_list";

/** The columns an element read as its own one-row table has (`../../plan-resolution/extraction/element-record.ts`). */
const ELEMENT_COLUMNS: ReadonlySet<string> = new Set(["text", "value", "link"]);

/** Where a read points at its list, or that it names its list some other way. */
type Aim = { target: string | undefined } | undefined;

/**
 * `parameters` with the read's list detected and named by the `extraction.N` the detection issued (header); unchanged
 * for any other node, a read that names its list another way, or one with no page to read. Throws a
 * `RecoverableToolRejection` for words no line shows and for a refusal the detection raised, which the run answers.
 */
export async function webListReadOwnDetection(run: WebNodeRun, nodeId: string, parameters: JsonObject, current: WebLlmSnapshotBinding | undefined): Promise<JsonObject> {
  // A client that declares no detection reads as before: a read names its list by a detected handle, or one element.
  if (nodeId !== LIST_NODE || current === undefined || !(run.gateway.structureDetectionSessionIds?.() ?? []).includes(run.sessionId)) return parameters;
  // A list named bare, `extractList: "tN"`, is named as `{handle: "tN"}` is.
  const written = parameters.extractList ?? {};
  const list = typeof written === "string" && canonicalWebLlmTargetHandle(written) !== undefined ? { handle: written } : written;
  if (!isJsonRecord(list)) return parameters;
  const aim = aimOf(list, current);
  if (aim === undefined) return parameters;
  // A handle no view or look of this page binds is the resolver's to refuse, with the reason it names (stale, unknown).
  const scope = { projectId: run.request.projectId, flowId: run.request.flowId };
  if (aim.target !== undefined && !run.stores.targets.resolve(scope, aim.target, current.evidence.location).ok) return parameters;
  let packet: WebLlmRepeatingStructure;
  try {
    const detected = await detectRepeatingStructure({
      gateway: run.gateway,
      sessionId: run.sessionId,
      request: { ...run.request, value: aim.target === undefined ? {} : { target: aim.target } },
      returned: current,
      targets: (handle, location) => run.stores.targets.resolve(scope, handle, location),
      handles: run.stores.extractions,
      restamp: run.restamp
    });
    packet = detected.evidence as unknown as WebLlmRepeatingStructure;
  } catch (error) {
    // No list anywhere on the page: an element named by its handle is read as itself (header).
    if (aim.target !== undefined && error instanceof RecoverableToolRejection && (error.code === "no_repeating_structure" || error.code === "sensitive_value")) return named(parameters, list, aim.target);
    throw error;
  }
  // The one record the element sits in, where the page sent it beside the list it found, is what was pointed at --
  // unless the element is a heading or the list's own name, which names the list under it (header).
  const record = aim.target !== undefined && packet.record !== undefined && !namesTheList(current, aim.target, packet) ? packet.record : undefined;
  return named(parameters, list, record?.handle ?? packet.extraction);
}

/** Whether the element `target` is a heading, or shows the words the page names the detected list by (`../../structure/list-name.ts`). */
function namesTheList(current: WebLlmSnapshotBinding, target: string, packet: WebLlmRepeatingStructure): boolean {
  const element = current.evidence.elements.find((candidate) => candidate.target === target);
  if (element === undefined) return false;
  if (/^h[1-6]$/u.test(element.tag.toLowerCase()) || (element.role ?? element.implicitRole) === "heading") return true;
  return packet.list !== undefined && folded(packet.list) === folded(element.readable ?? element.text ?? element.name ?? element.ownText ?? "");
}

/**
 * Where the read points at its list: an element, by its handle or by words a line of the page view shows, or nothing
 * for the page's largest list; `undefined` when the read names its list some other way (header).
 */
function aimOf(list: Record<string, unknown>, current: WebLlmSnapshotBinding): Aim {
  if (list.item !== undefined) return undefined;
  const handle = list.handle;
  if (handle !== undefined) {
    const target = canonicalWebLlmTargetHandle(handle);
    // An element read with only its own columns is its own one-row table (t903).
    if (target === undefined || onlyElementColumns(list.fields ?? list.columns)) return undefined;
    return { target };
  }
  // A list named inside its fields is the resolver's to read.
  if (fieldHandles(list.fields ?? list.columns)) return undefined;
  if (list.words === undefined) return { target: undefined };
  return { target: shownWith(list.words, current) };
}

/** Whether a field of the read names its list by a handle, as the resolver reads one (`../../plan-resolution/extraction/slot.ts`). */
function fieldHandles(fields: unknown): boolean {
  const named = Array.isArray(fields) ? fields : isJsonRecord(fields) ? Object.values(fields) : [];
  return named.some((entry) => isJsonRecord(entry) && Object.hasOwn(entry, "handle"));
}

/** Whether `fields` names columns and every one is a column an element offers as its own record. */
function onlyElementColumns(fields: unknown): boolean {
  const named = Array.isArray(fields) ? fields : isJsonRecord(fields) ? Object.values(fields) : [];
  return named.length > 0 && named.every((entry) => typeof entry === "string" && ELEMENT_COLUMNS.has(entry.split("@")[0]!));
}

/** The handle of the first line in page order whose words are `words`, else whose words hold them; refused when none does. */
function shownWith(words: unknown, current: WebLlmSnapshotBinding): string {
  const wanted = typeof words === "string" ? folded(words) : "";
  const lines = current.evidence.elements.map((element) => ({ target: element.target, words: folded(element.readable ?? element.text ?? element.name ?? element.ownText ?? "") }));
  const found = wanted === "" ? undefined : lines.find((line) => line.words === wanted) ?? lines.find((line) => line.words.includes(wanted));
  if (found !== undefined) return found.target;
  return recoverable("target_not_found", rejectionDetail({ reason: "list_not_on_page", target: undefined, instead: [webLlmListWords.code], missing: undefined, requestId: undefined }));
}

function folded(text: string): string {
  return text.replace(/\s+/gu, " ").trim().toLowerCase();
}

/** `parameters` with the read's list named by `handle`, in place of the element, words or nothing it was named by. */
function named(parameters: JsonObject, list: Record<string, unknown>, handle: string): JsonObject {
  const written: JsonObject = { handle };
  for (const [key, value] of Object.entries(list)) if (key !== "handle" && key !== "words" && key !== "location") written[key] = value as JsonObject[string];
  return { ...parameters, extractList: written };
}
