import assert from "node:assert/strict";
import test from "node:test";
import { readOverlaySample, type OverlayCdp } from "../index.js";

const hostState = (overrides: Record<string, unknown> = {}) => ({ hostCount: 1, documentVisibility: "visible", documentOrigin: 1727890000123.5, rect: { x: 964, y: 620, width: 300, height: 84 }, display: "block", visibility: "visible", opacity: 1, inViewport: true, attributes: { "data-fluxiq-activity": "", "aria-hidden": "true" }, ...overrides });
const text = (value: string) => ({ nodeType: 3, nodeValue: value });
const element = (nodeName: string, children: unknown[]) => ({ nodeType: 1, nodeName, children });
// The overlay's card as `DOM.describeNode` with `pierce` returns it: the text lives under the closed shadow root.
const card = {
  nodeType: 1, nodeName: "FLUXIQ-ACTIVITY-OVERLAY", children: [],
  shadowRoots: [{ nodeType: 11, nodeName: "#document-fragment", children: [element("DIV", [
    element("DIV", [element("SPAN", [text("Building")]), element("SPAN", [text("· 2 of 5")]), element("SPAN", [text("FluxIQ")])]),
    element("DIV", [text(" Reading code 482913 on the page ")]),
    element("STYLE", [text(".x{}")]),
  ])] }],
};

function fakeCdp(state: unknown, node: unknown = card): OverlayCdp & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async send(method: string, params?: Record<string, unknown>) {
      calls.push(method);
      if (method === "Runtime.evaluate" && params?.returnByValue) return { result: { value: state } };
      if (method === "Runtime.evaluate") return { result: { objectId: "host-1" } };
      if (method === "DOM.describeNode") return { node };
      return {};
    },
  };
}

test("a present overlay is read through its closed shadow root: its parts, phase, step, box and visibility, screened", async () => {
  const cdp = fakeCdp(hostState());
  const sample = await readOverlaySample(cdp, 400, []);
  assert.equal(sample.present, true);
  assert.equal(sample.visible, true);
  assert.deepEqual(sample.textParts, ["Building", "· 2 of 5", "FluxIQ", "Reading code [code] on the page"], "style text is skipped and a six-digit code is screened");
  assert.equal(sample.phaseName, "Building");
  assert.equal(sample.step, "2 of 5");
  assert.equal(sample.text, "Building | · 2 of 5 | FluxIQ | Reading code [code] on the page");
  assert.deepEqual(sample.rect, { x: 964, y: 620, width: 300, height: 84 });
  assert.equal(sample.documentOrigin, 1727890000123.5, "the document it was read from is kept");
  assert.ok(cdp.calls.includes("Runtime.releaseObjectGroup"), "the host handle is released");
});

test("each read keeps the location of the document it was taken in, screened to origin and path", async () => {
  const sample = await readOverlaySample(fakeCdp(hostState({ href: "http://127.0.0.1:52153/scenarios/s3cret/search?q=napkins&token=abc#top" })), 0, ["s3cret"]);
  assert.ok(sample.pageUrl?.startsWith("http://127.0.0.1:52153/scenarios/"), sample.pageUrl);
  assert.ok(!sample.pageUrl?.includes("s3cret"), "a run secret in the path is redacted");
  assert.ok(!sample.pageUrl?.includes("?") && !sample.pageUrl?.includes("#"), "the query and fragment are dropped");
  const absent = await readOverlaySample(fakeCdp({ hostCount: 0, documentOrigin: 7, href: "http://127.0.0.1:52153/scenarios/bigbox-retail/" }), 0, []);
  assert.equal(absent.pageUrl, "http://127.0.0.1:52153/scenarios/bigbox-retail/", "an absent overlay still says which page was read");
});

test("an overlay faded to nothing, hidden, or off-screen is present but not visible", async () => {
  for (const overrides of [{ opacity: 0 }, { visibility: "hidden" }, { display: "none" }, { inViewport: false }]) {
    const sample = await readOverlaySample(fakeCdp(hostState(overrides)), 0, []);
    assert.equal(sample.present, true, JSON.stringify(overrides));
    assert.equal(sample.visible, false, JSON.stringify(overrides));
  }
});

test("no host is an absent overlay, and a read that fails is a sample carrying its error", async () => {
  const absent = await readOverlaySample(fakeCdp({ hostCount: 0, documentVisibility: "hidden", documentOrigin: 42 }), 0, []);
  assert.deepEqual(absent, { atMs: 0, hostCount: 0, documentVisibility: "hidden", documentOrigin: 42, present: false, visible: false });
  const failing: OverlayCdp = { async send() { throw new Error("Execution context was destroyed while reading s3cret"); } };
  const failed = await readOverlaySample(failing, 200, ["s3cret"]);
  assert.equal(failed.present, false);
  assert.ok(failed.error?.includes("Execution context was destroyed"));
  assert.ok(!failed.error?.includes("s3cret"), "the run's secrets are screened out of the error");
});
