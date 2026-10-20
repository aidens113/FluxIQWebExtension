// The three things the spike measures on a page, through the extension's own
// code only: the page view (`captureSnapshot`), one list read
// (`web.dom.extract_list`, its request taken from the extension's own
// structure detection on the live page), and target resolution for a sample of
// the live page view's elements (`web.dom.assert` `exists` on the element's
// fingerprint, which goes through the content script's `resolveTarget`).
//
// Measured live, it also writes the plan -- the read request and the sampled
// fingerprints -- that the offline measurements replay unchanged, which is
// what tier 2 would do: re-run a recorded read or target against a capture.

import type { Page } from "@playwright/test";
import type { WebAutomationElementFingerprint, WebAutomationExtractField, WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, DomElementDescriptor, DomSnapshot } from "../../../../../src/shared/protocol.js";
import { elementPaths, type ElementPath } from "./element-path.js";
import { pageCensus, type PageCensus } from "./page-census.js";

export type MeasureDriver = {
  page: Page;
  runAction(command: BrowserActionCommand): Promise<BrowserActionResult>;
  capture(): Promise<DomSnapshot>;
};

export type TargetCategory = "row-control" | "button" | "link" | "input";

export type MeasurePlan = {
  read: { item: string; fields: Record<string, WebAutomationExtractField> } | null;
  targets: Array<{ category: TargetCategory; element: DomElementDescriptor; samplePath: ElementPath | null }>;
  /** Fields the live read refused as collapsed text and the plan dropped. */
  droppedFields: number;
};

export type TargetOutcome = { category: TargetCategory; resolved: boolean; strategy: string | null; path: ElementPath | null };

export type PageMeasurement = {
  plan: MeasurePlan;
  elements: DomElementDescriptor[];
  captureMs: number;
  detection: { ok: boolean; refused?: string | undefined; item?: string | undefined; fieldCount?: number | undefined };
  read: { status: string; rows: Array<Record<string, unknown>>; columns: string[]; failureCode: string | null; failureReason: string | null; ms: number };
  targets: TargetOutcome[];
  census: PageCensus;
};

const PER_CATEGORY = 5;
const MAX_DROPPED_FIELDS = 8;
/** How long a read may take to answer at all; its own `timeoutMs` is 30 s. */
const READ_ANSWER_MS = 90_000;

/** The promise, or an error naming what did not answer within `ms`. */
async function bounded<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not answer within ${ms} ms.`)), ms);
  });
  try {
    return await Promise.race([promise, stalled]);
  } finally {
    clearTimeout(timer);
  }
}

export async function measurePage(driver: MeasureDriver, given?: MeasurePlan): Promise<PageMeasurement> {
  const census = await driver.page.evaluate(pageCensus);
  const captureStarted = Date.now();
  const snapshot = await driver.capture();
  const captureMs = Date.now() - captureStarted;
  const elements = snapshot.interactiveElements;

  const detected = await driver.runAction({ commandId: "fidelity-detect", actionType: "web.dom.capture_snapshot", detectStructure: {} });
  const structure = detected.structure as WebAutomationStructureDetection | undefined;
  const detection = structure?.ok
    ? { ok: true, item: structure.proposal.item, fieldCount: structure.proposal.fields.length }
    : { ok: false, refused: structure && !structure.ok ? structure.refused : "no structure answered" };

  const plan: MeasurePlan = given ?? {
    read: structure?.ok
      ? { item: structure.proposal.item, fields: Object.fromEntries(structure.proposal.fields.map((field) => [field.key, field.spec as WebAutomationExtractField])) }
      : null,
    targets: await sampleTargets(driver.page, elements),
    droppedFields: 0
  };

  let read: PageMeasurement["read"] = { status: "not run", rows: [], columns: [], failureCode: null, failureReason: null, ms: 0 };
  // Building the plan, a read refused for a field whose text is still
  // collapsed is retried without that field, as the refusal itself says to.
  // The offline replay uses the plan as it ends up and never drops a field.
  for (let attempt = 0; plan.read && attempt < (given ? 1 : MAX_DROPPED_FIELDS + 1); attempt += 1) {
    const readStarted = Date.now();
    const reply = await bounded(driver.runAction({
      commandId: `fidelity-read-${attempt}`,
      actionType: "web.dom.extract_list",
      timeoutMs: 30_000,
      extractList: { item: plan.read.item, fields: plan.read.fields, minItems: 0 }
    }), READ_ANSWER_MS, `the list read (attempt ${attempt}, timeoutMs 30000)`);
    const rows = Array.isArray(reply.extracted) ? reply.extracted as Array<Record<string, unknown>> : [];
    read = {
      status: reply.status,
      rows,
      columns: [...new Set(rows.flatMap((row) => Object.keys(row)))].sort(),
      failureCode: reply.failure?.code ?? null,
      // The extension's own words for a refusal; kept in the ignored measurement file and failure messages only.
      failureReason: reply.failure?.actual ?? null,
      ms: Date.now() - readStarted
    };
    const collapsed = given ? undefined : /^incomplete_text: field (\S+) /u.exec(read.failureReason ?? "")?.[1];
    if (!collapsed || !(collapsed in plan.read.fields)) break;
    delete plan.read.fields[collapsed];
    plan.droppedFields += 1;
  }

  const resolved: Array<{ category: TargetCategory; element?: DomElementDescriptor | undefined; strategy: string | null }> = [];
  for (const [index, target] of plan.targets.entries()) {
    const reply = await driver.runAction({
      commandId: `fidelity-resolve-${index}`,
      actionType: "web.dom.assert",
      assert: { kind: "exists", timeoutMs: 400 },
      element: target.element as unknown as WebAutomationElementFingerprint
    });
    resolved.push({ category: target.category, element: reply.element, strategy: reply.resolution?.strategy ?? null });
  }
  const paths = await driver.page.evaluate(elementPaths, resolved.map((entry) => ({
    selector: entry.element?.selector ?? ":not(*)",
    shadowHosts: entry.element?.context?.shadowHosts
  })));
  const targets = resolved.map((entry, index) => ({
    category: entry.category,
    resolved: entry.element !== undefined,
    strategy: entry.strategy,
    path: entry.element ? paths[index] ?? null : null
  }));

  return { plan, elements, captureMs, detection, read, targets, census };
}

/** Up to five of each kind, spread evenly through the page view, each with where it sits in the live page. */
async function sampleTargets(page: Page, elements: DomElementDescriptor[]): Promise<MeasurePlan["targets"]> {
  const categoryOf = (element: DomElementDescriptor): TargetCategory | null => {
    if (element.hidden || !element.selector) return null;
    const tag = element.tagName.toLowerCase();
    const role = element.role ?? element.implicitRole;
    const interactive = ["a", "button", "input", "select", "textarea"].includes(tag) || ["button", "link", "checkbox", "radio", "tab", "menuitem", "switch"].includes(role ?? "");
    if (!interactive) return null;
    if (element.context?.record) return "row-control";
    if (["input", "select", "textarea"].includes(tag)) return "input";
    if (tag === "button" || role === "button") return "button";
    if (tag === "a" && element.href) return "link";
    return null;
  };
  const chosen: Array<{ category: TargetCategory; element: DomElementDescriptor }> = [];
  for (const category of ["row-control", "button", "link", "input"] as const) {
    const pool = elements.filter((element) => categoryOf(element) === category);
    const step = pool.length / Math.min(PER_CATEGORY, pool.length || 1);
    for (let index = 0; index < Math.min(PER_CATEGORY, pool.length); index += 1) chosen.push({ category, element: pool[Math.floor(index * step)]! });
  }
  const paths = await page.evaluate(elementPaths, chosen.map((entry) => ({ selector: entry.element.selector, shadowHosts: entry.element.context?.shadowHosts })));
  return chosen.map((entry, index) => ({ ...entry, samplePath: paths[index] ?? null }));
}
