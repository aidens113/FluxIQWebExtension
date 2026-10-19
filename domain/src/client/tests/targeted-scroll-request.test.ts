// A scroll step that names a target and gives no mode scrolls to that target.
//
// Breadth round (codex social, revisions 1 and 3): `web.dom.scroll` was authored
// with only a target and no `scroll` request. With no request the extension's
// verb made the legacy absolute move to `options.x`/`options.y` and never
// resolved the target, yet reported `succeeded` under the target's name. The
// mapping now reads that step as the existing `toElement` mode, so the verb
// resolves the target and an unresolved target fails like any other target.
// Explicit modes, and scrolls that name no target, are unchanged.

import assert from "node:assert/strict";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionCommand, WebAutomationActionType } from "../../actions/types";
import { webAutomationActionFromGatewayCommand } from "../gateway-mapping";

function mapped(actionType: WebAutomationActionType, parameters: JsonObject, target?: JsonObject): WebAutomationActionCommand {
  const command = webAutomationActionFromGatewayCommand({
    commandId: `command.${actionType}`,
    actionType,
    parameters,
    ...(target !== undefined ? { target } : {})
  });
  assert.equal("status" in command, false, `${actionType} was rejected`);
  return command as WebAutomationActionCommand;
}

const recordedElement = { tagName: "div", text: "You're all caught up", role: "status" };

// -- A target and no mode: scroll to that element ------------------------------
assert.deepEqual(mapped("web.dom.scroll", {}, { selector: "#feed-end" }).scroll, { mode: "toElement" }, "a wire target selector with no mode scrolls to it");
assert.deepEqual(mapped("web.dom.scroll", { selector: "#feed-end" }).scroll, { mode: "toElement" }, "a parameter selector with no mode scrolls to it");
assert.deepEqual(mapped("web.dom.scroll", {}, { element: recordedElement }).scroll, { mode: "toElement" }, "a recorded element with no mode scrolls to it");
// Core writes the node's `x: 0`/`y: 0` defaults on every scroll step, so their
// presence says nothing: the named target still decides.
const withDefaults = mapped("web.dom.scroll", { x: 0, y: 0 }, { selector: "#feed-end" });
assert.deepEqual(withDefaults.scroll, { mode: "toElement" }, "Core's x/y defaults do not turn a targeted scroll into a jump to the top");
assert.deepEqual(withDefaults.options, { x: 0, y: 0 }, "the raw parameters still travel unchanged in options");
assert.equal(withDefaults.selector, "#feed-end");

// -- Explicit modes are unchanged ----------------------------------------------
assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "by", y: 640 } }, { selector: "#feed" }).scroll, { mode: "by", y: 640 }, "an explicit by keeps its delta beside a target");
assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "untilStable", maxScrolls: 12 } }, { selector: "#feed" }).scroll, { mode: "untilStable", maxScrolls: 12 });
assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "toElement" } }, { selector: "#feed-end" }).scroll, { mode: "toElement" });
assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "by", y: 640 } }).scroll, { mode: "by", y: 640 });
// A request that was sent and could not be read stays refused: it is not read
// as "no mode" and turned into a scroll to the target, because it asked for
// something else (the verb refuses it from `options.scroll`).
const unreadable = mapped("web.dom.scroll", { scroll: { until: "stopsGrowing" } }, { selector: "#feed-end" });
assert.equal(unreadable.scroll, undefined, "an unreadable request is not reinterpreted as a targeted scroll");
assert.deepEqual(unreadable.options, { scroll: { until: "stopsGrowing" } });
assert.equal(mapped("web.dom.scroll", { scroll: { mode: "down" } }, { selector: "#feed-end" }).scroll, undefined);

// -- No target is unchanged: the legacy absolute move ----------------------------
assert.equal(mapped("web.dom.scroll", { x: 0, y: 640 }).scroll, undefined, "no target and no mode stays the legacy absolute move");
assert.equal(mapped("web.dom.scroll", {}, { coordinates: { x: 0, y: 900 } }).scroll, undefined, "a point is a position to move to, not an element to resolve");

// -- Other actions are untouched ------------------------------------------------
assert.equal(mapped("web.dom.click", {}, { selector: "#go" }).scroll, undefined, "only web.dom.scroll reads a target as a scroll");
