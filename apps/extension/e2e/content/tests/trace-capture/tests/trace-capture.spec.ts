// The production trace page capture (`content/trace-capture/`, answered to
// `TRACE_PAGE_CAPTURE_MESSAGE` by the content script's message handler), on
// realistic list pages: does the capture, reloaded offline in the snapshot
// spike's sandbox, give the extension's own code the live answers?
//
// On each site's list page, as the spike reaches it (list-pages.ts):
// - a visible text field is given a value and a box is checked, and a hidden
//   form of sensitive controls is added, each holding a synthetic token --
//   in its value attribute, its live value, its text -- that must never
//   appear in the capture;
// - a warm-up measurement plans the read and the targets and lets the read
//   load what it loads (the spike's decision 3);
// - the capture is asked for through the message, as the background worker
//   asks for it, and once more addressed to a child frame, which the top frame
//   must not answer;
// - the live page view, list read and sampled targets are measured;
// - the Lab is closed and the capture is served at its address by the
//   spike's sandbox (offline-capture.ts): network off, page scripts off,
//   every resource answered from the capture's own resources;
// - the same three measurements are repeated with the live plan.
//
// Asserted: the capture answered `ok`; it holds no script, no inline handler
// and none of the tokens; every resource it carries is same-origin; the
// sandbox held (no request left, no page script ran); and the page view, the
// read and the targets agree exactly. One TRACE_CAPTURE line per site is
// printed: capture time, sizes and counts only, never page text.

import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { expect, test } from "../../../index.js";
import { TRACE_PAGE_CAPTURE_MESSAGE, type TracePageCaptureResponse } from "../../../../../src/shared/trace-page-capture.js";
import { armCapture } from "../../snapshot-fidelity/tests/arm-capture.js";
import { compareMeasurements } from "../../snapshot-fidelity/tests/compare-measurements.js";
import { LIST_PAGES } from "../../snapshot-fidelity/tests/list-pages.js";
import { measurePage } from "../../snapshot-fidelity/tests/measure-page.js";
import { openOfflineCapture } from "../../snapshot-fidelity/tests/offline-capture.js";

/** The realistic sites this spec runs on: a server-rendered list with a shadow-DOM consent wall, and a store with images. */
const SITES = new Set(["job-board", "everything-store"]);

/** Seeds form state the capture must carry and sensitive values it must not; returns how much was seeded. */
function seedPage(tokens: string[]): { fields: number; checkboxes: number; sensitive: number } {
  const shown = (element: Element): boolean => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const inputs = Array.from(document.querySelectorAll("input"));
  const field = inputs.find((input) => ["text", "search", "email", "url", "tel"].includes(input.type) && input.value === "" && shown(input));
  if (field) field.value = "trace capture probe";
  const box = inputs.find((input) => input.type === "checkbox" && !input.checked && shown(input));
  if (box) box.checked = true;

  const form = document.createElement("form");
  form.hidden = true;
  const password = document.createElement("input");
  password.type = "password";
  password.name = "trace-probe-password";
  password.setAttribute("value", tokens[0]!);
  password.value = tokens[1]!;
  const card = document.createElement("input");
  card.name = "trace-probe-card";
  card.autocomplete = "cc-number";
  card.value = tokens[2]!;
  const area = document.createElement("textarea");
  area.setAttribute("data-sensitive", "true");
  area.textContent = tokens[3]!;
  area.value = tokens[4]!;
  const region = document.createElement("div");
  region.setAttribute("data-sensitive", "true");
  region.textContent = tokens[5]!;
  form.append(password, card, area, region);
  document.body.append(form);
  return { fields: field ? 1 : 0, checkboxes: box ? 1 : 0, sensitive: 4 };
}

/** What the capture's markup holds, parsed without running it: scripts, inline handlers and declarative shadow roots, inside templates too. */
function auditMarkup(html: string): { scripts: number; handlers: number; shadowTemplates: number; elements: number } {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const counts = { scripts: 0, handlers: 0, shadowTemplates: 0, elements: 0 };
  const walk = (root: ParentNode): void => {
    for (const element of Array.from(root.querySelectorAll("*"))) {
      counts.elements += 1;
      if (element.localName === "script") counts.scripts += 1;
      counts.handlers += Array.from(element.attributes).filter((attribute) => /^on/iu.test(attribute.name)).length;
      if (element instanceof HTMLTemplateElement) {
        if (element.hasAttribute("shadowrootmode")) counts.shadowTemplates += 1;
        walk(element.content);
      }
    }
  };
  walk(parsed);
  return counts;
}

for (const listPage of LIST_PAGES.filter((candidate) => SITES.has(candidate.scenarioId))) {
  test(`${listPage.scenarioId}: the trace page capture reloads offline to the live page view, read and targets`, async ({ openHarness, page, browser }, testInfo) => {
    test.setTimeout(420_000);
    const harness = await openHarness(listPage.scenarioId);
    await listPage.open(harness);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    const salt = Math.random().toString(36).slice(2, 10).toUpperCase();
    const tokens = ["ATTR", "LIVE", "CARD", "AREAMARKUP", "AREALIVE", "REGION"].map((part) => `TRACEPROBE${part}${salt}`);
    const seeded = await page.evaluate(seedPage, tokens);
    const warmup = await measurePage(harness);
    await page.waitForTimeout(1_000);

    const childAddressed = await harness.deliver({ type: TRACE_PAGE_CAPTURE_MESSAGE, frameId: 3 });
    expect(childAddressed.responded, "the top frame answered a capture addressed to a child frame").toBe(false);
    const captureStarted = Date.now();
    const delivery = await harness.deliver({ type: TRACE_PAGE_CAPTURE_MESSAGE, frameId: 0 });
    const captureMs = Date.now() - captureStarted;
    expect(delivery.responded, "the content script answered the capture").toBe(true);
    const reply = delivery.response as TracePageCaptureResponse;
    if (!reply.ok) throw new Error(`The capture failed: ${reply.reason}`);
    const liveUrl = page.url();
    expect(reply.document.source, "the capture names the address it was taken at").toBe(liveUrl);

    const markup = await page.evaluate(auditMarkup, reply.document.html);
    expect(markup.scripts, "the capture holds no script").toBe(0);
    expect(markup.handlers, "the capture holds no inline handler").toBe(0);
    const decoded = reply.resources.map((resource) => ({ ...resource, body: Buffer.from(resource.base64, "base64") }));
    const leakedTokens = tokens.filter((token) => reply.document.html.includes(token) || decoded.some((resource) => resource.body.toString("latin1").includes(token)));
    expect(leakedTokens.length, "a seeded sensitive value reached the capture").toBe(0);
    const pageOrigin = new URL(liveUrl).origin;
    expect(decoded.filter((resource) => new URL(resource.source).origin !== pageOrigin).length, "every carried resource is same-origin").toBe(0);

    const live = await measurePage(harness, warmup.plan);
    expect(live.elements.length, "the live page view lists elements").toBeGreaterThan(0);
    expect(live.read.rows.length, "the live list read returned rows").toBeGreaterThan(0);
    expect(live.targets.filter((target) => target.resolved).length, "live targets resolved").toBeGreaterThan(0);
    await harness.close();

    const served = {
      url: reply.document.source,
      html: armCapture(reply.document.html),
      resources: new Map(decoded.map((resource) => [resource.source, { contentType: resource.mediaType, body: resource.body }]))
    };
    const offline = await openOfflineCapture(browser, served);
    try {
      await offline.page.waitForTimeout(500);
      const measured = await measurePage(offline, live.plan);
      const sandbox = await offline.sandbox();
      expect(sandbox.contentScriptReady, "the content script ran offline").toBe(true);
      expect(sandbox.leakedRequests, "no request left the sandbox").toBe(0);
      expect(sandbox.websockets, "no websocket opened").toBe(0);
      expect(sandbox.pageScriptsParsed, `no page script was parsed: ${JSON.stringify(sandbox.pageScripts)}`).toBe(0);
      for (const [name, value] of Object.entries(sandbox.canaries)) expect(value, `canary ${name} never ran`).toBeNull();

      const agreement = compareMeasurements(live, measured);
      const htmlBytes = Buffer.byteLength(reply.document.html, "utf8");
      const byMediaType: Record<string, { count: number; bytes: number }> = {};
      for (const resource of decoded) {
        const kind = resource.mediaType.split(";")[0]!.trim();
        const entry = byMediaType[kind] ??= { count: 0, bytes: 0 };
        entry.count += 1;
        entry.bytes += resource.body.length;
      }
      const summary = {
        site: listPage.scenarioId,
        seeded,
        captureMs,
        document: { rawBytes: htmlBytes, gzipBytes: gzipSync(Buffer.from(reply.document.html, "utf8")).length, ...markup },
        resources: { count: decoded.length, bytes: decoded.reduce((sum, resource) => sum + resource.body.length, 0), byMediaType, unavailable: reply.unavailable },
        sandbox: { servedFromCapture: sandbox.servedFromCapture, requestsByType: sandbox.requestsByType, aborted: sandbox.aborted, navigationsHeld: sandbox.navigationsHeld },
        agreement: {
          pageView: { live: agreement.pageView.live, offline: agreement.pageView.offline, matched: agreement.pageView.matched, fieldDisagreements: agreement.pageView.fieldDisagreements },
          read: { liveRows: agreement.read.liveRows, offlineRows: agreement.read.offlineRows, columns: agreement.read.liveColumns, cellsEqual: agreement.read.cellsEqual, cellsCompared: agreement.read.cellsCompared, liveStatus: agreement.read.liveStatus, offlineStatus: agreement.read.status },
          targets: { sampled: agreement.targets.sampled, liveResolved: agreement.targets.liveResolved, offlineResolved: agreement.targets.offlineResolved, sameElement: agreement.targets.sameElement, strategies: agreement.targets.offlineStrategies }
        }
      };
      await writeFile(testInfo.outputPath("trace-capture-summary.json"), JSON.stringify(summary, null, 1));
      console.log(`TRACE_CAPTURE ${JSON.stringify(summary)}`);

      expect(agreement.pageView.matched, `the page view agrees: ${JSON.stringify(agreement.pageView)}`).toBe(agreement.pageView.live);
      expect(agreement.pageView.offline, "the offline page view lists no extra element").toBe(agreement.pageView.live);
      expect(agreement.read.equal, `the list read agrees: ${JSON.stringify(agreement.read)}`).toBe(true);
      expect(agreement.read.status, "the read ends the same way offline").toBe(agreement.read.liveStatus);
      expect(agreement.targets.offlineResolved, `targets resolve offline: ${JSON.stringify(agreement.targets)}`).toBe(agreement.targets.liveResolved);
      expect(agreement.targets.sameElement, "each target resolves to the element it did live").toBe(agreement.targets.liveResolved);
    } finally {
      await offline.close();
    }
  });
}
