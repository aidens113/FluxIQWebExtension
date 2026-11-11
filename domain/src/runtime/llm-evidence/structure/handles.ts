// What an opaque extraction handle stands for, kept where the model cannot
// reach it.
//
// The detection tool gives the model `extraction.N` and nothing else it could
// address the page by. The item selector, the field specs and the pagination
// that handle names are held here, the way `tools.ts` holds the selector behind
// every `tN`, so a later step can turn a plan that names the handle into
// the real `web.dom.extract_list` request, or the `web.dom.next_page` request
// that moves the same list on by one page. Those steps read through
// `resolveExtractionHandle` and nothing else.
//
// A handle belongs to the project and Flow it was issued for. Asked for from
// any other, it is `unknown_handle` -- the same answer as a handle that was
// never issued, so one Flow's authoring cannot learn that another's exists.
// The store is bounded: past `RETAINED_EXTRACTION_HANDLES` the oldest handle is
// let go, and asking for it afterwards is `stale_handle`, so a caller can tell
// "detect it again" from "that was never a handle".
//
// `issuedFor` answers whether a project and Flow was shown a detected list at
// all, kept or let go, so the plan resolver can tell a literal extraction the
// model wrote with a detected list in hand -- a guess -- from one it wrote
// before any detection. It forgets a let-go handle once the stale memory does.
//
// `ownList` answers the question that rule has to ask second: whether a literal
// is not a guess at all, but the Flow's own list written down resolved. A Flow
// keeps the resolved request, not the handle, so a step read back out of it --
// the re-author's draft (`AS/runtime/llm/node-tools/draft-from-flow.ts`) -- is a
// literal whose item is a detected list's item. What a list answers to is kept
// by item selector and frame, for as long as the scope's lists are remembered
// rather than as long as one handle is: each detected column under its detected
// key, and each column under every key a plan wrote it under (`wrote`), because
// the Flow keeps the plan's keys and the draft shows the model those.
//
// One detection can issue two handles: the list it found, and beside it the one
// record the model aimed at, read as a one-row table (`./packet.ts`). Each is
// an ordinary handle here, retained in the same scope, so the record's item is
// an "own" list exactly as the run's item is.
//
// **One element is a list of one record too (t903).** A read may name one
// element by the `tN` the page view or a search printed, and read it as a
// one-row table (`../plan-resolution/extraction/element-record.ts`). That
// element's list is issued here as any detected one is (`elementRecord`): the
// same element read twice is the same handle, so repeated reads do not let go
// of the lists detection found, and the step that ran keeps the handle and what
// it stands for, never the `tN` (`elementRecordOf`).
//
// This store is for one authoring session. A step that is saved keeps what its
// handle stands for itself (`../plan-resolution/extraction/saved-list.ts`, t869),
// so a later attempt, another Flow or a restarted process does not depend on it.

import type { WebAutomationExtractField, WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webAutomationExtractListKey } from "../../../output-nodes";
import { present } from "../present";

/** How many handles are retained at once. A convenience for one authoring session, not a store. */
export const RETAINED_EXTRACTION_HANDLES = 16;

/** How many let-go handles are remembered as stale before they read as unknown. Names only, never a request. */
const REMEMBERED_STALE_HANDLES = 256;

/** The only shape a handle has. Positional, like `tN`, and meaningless without this store. */
export const WEB_LLM_EXTRACTION_HANDLE_PATTERN = "^extraction\\.[1-9][0-9]{0,8}$";

const HANDLE_PATTERN = new RegExp(WEB_LLM_EXTRACTION_HANDLE_PATTERN, "u");

/** Which authoring a handle belongs to: the project and Flow of the call that issued it. */
export type WebLlmExtractionHandleScope = {
  projectId: string;
  flowId: string;
};

/**
 * Everything a handle stands for. Selectors live here and only here: this
 * never reaches the model, and a resolver copies what it needs into the node
 * it writes.
 */
export type WebLlmExtractionBinding = {
  handle: string;
  /** The page the structure was detected on, as the evidence packet names it: origin and path. */
  location: string;
  /** The child frame the structure is in; absent for the top frame. A Flow node carries it as `browserFrameId`. */
  frameId?: number;
  /**
   * For a list in a child frame, the pathname of that frame's document when
   * the list was detected (`./detect.ts`). A Flow node carries it as
   * `browserFrameUrlPath`, which finds the frame again once a reload has
   * renumbered it. Absent for the top frame, and for a frame whose address was
   * not known.
   */
  frameUrlPath?: string;
  /**
   * The `web.dom.extract_list` request the handle names: the item selector,
   * every field the model was shown under the key it was shown, and how the
   * list continues (`paginate`, as detected). No sensitive field is in it,
   * and no timeout.
   *
   * `paginate` is kept for Next page, never for the read: a resolved read
   * reads the page shown and carries none (`plan-resolution/extraction/slot.ts`),
   * and a Next page step naming this handle reads its way to the next page
   * from it, without its bound (`plan-resolution/next-page-slot.ts`).
   */
  extractList: WebAutomationExtractListRequest;
  /** How many items the structure held when it was detected. */
  itemCount: number;
  /**
   * Set when the handle names one record: the record beside a run, a label/value
   * receipt, or a lone record where nothing repeats (`./packet.ts`). A plan that
   * names it reads at most one row (`plan-resolution/extraction/slot.ts`): two
   * rows from what the model chose as one record are wrong, even when a second
   * card that looks the same appears later (supervisor, 2026-10-01).
   */
  oneRecord?: true;
};

/**
 * A binding as a detection retains it: the binding, and the container the
 * detection found the list in when it named one. The container is part of the
 * list's identity (`webLlmExtractionListKey`) with the item selector and the
 * frame, and is kept beside the binding rather than in it, so a binding written
 * where no container is known stays complete as it is.
 */
export type WebLlmExtractionBindingRetained = WebLlmExtractionBinding & { container?: string; listKey?: string };

/**
 * A binding as it resolves: with the key of the list it names, which two
 * detections of one redrawn list share and two lists do not. Made when the
 * binding is retained, never read from the model, a handle or a row; a read of
 * the list carries it on its answer (invariant I3).
 */
export type WebLlmExtractionBindingKeyed = WebLlmExtractionBinding & { container?: string; listKey: string };

export type WebLlmExtractionHandleResolution =
  | { ok: true; binding: WebLlmExtractionBindingKeyed }
  | { ok: false; code: "unknown_handle" | "stale_handle" };

/** The per-runtime store. `reserve` names a handle before its packet is sized; `retain` binds it once the packet is final. */
export type WebLlmExtractionHandles = {
  reserve(): string;
  /** A handle a saved step names, perhaps from before a restart: `reserve` never issues its number, so it cannot come to name another list. */
  saw(handle: string): void;
  retain(scope: WebLlmExtractionHandleScope, binding: WebLlmExtractionBindingRetained): void;
  resolve(scope: WebLlmExtractionHandleScope, handle: unknown): WebLlmExtractionHandleResolution;
  /** Whether any handle this store still knows of, kept or let go, was issued for this project and Flow. */
  issuedFor(scope: WebLlmExtractionHandleScope): boolean;
  /** That a plan of this project and Flow wrote a handle's list into a step as `request`, in `frameId`. */
  wrote(scope: WebLlmExtractionHandleScope, request: WebAutomationExtractListRequest, frameId: number | undefined): void;
  /**
   * What a list this project and Flow was shown answers to, by its item
   * selector and frame (`undefined` for the top one): each field under every key
   * it was detected or written under. Nothing when no list here reads from that
   * item, which is the answer for every literal a model wrote itself.
   */
  ownList(scope: WebLlmExtractionHandleScope, item: string, frameId: number | undefined): Record<string, WebAutomationExtractField> | undefined;
  /**
   * The handle of the one-record list that reads one element (header): the
   * handle already retained for exactly this binding in this scope, else a new
   * one. Remembered as the list `named`, the element's target handle, stands
   * for now.
   */
  elementRecord(scope: WebLlmExtractionHandleScope, named: string, binding: Omit<WebLlmExtractionBinding, "handle">): string;
  /** The list `elementRecord` last issued for the target handle `named` in this scope, while it is retained. */
  elementRecordOf(scope: WebLlmExtractionHandleScope, named: string): string | undefined;
};

/** How many (project, Flow, frame, item) lists are remembered, and how many keys one list keeps; also how many element records are remembered by the target handle that named them. */
const REMEMBERED_LISTS = 64;
const REMEMBERED_LIST_KEYS = 64;

export function createWebLlmExtractionHandles(): WebLlmExtractionHandles {
  let reserved = 0;
  const retained = new Map<string, { scope: string; binding: WebLlmExtractionBindingKeyed }>();
  const letGo = new Map<string, string>();
  const lists = new Map<string, Map<string, WebAutomationExtractField>>();
  const records = new Map<string, string>();
  const listSlot = (scope: WebLlmExtractionHandleScope, item: string, frameId: number | undefined): string => `${scopeKey(scope)}\0${frameId ?? 0}\0${item}`;
  const answersTo = (key: string, fields: Record<string, WebAutomationExtractField>): void => {
    const list = lists.get(key) ?? new Map<string, WebAutomationExtractField>();
    lists.delete(key);
    lists.set(key, list);
    for (const [name, field] of Object.entries(fields)) {
      list.delete(name);
      list.set(name, structuredClone(field));
    }
    for (const oldest of list.keys()) {
      if (list.size <= REMEMBERED_LIST_KEYS) break;
      list.delete(oldest);
    }
    for (const oldest of lists.keys()) {
      if (lists.size <= REMEMBERED_LISTS) break;
      lists.delete(oldest);
    }
  };
  const forget = (handle: string, scope: string): void => {
    retained.delete(handle);
    letGo.set(handle, scope);
    for (const oldest of letGo.keys()) {
      if (letGo.size <= REMEMBERED_STALE_HANDLES) break;
      letGo.delete(oldest);
    }
  };
  const store: WebLlmExtractionHandles = {
    reserve() {
      reserved += 1;
      return `extraction.${reserved}`;
    },
    saw(handle) {
      if (!HANDLE_PATTERN.test(handle)) return;
      reserved = Math.max(reserved, Number(handle.slice(handle.indexOf(".") + 1)));
    },
    retain(scope, binding) {
      if (!HANDLE_PATTERN.test(binding.handle) || retained.has(binding.handle)) throw new Error("extraction handle was not reserved for this binding");
      retained.set(binding.handle, { scope: scopeKey(scope), binding: copyBinding(binding) });
      answersTo(listSlot(scope, binding.extractList.item, binding.frameId), binding.extractList.fields);
      for (const [oldest, entry] of retained) {
        if (retained.size <= RETAINED_EXTRACTION_HANDLES) break;
        forget(oldest, entry.scope);
      }
    },
    resolve(scope, handle) {
      if (typeof handle !== "string" || !HANDLE_PATTERN.test(handle)) return { ok: false, code: "unknown_handle" };
      const key = scopeKey(scope);
      const entry = retained.get(handle);
      if (entry?.scope === key) return { ok: true, binding: copyBinding(entry.binding) };
      return letGo.get(handle) === key ? { ok: false, code: "stale_handle" } : { ok: false, code: "unknown_handle" };
    },
    issuedFor(scope) {
      const key = scopeKey(scope);
      return [...retained.values()].some((entry) => entry.scope === key) || [...letGo.values()].includes(key);
    },
    wrote(scope, request, frameId) {
      answersTo(listSlot(scope, request.item, frameId), request.fields);
    },
    ownList(scope, item, frameId) {
      const list = lists.get(listSlot(scope, item, frameId));
      return list === undefined ? undefined : structuredClone(Object.fromEntries(list));
    },
    elementRecord(scope, named, binding) {
      const key = scopeKey(scope);
      const wanted = JSON.stringify(withoutHandle(binding));
      const held = [...retained.values()].find((entry) => entry.scope === key && JSON.stringify(withoutHandle(entry.binding)) === wanted);
      const handle = held?.binding.handle ?? store.reserve();
      if (held === undefined) store.retain(scope, { ...binding, handle });
      const recordKey = `${key}\0${named}`;
      records.delete(recordKey);
      records.set(recordKey, handle);
      for (const oldest of records.keys()) {
        if (records.size <= REMEMBERED_LISTS) break;
        records.delete(oldest);
      }
      return handle;
    },
    elementRecordOf(scope, named) {
      const key = scopeKey(scope);
      const handle = records.get(`${key}\0${named}`);
      return handle !== undefined && retained.get(handle)?.scope === key ? handle : undefined;
    }
  };
  return store;
}

/** A binding's meaning without its name, which two handles for one element record share. */
function withoutHandle(binding: Omit<WebLlmExtractionBinding, "handle">): Omit<WebLlmExtractionBinding, "handle"> {
  return present<Omit<WebLlmExtractionBinding, "handle">>({
    location: binding.location,
    frameId: binding.frameId,
    frameUrlPath: binding.frameUrlPath,
    extractList: binding.extractList,
    itemCount: binding.itemCount,
    oneRecord: binding.oneRecord
  });
}

function scopeKey(scope: WebLlmExtractionHandleScope): string {
  return `${scope.projectId}\0${scope.flowId}`;
}

/** A copy, so neither the tool that bound it nor the resolver that reads it can change what the handle means; keyed. */
function copyBinding(binding: WebLlmExtractionBindingRetained): WebLlmExtractionBindingKeyed {
  return present<WebLlmExtractionBindingKeyed>({
    handle: binding.handle,
    location: binding.location,
    frameId: binding.frameId,
    frameUrlPath: binding.frameUrlPath,
    extractList: structuredClone(binding.extractList),
    itemCount: binding.itemCount,
    oneRecord: binding.oneRecord,
    container: binding.container,
    listKey: binding.listKey ?? webLlmExtractionListKey(binding)
  });
}

/**
 * The key of the list a binding names: a stable digest of its item selector,
 * container and frame path (`output-nodes/extract-list/list-key.ts`). Two
 * detections of one list that redrew between them give one key, two different
 * lists give two, and a list in another frame is another list.
 */
export function webLlmExtractionListKey(binding: Pick<WebLlmExtractionBindingRetained, "extractList" | "container" | "frameId" | "frameUrlPath">): string {
  return webAutomationExtractListKey({ item: binding.extractList.item, container: binding.container, frameId: binding.frameId, frameUrlPath: binding.frameUrlPath });
}
