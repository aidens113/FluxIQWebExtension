import assert from "node:assert/strict";
import test from "node:test";
import { createPageScreenshotAdapter, type CapturablePage } from "../page-screenshot-adapter.js";
import type { CaptureEvidenceEventInput } from "@fluxiq-web-extension/test-evidence";

const event = (trigger: CaptureEvidenceEventInput["trigger"]): CaptureEvidenceEventInput => ({
  trigger,
  summary: `a ${trigger}`,
  correlation: { runId: "run-test", scenarioId: "everything-store", correlationId: `corr-${trigger}` },
});

/** A page whose screenshot answers however the test says, counting the attempts. */
function fakePage(answer: (attempt: number) => Promise<Uint8Array>, address = "about:blank") {
  const page = {
    attempts: 0,
    closed: false,
    address,
    isClosed: () => page.closed,
    url: () => page.address,
    screenshot: async (_options: { type: "png" }) => {
      page.attempts += 1;
      return answer(page.attempts);
    },
  };
  return page satisfies CapturablePage & { attempts: number; closed: boolean; address: string };
}

const pixels = () => Uint8Array.from([137, 80, 78, 71]);
/** What a backgrounded headed tab does: never answers, and Playwright aborts at its 30 s default. */
const timesOut = async () => { throw Object.assign(new Error("page.screenshot: Timeout 30000ms exceeded."), { name: "TimeoutError" }); };

test("a capture of a page that answers is published as a verified png", async () => {
  const page = fakePage(async () => pixels());
  const adapter = createPageScreenshotAdapter(() => page);
  const visual = await adapter.capture(event("runtime.settle"));
  assert.deepEqual(visual, { bytes: pixels(), mediaType: "image/png", redactionVerified: true });
  assert.equal(page.attempts, 1);
});

test("with no page, and with a closed page, nothing is attempted", async () => {
  const none = createPageScreenshotAdapter(() => undefined);
  assert.equal(await none.capture(event("runtime.dispatch")), undefined);
  const page = fakePage(async () => pixels());
  page.closed = true;
  const closed = createPageScreenshotAdapter(() => page);
  assert.equal(await closed.capture(event("error")), undefined);
  assert.equal(page.attempts, 0);
});

test("a page that could not be photographed is not waited for a second time", async () => {
  // The 60.0 s tail measured in run-muhnh0s5-98a27f42 and run-muher0en-508ddb69:
  // the failure screenshot and the failure event's own capture, one after the
  // other, on the same abandoned tab. The first attempt stands; the rest are
  // answered from it.
  const page = fakePage(timesOut);
  const adapter = createPageScreenshotAdapter(() => page);
  assert.equal(await adapter.capture(event("runtime.settle")), undefined);
  assert.equal(await adapter.capture(event("runtime.settle")), undefined);
  assert.equal(await adapter.capture(event("error")), undefined);
  assert.equal(page.attempts, 1, "only the first capture of an unphotographable page is waited for");
});

test("a page that navigates is attempted again, and so is a different page", async () => {
  const page = fakePage(timesOut);
  const adapter = createPageScreenshotAdapter(() => page);
  await adapter.capture(event("runtime.settle"));
  await adapter.capture(event("runtime.settle"));
  assert.equal(page.attempts, 1);
  page.address = "http://127.0.0.1:4321/store";
  await adapter.capture(event("runtime.settle"));
  assert.equal(page.attempts, 2, "a page at a new address is a new question");

  const second = fakePage(timesOut, "about:blank");
  let shown: CapturablePage = page;
  const overTwo = createPageScreenshotAdapter(() => shown);
  await overTwo.capture(event("runtime.settle"));
  shown = second;
  await overTwo.capture(event("runtime.settle"));
  assert.equal(second.attempts, 1, "another page is never refused on the first page's account");
});

test("a page that starts answering again is photographed again", async () => {
  const page = fakePage(async attempt => (attempt === 1 ? timesOut() : pixels()));
  const adapter = createPageScreenshotAdapter(() => page);
  assert.equal(await adapter.capture(event("runtime.settle")), undefined);
  page.address = "http://127.0.0.1:4321/store";
  assert.ok(await adapter.capture(event("runtime.settle")), "a navigation re-arms the attempt");
  assert.equal(page.attempts, 2);
  assert.ok(await adapter.capture(event("error")), "a capture that succeeded leaves nothing latched");
  assert.equal(page.attempts, 3);
});
