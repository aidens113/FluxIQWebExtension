import assert from "node:assert/strict";
import test from "node:test";
import type { Locator, Page } from "@playwright/test";
import { executeInteractiveAction, parseInteractiveAction } from "./interactive-session.js";

test("parses the closed interactive action vocabulary", () => {
  assert.deepEqual(parseInteractiveAction({ id: "a", action: "navigate", surface: "panel", path: "/programs" }), { id: "a", action: "navigate", surface: "panel", path: "/programs" });
  assert.deepEqual(parseInteractiveAction({ action: "click", surface: "scenario", selector: "[data-testid=submit]" }), { action: "click", surface: "scenario", selector: "[data-testid=submit]" });
  assert.deepEqual(parseInteractiveAction({ action: "fill", surface: "scenario", selector: "#name", value: "Ada" }), { action: "fill", surface: "scenario", selector: "#name", value: "Ada" });
  assert.deepEqual(parseInteractiveAction({ action: "select", surface: "scenario", selector: "#plan", value: "pro" }), { action: "select", surface: "scenario", selector: "#plan", value: "pro" });
  assert.deepEqual(parseInteractiveAction({ action: "check", surface: "scenario", selector: "#terms", checked: false }), { action: "check", surface: "scenario", selector: "#terms", checked: false });
  assert.deepEqual(parseInteractiveAction({ action: "wait", surface: "panel", selector: ".ready" }), { action: "wait", surface: "panel", selector: ".ready", state: "visible" });
  assert.deepEqual(parseInteractiveAction({ action: "inspect", surface: "panel" }), { action: "inspect", surface: "panel" });
  assert.deepEqual(parseInteractiveAction({ action: "screenshot", surface: "scenario" }), { action: "screenshot", surface: "scenario" });
  assert.deepEqual(parseInteractiveAction({ action: "stop" }), { action: "stop" });
  assert.deepEqual(parseInteractiveAction({ action: "extension-action", actionType: "web.dom.click", selector: "#submit" }), { action: "extension-action", actionType: "web.dom.click", selector: "#submit" });
});

test("rejects arbitrary code, extra fields, oversized waits, and malformed surfaces", () => {
  assert.throws(() => parseInteractiveAction({ action: "evaluate", surface: "panel", script: "document.cookie" }), /not allowlisted/);
  assert.throws(() => parseInteractiveAction({ action: "click", surface: "panel", selector: "button", value: "unexpected" }), /unsupported field/);
  assert.throws(() => parseInteractiveAction({ action: "wait", surface: "panel", milliseconds: 10_001 }), /0 to 10000/);
  assert.throws(() => parseInteractiveAction({ action: "inspect", surface: "external" }), /scenario, panel, or extension/);
  assert.throws(() => parseInteractiveAction({ action: "extension-action", actionType: "web.browser.navigate" }), /not allowlisted/);
});

test("navigation remains on the selected exact origin", async () => {
  const page = fakePage();
  await executeInteractiveAction({ action: "navigate", surface: "scenario", path: "/scenarios/basic-form/" }, { scenario: page, panel: page }, { scenario: "http://127.0.0.1:4100", panel: "http://127.0.0.1:4200" }, "unused", 1);
  assert.equal(page.url(), "http://127.0.0.1:4100/scenarios/basic-form/");
  await assert.rejects(executeInteractiveAction({ action: "navigate", surface: "scenario", path: "https://example.com/" }, { scenario: page, panel: page }, { scenario: "http://127.0.0.1:4100", panel: "http://127.0.0.1:4200" }, "unused", 2), /selected surface origin/);
});

test("fill results never echo values and sensitive controls fail closed", async () => {
  let filled = "";
  const safe = fakePage({ onFill: value => { filled = value; } });
  const result = await executeInteractiveAction({ action: "fill", surface: "panel", selector: "#goal", value: "bounded edit" }, { scenario: safe, panel: safe }, { scenario: "http://127.0.0.1:4100", panel: "http://127.0.0.1:4200" }, "unused", 1);
  assert.equal(filled, "bounded edit");
  assert.equal(JSON.stringify(result).includes("bounded edit"), false);
  const sensitive = fakePage({ sensitive: true });
  await assert.rejects(executeInteractiveAction({ action: "fill", surface: "panel", selector: "#password", value: "never-log-this" }, { scenario: sensitive, panel: sensitive }, { scenario: "http://127.0.0.1:4100", panel: "http://127.0.0.1:4200" }, "unused", 2), /cannot enter sensitive/);
});

test("secretEnv fills only sensitive controls, from a strict allowlist, without echo", async () => {
  let filled = "";
  const sensitive = fakePage({ sensitive: true, onFill: value => { filled = value; } });
  const result = await executeInteractiveAction({ action: "fill", surface: "panel", selector: "#pin", secretEnv: "FLUXIQ_TEST_PIN" }, { panel: sensitive }, { panel: "http://127.0.0.1:4200" }, "unused", 1, { FLUXIQ_TEST_PIN: "123456" });
  assert.equal(filled, "123456");
  assert.deepEqual(result.sensitive, true);
  assert.equal(JSON.stringify(result).includes("123456"), false);
  await assert.rejects(executeInteractiveAction({ action: "fill", surface: "panel", selector: "#name", secretEnv: "FLUXIQ_TEST_PIN" }, { panel: fakePage() }, { panel: "http://127.0.0.1:4200" }, "unused", 2, { FLUXIQ_TEST_PIN: "123456" }), /only fill a sensitive control/);
  assert.throws(() => parseInteractiveAction({ action: "fill", surface: "panel", selector: "#key", secretEnv: "UNSAFE_KEY" }), /not allowlisted/);
  assert.throws(() => parseInteractiveAction({ action: "fill", surface: "panel", selector: "#key", value: "x", secretEnv: "DEEPSEEK_API_KEY" }), /exactly one/);
});

test("screenshots fail closed when a sensitive control contains a value", async () => {
  const page = fakePage({ sensitiveValuePresent: true });
  await assert.rejects(executeInteractiveAction({ action: "screenshot", surface: "panel" }, { scenario: page, panel: page }, { scenario: "http://127.0.0.1:4100", panel: "http://127.0.0.1:4200" }, "unused", 1), /sensitive control/);
});

function fakePage(options: { sensitive?: boolean; sensitiveValuePresent?: boolean; onFill?: (value: string) => void } = {}): Page {
  let currentUrl = "http://127.0.0.1:4100/";
  const locator = {
    click: async () => undefined,
    fill: async (value: string) => { options.onFill?.(value); },
    selectOption: async () => [],
    check: async () => undefined,
    uncheck: async () => undefined,
    waitFor: async () => undefined,
    evaluate: async () => Boolean(options.sensitive),
    evaluateAll: async () => Boolean(options.sensitiveValuePresent),
  } as unknown as Locator;
  return {
    url: () => currentUrl,
    title: async () => "Fixture",
    goto: async (url: string) => { currentUrl = url; return null; },
    locator: () => locator,
    waitForTimeout: async () => undefined,
    screenshot: async () => Buffer.from("png"),
    evaluate: async () => [],
  } as unknown as Page;
}
