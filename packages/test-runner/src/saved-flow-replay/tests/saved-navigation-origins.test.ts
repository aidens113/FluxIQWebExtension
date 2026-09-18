import assert from "node:assert/strict";
import test from "node:test";
import type { FlowNodeRecord } from "../../flow-lane/index.js";
import { savedNavigationOrigins } from "../saved-navigation-origins.js";

const node = (id: string, parameterValues: Record<string, unknown> | undefined): FlowNodeRecord => ({ id, parameterValues });

test("reads the origin of each navigate node, flat or nested, once each and in node order", () => {
  const nodes = [
    node("s1", { url: "http://127.0.0.1:61538/scenarios/social-scheduler/?view=queue" }),
    node("s2", { selector: "testid:account" }),
    node("s3", { parameters: { url: "http://127.0.0.1:61538/scenarios/social-scheduler/next" } }),
    node("s4", { parameters: { url: "http://127.0.0.1:60600/scenarios/social-scheduler/" } }),
  ];
  const actionTypes = new Map([["s1", "web.browser.navigate"], ["s2", "web.dom.select"], ["s3", "web.browser.navigate"], ["s4", "web.browser.navigate"]]);
  assert.deepEqual(savedNavigationOrigins(nodes, actionTypes), ["http://127.0.0.1:61538", "http://127.0.0.1:60600"]);
});

test("a navigate node with no readable address is reported, not skipped", () => {
  const nodes = [node("s1", { url: "not a url" }), node("s2", undefined)];
  const actionTypes = new Map([["s1", "web.browser.navigate"], ["s2", "web.browser.navigate"]]);
  assert.deepEqual(savedNavigationOrigins(nodes, actionTypes), ["(unreadable)"]);
});

test("a Flow with no navigate node navigates nowhere", () => {
  assert.deepEqual(savedNavigationOrigins([node("s1", { selector: "testid:rows" })], new Map([["s1", "web.dom.extract_list"]])), []);
});
