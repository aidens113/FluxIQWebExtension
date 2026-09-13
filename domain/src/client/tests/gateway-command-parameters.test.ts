// T1 coverage of the Wave 2 parameter lift: every structured parameter the
// action schemas define arrives on the field of `WebAutomationActionCommand`
// that the verb running it reads. A malformed one is refused rather than
// coerced into a request the page would then act on: an optional field is left
// absent, and a field the action requires refuses the whole command.

import assert from "node:assert/strict";
import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_ACTION_TYPES,
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES,
  type WebAutomationActionCommand,
  type WebAutomationActionType
} from "../../actions/types";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../runtime/failure";
import { webAutomationActionFromGatewayCommand, type WebAutomationActionRejection } from "../gateway-mapping";

/** The mapped command, with the rejection branch ruled out so a field read below cannot be silently undefined. */
function mapped(actionType: WebAutomationActionType, parameters: JsonObject, extra: { target?: JsonObject; timeoutMs?: number } = {}): WebAutomationActionCommand {
  const command = webAutomationActionFromGatewayCommand({
    commandId: `command.${actionType}`,
    actionType,
    parameters,
    ...(extra.target !== undefined ? { target: extra.target } : {}),
    ...(extra.timeoutMs !== undefined ? { timeoutMs: extra.timeoutMs } : {})
  });
  assert.equal("status" in command, false, `${actionType} was rejected`);
  return command as WebAutomationActionCommand;
}

/**
 * The command is refused whole because a field its action requires could not
 * be read: the closed set's `INVALID_PARAMETER`, with a message that names the
 * action and the fields and nothing that was sent in them.
 */
function refusedWhole(actionType: WebAutomationActionType, parameters: JsonObject, fields: string[], why: string): void {
  const command = webAutomationActionFromGatewayCommand({ commandId: `command.${actionType}`, actionType, parameters });
  assert.equal("status" in command, true, `${actionType} was dispatched: ${why}`);
  const rejection = command as WebAutomationActionRejection;
  assert.equal(rejection.failure.code, WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, why);
  assert.equal(rejection.message, `Not dispatched: ${actionType} requires ${fields.join(", ")}, and what was sent could not be read.`, why);
}

/** Base64 whose decoded size is exactly `bytes`, without building the bytes themselves. Multiples of 3 need no padding. */
function base64OfBytes(bytes: number): string {
  return "A".repeat((bytes / 3) * 4);
}

// -- The tab and frame an action runs in -------------------------------------
// `command-options.ts` reads `action.tabId`/`action.frameId` first and falls
// back to the raw `browserTabId`/`browserFrameId` parameters, so the lift has
// to answer both names. `0` is the top frame and must survive the lift.
assert.equal(mapped("web.dom.click", { browserTabId: 12, browserFrameId: 3, selector: "#go" }).tabId, 12);
assert.equal(mapped("web.dom.click", { browserTabId: 12, browserFrameId: 3, selector: "#go" }).frameId, 3);
assert.equal(mapped("web.dom.click", { tabId: 7, frameId: 0, selector: "#go" }).tabId, 7);
assert.equal(mapped("web.dom.click", { tabId: 7, frameId: 0, selector: "#go" }).frameId, 0, "frame 0 is the top frame, not an absent frame");
assert.equal(mapped("web.dom.click", { browserTabId: -1, browserFrameId: 1.5, selector: "#go" }).tabId, undefined);
assert.equal(mapped("web.dom.click", { browserTabId: -1, browserFrameId: 1.5, selector: "#go" }).frameId, undefined);
assert.equal(mapped("web.dom.click", { selector: "#go" }).tabId, undefined);

// -- navigate `newTab` --------------------------------------------------------
assert.equal(mapped("web.browser.navigate", { url: "https://example.test", newTab: true }).newTab, true);
assert.equal(mapped("web.browser.navigate", { url: "https://example.test", newTab: false }).newTab, false, "an explicit false is a decision, not an absence");
assert.equal(mapped("web.browser.navigate", { url: "https://example.test" }).newTab, undefined);
assert.equal(mapped("web.browser.navigate", { url: "https://example.test", newTab: "yes" }).newTab, undefined);

// -- `web.dom.check`: the state to leave the control in -----------------------
// `check.ts` reads `action.checked` and treats an absent one as "check it", so
// a `false` that failed to arrive would invert the step.
assert.equal(mapped("web.dom.check", { selector: "#terms", checked: false }).checked, false);
assert.equal(mapped("web.dom.check", { selector: "#terms", checked: true }).checked, true);
assert.equal(mapped("web.dom.check", { selector: "#terms", checked: "false" }).checked, undefined);

// -- `web.dom.assert`: kind, expected, timeout --------------------------------
assert.deepEqual(mapped("web.dom.assert", { assert: { kind: "text", expected: "Saved", timeoutMs: 2_000 } }).assert, { kind: "text", expected: "Saved", timeoutMs: 2_000 });
assert.deepEqual(mapped("web.dom.assert", { assert: { kind: "visible" } }).assert, { kind: "visible" });
for (const kind of ["exists", "absent", "text", "url", "visible", "enabled"]) {
  assert.deepEqual(mapped("web.dom.assert", { assert: { kind } }).assert, { kind }, kind);
}
refusedWhole("web.dom.assert", { assert: { kind: "contains" } }, ["assert"], "an unknown kind is no assertion");
refusedWhole("web.dom.assert", { assert: { expected: "Saved" } }, ["assert"], "an assertion with no kind claims nothing");
assert.equal(mapped("web.dom.assert", { assert: { kind: "text", expected: "Saved", timeoutMs: 0 } }).assert?.timeoutMs, undefined, "a zero timeout is not a timeout");

// -- `web.dom.extract_list`: item, fields, pagination, maxItems ---------------
assert.deepEqual(mapped("web.dom.extract_list", {
  extractList: { item: "tr.row", fields: { name: "td.name", href: "a@href", price: "column:Price" }, paginate: { next: "a.next", maxPages: 3 }, maxItems: 40 }
}).extractList, { item: "tr.row", fields: { name: "td.name", href: "a@href", price: "column:Price" }, paginate: { next: "a.next", maxPages: 3 }, maxItems: 40 });
assert.deepEqual(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" } } }).extractList, { item: "li", fields: { title: "h3" } });
// The domain's own page bound, the same one the page-side reader applies.
assert.equal(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, paginate: { next: "a.next", maxPages: 5_000 } } }).extractList?.paginate?.maxPages, WEB_AUTOMATION_EXTRACT_MAX_PAGES);
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: {} } }, ["extractList"], "no fields extracts nothing");
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "" } } }, ["extractList"], "a field naming no selector would extract a column of nothing");
refusedWhole("web.dom.extract_list", { extractList: { fields: { title: "h3" } } }, ["extractList"], "no item selector selects no records");
// A paginate that is present but unusable refuses the whole request rather than
// quietly reading page one of a request that asked for several.
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, paginate: { maxPages: 3 } } }, ["extractList"], "a paginate with no next link");

// -- `web.dom.upload`: name, MIME type, bounded base64 ------------------------
assert.deepEqual(mapped("web.dom.upload", { selector: "input[type=file]", upload: { files: [{ name: "a.txt", mimeType: "text/plain", contentBase64: "aGk=" }] } }).upload, {
  files: [{ name: "a.txt", mimeType: "text/plain", contentBase64: "aGk=" }]
});
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [] } }, ["upload"], "an upload of no files");
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [{ name: "a.txt", mimeType: "text/plain" }] } }, ["upload"], "a file with no content is not a file");
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [{ name: "a.txt", mimeType: "text/plain", contentBase64: "not base64!" }] } }, ["upload"], "content that is not base64");
// One oversized file refuses the whole upload: dropping just that file would
// put a different set of files on the page than the Flow asked for.
const oversized = base64OfBytes(WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES + 2);
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [{ name: "big.bin", mimeType: "application/octet-stream", contentBase64: oversized }] } }, ["upload"], "a file past the per-file bound");
const nearLimit = { name: "part.bin", mimeType: "application/octet-stream", contentBase64: base64OfBytes(1_048_575) };
assert.equal(mapped("web.dom.upload", { selector: "#f", upload: { files: [nearLimit] } }).upload?.files.length, 1, "a file inside the per-file bound is carried");
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [nearLimit, nearLimit, nearLimit, nearLimit, nearLimit] } }, ["upload"], "five near-limit files exceed the total bound");

// -- `web.dom.dialog`: accept, dismiss, prompt text ---------------------------
assert.deepEqual(mapped("web.dom.dialog", { dialog: { response: "accept", promptText: "Ada" } }).dialog, { response: "accept", promptText: "Ada" });
assert.deepEqual(mapped("web.dom.dialog", { dialog: { response: "dismiss" } }).dialog, { response: "dismiss" });
assert.deepEqual(mapped("web.dom.dialog", { dialog: { response: "dismiss", promptText: "Ada" } }).dialog, { response: "dismiss" }, "a dismissal answers nothing, so it carries no reply");
refusedWhole("web.dom.dialog", { dialog: { response: "ignore" } }, ["dialog"], "a response that is neither accept nor dismiss");
assert.equal(mapped("web.dom.dialog", {}).dialog, undefined, "an absent field is not a refused one: the verb still decides what an empty request means");

// -- `web.browser.tab`: open, switch, close -----------------------------------
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "open", url: "https://example.test/report", active: true } }).tab, { operation: "open", url: "https://example.test/report", active: true });
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "switch", urlPattern: "/report" } }).tab, { operation: "switch", urlPattern: "/report" });
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "switch", tabId: 9 } }).tab, { operation: "switch", tabId: 9 });
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "close", tabId: 9 } }).tab, { operation: "close", tabId: 9 });
// Each operation carries only its own fields, so a switch cannot arrive holding a URL to open.
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "close", url: "https://example.test", active: true, tabId: 4 } }).tab, { operation: "close", tabId: 4 });
refusedWhole("web.browser.tab", { tab: { operation: "reload" } }, ["tab"], "an operation that is not open, switch or close");
// The tab an operation acts on stays inside `tab`; it is not the tab the action runs in.
assert.equal(mapped("web.browser.tab", { tab: { operation: "close", tabId: 9 } }).tabId, undefined);

// -- `web.browser.download`: filename and timeout -----------------------------
assert.deepEqual(mapped("web.browser.download", { download: { filename: "report.csv", timeoutMs: 30_000 } }).download, { filename: "report.csv", timeoutMs: 30_000 });
assert.deepEqual(mapped("web.browser.download", { download: {} }).download, {}, "waiting for whichever download finishes next is a request");
assert.equal(mapped("web.browser.download", {}).download, undefined);

// -- The parameters the eleven older actions gained ---------------------------
assert.deepEqual(mapped("web.dom.select", { selector: "#country", option: { by: "label", label: "Ireland" } }).option, { by: "label", label: "Ireland" });
assert.deepEqual(mapped("web.dom.select", { selector: "#country", option: { by: "index", index: 0 } }).option, { by: "index", index: 0 }, "the first option is index 0");
assert.deepEqual(mapped("web.dom.select", { selector: "#country", option: { by: "value", value: "" } }).option, { by: "value", value: "" }, "an option's value may legitimately be empty");
assert.equal(mapped("web.dom.select", { selector: "#country", option: { by: "label" } }).option, undefined);
assert.equal(mapped("web.dom.select", { selector: "#country", option: { label: "Ireland" } }).option, undefined, "without `by`, nothing says how to match");

assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "by", y: 640 } }).scroll, { mode: "by", y: 640 });
assert.deepEqual(mapped("web.dom.scroll", { selector: "#row-40", scroll: { mode: "toElement" } }).scroll, { mode: "toElement" });
assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "untilStable", maxScrolls: 12, y: 800 } }).scroll, { mode: "untilStable", maxScrolls: 12, y: 800 });
assert.equal(mapped("web.dom.scroll", { scroll: { mode: "untilStable" } }).scroll, undefined, "untilStable without maxScrolls would scroll forever");
assert.equal(mapped("web.dom.scroll", { scroll: { mode: "down" } }).scroll, undefined);

assert.deepEqual(mapped("web.dom.wait_for_selector", { selector: "#row", wait: { condition: "visible" } }).wait, { condition: "visible" });
assert.deepEqual(mapped("web.dom.wait_for_selector", { selector: "#row", wait: { condition: "url", url: "https://example.test/done" } }).wait, { condition: "url", url: "https://example.test/done" });
assert.deepEqual(mapped("web.dom.wait_for_text", { text: "Saved", wait: { condition: "stable", stableForMs: 500 } }).wait, { condition: "stable", stableForMs: 500 });
assert.equal(mapped("web.dom.wait_for_selector", { selector: "#row", wait: { condition: "settled" } }).wait, undefined);

assert.deepEqual(mapped("web.dom.keypress", { key: "Enter", modifiers: { ctrl: true, shift: false } }).modifiers, { ctrl: true, shift: false });
assert.equal(mapped("web.dom.keypress", { key: "Enter", modifiers: {} }).modifiers, undefined, "a modifier set naming nothing is no modifier set");
assert.deepEqual(mapped("web.dom.keypress", { key: "Enter", modifiers: { alt: true, meta: "yes" } }).modifiers, { alt: true }, "only the modifiers actually named are carried");

// -- What the lift must not disturb ------------------------------------------
// The raw parameters still travel in `options`: the background readers fall
// back to them, and a refused optional value has to remain visible to the verb.
const withBadScroll = mapped("web.dom.scroll", { scroll: { mode: "down" } });
assert.equal(withBadScroll.scroll, undefined);
assert.deepEqual(withBadScroll.options, { scroll: { mode: "down" } }, "a refused optional value stays in options rather than vanishing");

// The flat fields the mapping already lifted are unchanged, and a legacy dotted
// type still resolves, so nothing above changed the pre-Wave-2 contract.
assert.deepEqual(webAutomationActionFromGatewayCommand({ commandId: "command.type", actionType: "dom.type", target: { selector: "input[name=q]" }, parameters: { text: "ada" } }), {
  commandId: "command.type",
  actionType: "web.dom.type",
  selector: "input[name=q]",
  text: "ada",
  options: { text: "ada" }
});
// A command with no parameters at all gains no lifted field.
assert.deepEqual(webAutomationActionFromGatewayCommand({ commandId: "command.snapshot", actionType: "web.dom.capture_snapshot" }), {
  commandId: "command.snapshot",
  actionType: "web.dom.capture_snapshot",
  options: {}
});

// -- Which refusals refuse the whole command ---------------------------------
// A refused field refuses the command only when the action's schema requires
// it. Every parameter name the lift reads is sent unreadable to every action
// type, and the pairs refused whole must be exactly these five, so a schema
// that starts or stops requiring a lifted field shows up here, not on a page.
const LIFTED_PARAMETER_NAMES = ["browserTabId", "tabId", "browserFrameId", "frameId", "newTab", "option", "scroll", "wait", "modifiers", "checked", "assert", "extractList", "upload", "dialog", "tab", "download"];
const refusedPairs = WEB_AUTOMATION_ACTION_TYPES.flatMap((actionType) => LIFTED_PARAMETER_NAMES
  .filter((name) => "status" in webAutomationActionFromGatewayCommand({ commandId: "command.matrix", actionType, parameters: { [name]: "unreadable" } }))
  .map((name) => `${actionType} ${name}`));
assert.deepEqual(refusedPairs.sort(), ["web.browser.tab tab", "web.dom.assert assert", "web.dom.dialog dialog", "web.dom.extract_list extractList", "web.dom.upload upload"]);

console.log("Web automation gateway command parameter tests passed.");
