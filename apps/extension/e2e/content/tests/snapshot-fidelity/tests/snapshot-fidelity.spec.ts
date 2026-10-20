// The tier-2 snapshot spike (trace-offline-trials plan, P2 and P5): can a
// captured page be reloaded offline faithfully enough that the extension's
// own extraction and target code give the live answers there?
//
// On each realistic site's list page: a warm-up pass plans the measurements
// and lets a read load what it loads; the page is captured as (A) MHTML from
// CDP `Page.captureSnapshot`, what `chrome.pageCapture` produces, and (B) a
// document serialized in the page (serialize-document.ts); the live page view,
// list read and target resolutions are measured through the content script
// (the harness); the Lab is closed; each capture is reloaded in a fresh
// context with the network and the page's scripts off (offline-capture.ts;
// the archive unpacked by unpack-mhtml.ts, which says why it is not loaded
// whole), the content script is run there, and the same three measurements
// are repeated with the live plan and compared.
//
// What is asserted is that the measurement is sound: the live baselines are
// not empty, and the sandbox held -- no request left, no page script ran.
// Agreement itself is the measurement and is printed, not asserted: one line
// per site and capture, counts and tag names only, never page text. The
// captures and full measurements stay in this test's output directory, which
// is ignored.
//
// Before capture the first empty visible text field is given a value and the
// first unchecked visible checkbox is checked, through the DOM properties
// only, so the form-state category has something to carry.

import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { expect, test } from "../../../index.js";
import { armCapture } from "./arm-capture.js";
import { compareMeasurements } from "./compare-measurements.js";
import { LIST_PAGES } from "./list-pages.js";
import { measurePage } from "./measure-page.js";
import { openOfflineCapture, type CapturedDocument } from "./offline-capture.js";
import { serializeDocument } from "./serialize-document.js";
import { unpackMhtml } from "./unpack-mhtml.js";

function seedFormState(): { fields: number; checkboxes: number } {
  const shown = (element: Element): boolean => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
  const field = inputs.find((input) => ["text", "search", "email", "url", "tel", ""].includes(input.type) && input.value === "" && shown(input));
  if (field) field.value = "fidelity probe";
  const box = inputs.find((input) => input.type === "checkbox" && !input.checked && shown(input));
  if (box) box.checked = true;
  return { fields: field ? 1 : 0, checkboxes: box ? 1 : 0 };
}

for (const listPage of LIST_PAGES) {
  test(`${listPage.scenarioId}: a captured list page reloaded offline, measured against the live page`, async ({ openHarness, page, browser }, testInfo) => {
    test.setTimeout(420_000);
    const harness = await openHarness(listPage.scenarioId);
    await listPage.open(harness);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    const seeded = await page.evaluate(seedFormState);
    // A warm-up pass first: it builds the plan, and its read loads whatever a
    // read makes the page load (a feed fetches more rows as it is scrolled), so
    // the capture holds the page a read leaves. The baseline is measured again
    // right after the capture.
    const warmup = await measurePage(harness);
    await page.waitForTimeout(1_000);

    const cdp = await page.context().newCDPSession(page);
    const mhtmlStarted = Date.now();
    const { data: mhtml } = await cdp.send("Page.captureSnapshot", { format: "mhtml" }) as { data: string };
    const mhtmlMs = Date.now() - mhtmlStarted;
    await cdp.detach();
    const domStarted = Date.now();
    const dom = await page.evaluate(serializeDocument);
    const domMs = Date.now() - domStarted;

    const liveUrl = page.url();
    const live = await measurePage(harness, warmup.plan);
    expect(live.elements.length, "the live page view lists elements").toBeGreaterThan(0);
    expect(live.plan.read, `the live structure detection found the list: ${JSON.stringify(live.detection)}`).not.toBeNull();
    expect(live.read.rows.length, `the live list read returned rows: ${JSON.stringify({ status: live.read.status, failure: live.read.failureCode, reason: live.read.failureReason?.slice(0, 600), detection: live.detection })}`).toBeGreaterThan(0);
    expect(live.targets.length, "targets were sampled from the live page view").toBeGreaterThan(0);
    expect(live.targets.filter((target) => target.resolved).length, "live targets resolved").toBeGreaterThan(0);
    await harness.close();

    const unpacked = unpackMhtml(mhtml);
    const domResources = new Map(dom.resources.map((resource) => [resource.url, {
      contentType: resource.contentType,
      body: resource.dataUrl ? Buffer.from(resource.dataUrl.slice(resource.dataUrl.indexOf(",") + 1), "base64") : Buffer.from(resource.text ?? "", "utf8")
    }]));
    // The serialized capture's size is its document plus the resources carried beside it.
    const domContent = [Buffer.from(dom.html, "utf8"), ...[...domResources.values()].map((resource) => resource.body)];
    const captures: Array<{ method: "mhtml" | "dom"; content: Buffer[]; ms: number; inPageMs: number | null; served: CapturedDocument }> = [
      { method: "mhtml", content: [Buffer.from(mhtml, "utf8")], ms: mhtmlMs, inPageMs: null, served: { ...unpacked, html: armCapture(unpacked.html) } },
      { method: "dom", content: domContent, ms: domMs, inPageMs: Math.round(dom.elapsedMs), served: { url: liveUrl, html: armCapture(dom.html), resources: domResources } }
    ];
    const results: Record<string, unknown> = { scenarioId: listPage.scenarioId, seeded, warmupRows: warmup.read.rows.length, droppedFields: warmup.plan.droppedFields, serializer: dom.counts, mhtml: { parts: unpacked.parts, shadowTemplates: unpacked.shadowTemplates } };
    for (const capture of captures) {
      const raw = capture.content.reduce((sum, part) => sum + part.length, 0);
      const gzip = capture.content.reduce((sum, part) => sum + gzipSync(part).length, 0);
      await writeFile(testInfo.outputPath(`capture-${capture.method}.${capture.method === "mhtml" ? "mhtml" : "html"}`), capture.content[0]!);

      const offline = await openOfflineCapture(browser, capture.served);
      try {
        await offline.page.waitForTimeout(500);
        const measured = await measurePage(offline, live.plan);
        const sandbox = await offline.sandbox();
        expect(sandbox.contentScriptReady, `${capture.method}: the content script ran offline`).toBe(true);
        expect(sandbox.leakedRequests, `${capture.method}: no request left the sandbox`).toBe(0);
        expect(sandbox.websockets, `${capture.method}: no websocket opened`).toBe(0);
        expect(sandbox.pageScriptsParsed, `${capture.method}: no page script was parsed: ${JSON.stringify({ scripts: sandbox.pageScripts, navigations: sandbox.navigations, popups: sandbox.popups, held: sandbox.navigationsHeld, aborted: sandbox.aborted, requests: sandbox.requestsByType })}`).toBe(0);
        for (const [name, value] of Object.entries(sandbox.canaries)) expect(value, `${capture.method}: canary ${name} never ran`).toBeNull();

        const agreement = compareMeasurements(live, measured);
        const summary = {
          site: listPage.scenarioId,
          method: capture.method,
          size: { raw, gzip, parts: capture.content.length, captureMs: capture.ms, inPageMs: capture.inPageMs },
          sandbox,
          archive: capture.method === "mhtml" ? { parts: unpacked.parts, shadowTemplates: unpacked.shadowTemplates } : dom.counts,
          agreement,
          warmup: { rows: warmup.read.rows.length, droppedFields: warmup.plan.droppedFields, readMs: warmup.read.ms },
          timings: { liveCaptureMs: live.captureMs, offlineCaptureMs: measured.captureMs, liveReadMs: live.read.ms, offlineReadMs: measured.read.ms }
        };
        results[capture.method] = summary;
        await writeFile(testInfo.outputPath(`measured-${capture.method}.json`), JSON.stringify({ live, offline: measured }, null, 1));
        console.log(`FIDELITY ${JSON.stringify(summary)}`);
      } finally {
        await offline.close();
      }
    }
    await writeFile(testInfo.outputPath("fidelity-summary.json"), JSON.stringify(results, null, 1));
  });
}
