// Reading a gateway command's action parameters into the fields of
// `WebAutomationActionCommand`.
//
// The domain's action schemas (`actions/schemas.ts`) name and shape every
// structured parameter as the command field it becomes, and the verb that runs
// the action reads that field: `check.ts` reads `action.checked`, `assert.ts`
// `action.assert`, `upload.ts` `action.upload.files`, and the background
// readers in the extension's `runtime/command-options.ts` prefer the typed
// field over their raw-parameter fallback. So this is a validated copy, not a
// reshape, and one shape crosses the wire.
//
// Nothing here coerces. A value of the wrong shape is refused, which leaves the
// command field absent and the raw parameter still visible in `options`: the
// verb then refuses the command with its own message instead of acting on a
// half-formed request, and a reader that still understands the legacy flat form
// can use what arrived. A request is either well formed or it is not this
// action's request.

import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES,
  WEB_AUTOMATION_UPLOAD_MAX_TOTAL_BYTES,
  type WebAutomationActionCommand,
  type WebAutomationAssertKind,
  type WebAutomationAssertRequest,
  type WebAutomationDialogRequest,
  type WebAutomationDownloadRequest,
  type WebAutomationExtractListPagination,
  type WebAutomationExtractListRequest,
  type WebAutomationKeyModifiers,
  type WebAutomationOptionSelector,
  type WebAutomationScrollRequest,
  type WebAutomationTabRequest,
  type WebAutomationUploadFile,
  type WebAutomationUploadRequest,
  type WebAutomationWaitCondition,
  type WebAutomationWaitRequest
} from "../actions/types";

/** The command fields that come from a gateway command's `parameters` rather than from its target or envelope. */
export type WebAutomationLiftedActionParameters = Pick<
  WebAutomationActionCommand,
  "tabId" | "frameId" | "newTab" | "option" | "scroll" | "wait" | "modifiers" | "checked" | "assert" | "extractList" | "upload" | "dialog" | "tab" | "download"
>;

/**
 * Every parameter is read for every action type. The per-action schema already
 * governs what a Flow may author, and a verb reads only the field it runs on,
 * so keying this by action type would add a second place for the vocabulary to
 * drift from `actions/types.ts` without changing any outcome.
 */
export function webAutomationLiftedActionParameters(parameters: JsonObject): WebAutomationLiftedActionParameters {
  return {
    // Which tab and frame the action runs in, as opposed to the tab a
    // `web.browser.tab` operation acts on, which travels inside `tab`.
    tabId: nonNegativeInteger(parameters.browserTabId ?? parameters.tabId),
    frameId: nonNegativeInteger(parameters.browserFrameId ?? parameters.frameId),
    newTab: booleanValue(parameters.newTab),
    option: optionSelectorValue(parameters.option),
    scroll: scrollRequestValue(parameters.scroll),
    wait: waitRequestValue(parameters.wait),
    modifiers: keyModifiersValue(parameters.modifiers),
    checked: booleanValue(parameters.checked),
    assert: assertRequestValue(parameters.assert),
    extractList: extractListRequestValue(parameters.extractList),
    upload: uploadRequestValue(parameters.upload),
    dialog: dialogRequestValue(parameters.dialog),
    tab: tabRequestValue(parameters.tab),
    download: downloadRequestValue(parameters.download)
  };
}

/** `by` decides which field names the option, so a request naming none of them selects nothing. */
function optionSelectorValue(value: unknown): WebAutomationOptionSelector | undefined {
  const request = jsonObject(value);
  if (!request) return undefined;
  if (request.by === "value") {
    const optionValue = stringValue(request.value);
    return optionValue === undefined ? undefined : { by: "value", value: optionValue };
  }
  if (request.by === "label") {
    const label = stringValue(request.label);
    return label === undefined ? undefined : { by: "label", label };
  }
  const index = nonNegativeInteger(request.index);
  return request.by === "index" && index !== undefined ? { by: "index", index } : undefined;
}

/** `untilStable` keeps its required `maxScrolls`: without it the request is refused, never defaulted. */
function scrollRequestValue(value: unknown): WebAutomationScrollRequest | undefined {
  const request = jsonObject(value);
  const mode = memberOf(request?.mode, ["by", "toElement", "untilStable"] as const);
  if (!request || mode === undefined) return undefined;
  if (mode === "toElement") return { mode };
  const y = finiteNumber(request.y);
  if (mode === "by") {
    const x = finiteNumber(request.x);
    return { mode, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) };
  }
  const maxScrolls = positiveInteger(request.maxScrolls);
  return maxScrolls === undefined ? undefined : { mode, maxScrolls, ...(y !== undefined ? { y } : {}) };
}

function waitRequestValue(value: unknown): WebAutomationWaitRequest | undefined {
  const request = jsonObject(value);
  const condition = memberOf(request?.condition, WAIT_CONDITIONS);
  if (!request || condition === undefined) return undefined;
  const url = nonEmptyString(request.url);
  const stableForMs = positiveInteger(request.stableForMs);
  return { condition, ...(url !== undefined ? { url } : {}), ...(stableForMs !== undefined ? { stableForMs } : {}) };
}

/** Only the modifiers actually named are carried, so an absent one is never asserted to be up. */
function keyModifiersValue(value: unknown): WebAutomationKeyModifiers | undefined {
  const request = jsonObject(value);
  if (!request) return undefined;
  const modifiers: WebAutomationKeyModifiers = {
    ...(typeof request.alt === "boolean" ? { alt: request.alt } : {}),
    ...(typeof request.ctrl === "boolean" ? { ctrl: request.ctrl } : {}),
    ...(typeof request.meta === "boolean" ? { meta: request.meta } : {}),
    ...(typeof request.shift === "boolean" ? { shift: request.shift } : {})
  };
  return Object.keys(modifiers).length > 0 ? modifiers : undefined;
}

/** `expected` carries the text for `text` and the URL for `url`; an empty expectation is still an expectation. */
function assertRequestValue(value: unknown): WebAutomationAssertRequest | undefined {
  const request = jsonObject(value);
  const kind = memberOf(request?.kind, ASSERT_KINDS);
  if (!request || kind === undefined) return undefined;
  const expected = stringValue(request.expected);
  const timeoutMs = positiveInteger(request.timeoutMs);
  return { kind, ...(expected !== undefined ? { expected } : {}), ...(timeoutMs !== undefined ? { timeoutMs } : {}) };
}

/**
 * A list extraction needs both the item selector and the field map; a
 * `paginate` that is present but malformed refuses the whole request rather
 * than quietly reading one page of a request that asked for several.
 */
function extractListRequestValue(value: unknown): WebAutomationExtractListRequest | undefined {
  const request = jsonObject(value);
  const item = nonEmptyString(request?.item);
  const fields = fieldMapValue(request?.fields);
  if (!request || item === undefined || fields === undefined) return undefined;
  const paginate = request.paginate === undefined ? undefined : paginationValue(request.paginate);
  if (request.paginate !== undefined && paginate === undefined) return undefined;
  const maxItems = positiveInteger(request.maxItems);
  return { item, fields, ...(paginate !== undefined ? { paginate } : {}), ...(maxItems !== undefined ? { maxItems } : {}) };
}

/** Every field must name a selector: a map with one unusable entry would extract a column of nothing. */
function fieldMapValue(value: unknown): Record<string, string> | undefined {
  const fields = jsonObject(value);
  if (!fields) return undefined;
  const entries = Object.entries(fields);
  const named = entries.filter(([name, selector]) => name.length > 0 && nonEmptyString(selector) !== undefined) as [string, string][];
  return named.length > 0 && named.length === entries.length ? Object.fromEntries(named) : undefined;
}

/** `maxPages` is held to the domain's own bound, the one the page-side reader also applies, so no Flow pages forever. */
function paginationValue(value: unknown): WebAutomationExtractListPagination | undefined {
  const paginate = jsonObject(value);
  const next = nonEmptyString(paginate?.next);
  const maxPages = positiveInteger(paginate?.maxPages);
  if (next === undefined || maxPages === undefined) return undefined;
  return { next, maxPages: Math.min(maxPages, WEB_AUTOMATION_EXTRACT_MAX_PAGES) };
}

/**
 * The upload's own bounds, enforced here because the content script's
 * file-input backstop names this boundary as enforcing them. One malformed or
 * oversized file refuses the whole upload: dropping just that file would put a
 * different set of files on the page than the Flow asked for.
 */
function uploadRequestValue(value: unknown): WebAutomationUploadRequest | undefined {
  const request = jsonObject(value);
  const supplied = Array.isArray(request?.files) ? request.files : undefined;
  if (supplied === undefined || supplied.length === 0) return undefined;
  const files: WebAutomationUploadFile[] = [];
  let totalBytes = 0;
  for (const entry of supplied) {
    const file = jsonObject(entry);
    const name = nonEmptyString(file?.name);
    const mimeType = nonEmptyString(file?.mimeType);
    const contentBase64 = typeof file?.contentBase64 === "string" ? file.contentBase64 : undefined;
    if (name === undefined || mimeType === undefined || contentBase64 === undefined) return undefined;
    const bytes = base64ByteLength(contentBase64);
    if (bytes === undefined || bytes > WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES) return undefined;
    totalBytes += bytes;
    if (totalBytes > WEB_AUTOMATION_UPLOAD_MAX_TOTAL_BYTES) return undefined;
    files.push({ name, mimeType, contentBase64 });
  }
  return { files };
}

/** The decoded size of base64 content, without decoding it, or undefined when it is not base64 at all. */
function base64ByteLength(content: string): number | undefined {
  if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) return undefined;
  const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return (content.length / 4) * 3 - padding;
}

/** `promptText` answers a prompt, and only with `accept`; beside a dismissal it would answer nothing. */
function dialogRequestValue(value: unknown): WebAutomationDialogRequest | undefined {
  const request = jsonObject(value);
  const response = memberOf(request?.response, ["accept", "dismiss"] as const);
  if (!request || response === undefined) return undefined;
  const promptText = response === "accept" ? stringValue(request.promptText) : undefined;
  return { response, ...(promptText !== undefined ? { promptText } : {}) };
}

/** Each operation carries only its own fields, so a switch cannot arrive holding a URL to open. */
function tabRequestValue(value: unknown): WebAutomationTabRequest | undefined {
  const request = jsonObject(value);
  const operation = memberOf(request?.operation, ["open", "switch", "close"] as const);
  if (!request || operation === undefined) return undefined;
  const tabId = nonNegativeInteger(request.tabId);
  if (operation === "open") {
    const url = nonEmptyString(request.url);
    const active = booleanValue(request.active);
    return { operation, ...(url !== undefined ? { url } : {}), ...(active !== undefined ? { active } : {}) };
  }
  if (operation === "switch") {
    const urlPattern = nonEmptyString(request.urlPattern);
    return { operation, ...(tabId !== undefined ? { tabId } : {}), ...(urlPattern !== undefined ? { urlPattern } : {}) };
  }
  return { operation, ...(tabId !== undefined ? { tabId } : {}) };
}

/** Every field is optional: waiting for whichever download finishes next is a legitimate request. */
function downloadRequestValue(value: unknown): WebAutomationDownloadRequest | undefined {
  const request = jsonObject(value);
  if (!request) return undefined;
  const filename = nonEmptyString(request.filename);
  const timeoutMs = positiveInteger(request.timeoutMs);
  return { ...(filename !== undefined ? { filename } : {}), ...(timeoutMs !== undefined ? { timeoutMs } : {}) };
}

const WAIT_CONDITIONS: readonly WebAutomationWaitCondition[] = ["present", "visible", "enabled", "absent", "url", "stable"];
const ASSERT_KINDS: readonly WebAutomationAssertKind[] = ["exists", "absent", "text", "url", "visible", "enabled"];

// The value readers. `0` is meaningful as a frame id and as an option index,
// but never as a count or a duration; an option's value may be empty where a
// selector, URL, or file name may not.

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function memberOf<T extends string>(value: unknown, members: readonly T[]): T | undefined {
  return typeof value === "string" && (members as readonly string[]).includes(value) ? value as T : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
