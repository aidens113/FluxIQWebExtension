import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";
import { ConsoleErrorWatch } from "../console-errors.js";

class FakePage extends EventEmitter {
  constructor(private readonly address: string) { super(); }
  url() { return this.address; }
  logError(text: string) { this.emit("console", { type: () => "error", text: () => text }); }
  logWarning(text: string) { this.emit("console", { type: () => "warning", text: () => text }); }
  crash(message: string) { this.emit("pageerror", new Error(message)); }
}

function fakeContext(pages: FakePage[]): BrowserContext & EventEmitter {
  const context = new EventEmitter() as BrowserContext & EventEmitter;
  (context as unknown as { pages: () => Page[] }).pages = () => pages as unknown as Page[];
  return context;
}

const isScenarioUrl = (url: string) => url.startsWith("http://127.0.0.1:4100/");

test("collects errors and uncaught exceptions from scenario tabs only, including tabs opened later", () => {
  const scenario = new FakePage("http://127.0.0.1:4100/scenarios/basic-form/");
  const extension = new FakePage("chrome-extension://id/sidepanel/index.html");
  const context = fakeContext([scenario, extension]);
  const watch = new ConsoleErrorWatch(context, isScenarioUrl);
  const later = new FakePage("http://127.0.0.1:4100/scenarios/multi-tab/details");
  context.emit("page", later);
  scenario.logError("Uncaught fixture failure");
  scenario.logWarning("deprecated API");
  extension.logError("panel noise");
  later.crash("details exploded");
  assert.deepEqual(watch.errors(), [{ source: "console", text: "Uncaught fixture failure" }, { source: "pageerror", text: "details exploded" }]);
  watch.dispose();
});

test("an error matched by an allowed string passes; any other fails the run", () => {
  const scenario = new FakePage("http://127.0.0.1:4100/scenarios/failure-surfaces/");
  const watch = new ConsoleErrorWatch(fakeContext([scenario]), isScenarioUrl);
  scenario.logError("Failed to load resource: the server responded with a status of 503 (Service Unavailable)");
  assert.doesNotThrow(() => watch.assertOnlyAllowed(["status of 503"]));
  scenario.logError("TypeError: x is undefined");
  assert.throws(() => watch.assertOnlyAllowed(["status of 503"]), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.deepEqual(error.details?.errors, [{ source: "console", text: "TypeError: x is undefined" }]);
    return true;
  });
  assert.throws(() => watch.assertOnlyAllowed(), /2 console error/);
});

test("no errors passes without an allowlist", () => {
  const watch = new ConsoleErrorWatch(fakeContext([new FakePage("http://127.0.0.1:4100/")]), isScenarioUrl);
  assert.doesNotThrow(() => watch.assertOnlyAllowed(undefined));
});
