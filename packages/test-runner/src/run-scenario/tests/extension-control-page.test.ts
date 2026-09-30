import assert from "node:assert/strict";
import test from "node:test";
import { openExtensionControlPage } from "../extension-control-page.js";

type FakePage = { goto: (url: string) => Promise<void>; close: () => Promise<void>; closed: boolean };

function context(outcomes: Array<"crash" | "ok" | "other">) {
  const pages: FakePage[] = [];
  return {
    pages,
    newPage: async () => {
      const outcome = outcomes[pages.length] ?? "ok";
      const page: FakePage = {
        closed: false,
        goto: async () => {
          if (outcome === "crash") throw new Error("page.goto: Page crashed\nCall log:\n  - navigating to \"chrome-extension://x/sidepanel/index.html\"");
          if (outcome === "other") throw new Error("page.goto: net::ERR_FILE_NOT_FOUND");
        },
        close: async () => { page.closed = true; },
      };
      pages.push(page);
      return page as never;
    },
  };
}

/** `run-muna3yfq-a7d8a2a0` and `run-munbu244-4f4021a8` ended on this crash before spending a call. */
test("a control page whose renderer crashed while loading is opened again in a fresh tab, once", async () => {
  const fake = context(["crash", "ok"]);
  const opened = await openExtensionControlPage(fake, "chrome-extension://x/sidepanel/index.html");
  assert.equal(opened.attempts, 2);
  assert.equal(fake.pages.length, 2);
  assert.equal(fake.pages[0]!.closed, true);
  assert.equal(opened.page as unknown, fake.pages[1]);
});

test("a second crash still ends the run, and any other failure is not retried", async () => {
  await assert.rejects(openExtensionControlPage(context(["crash", "crash"]), "u"), /Page crashed/u);
  const other = context(["other", "ok"]);
  await assert.rejects(openExtensionControlPage(other, "u"), /ERR_FILE_NOT_FOUND/u);
  assert.equal(other.pages.length, 1);
});

test("a page that loads is returned on the first attempt", async () => {
  const opened = await openExtensionControlPage(context(["ok"]), "u");
  assert.equal(opened.attempts, 1);
});
