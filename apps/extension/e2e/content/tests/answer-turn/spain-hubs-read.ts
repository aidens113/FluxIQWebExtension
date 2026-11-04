// A real provider-free read of the crossborder-marketplace "Spain hubs" task, for the answer-turn proof:
// the content script's own actions walk the site's filters and the domain's evidence runtime reads the
// list, with scripted decisions where a model would decide and no provider anywhere. This is the walk
// `live-tasks/tests/crossborder-marketplace-spain-hubs.spec.ts` proves; the rows it returns are what the
// page itself answered, and `spainHubRecords()` is the task's own expected answer.
import type { JsonObject } from "fluxiq/core";
import type { Page } from "@playwright/test";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { spainHubRecords } from "../../../../../scenario-lab/src/scenarios/crossborder-marketplace/manifest/index.js";
import type { BrowserActionCommand, BrowserActionResult, DomElementDescriptor } from "../../../../src/shared/protocol.js";
import { expect } from "../../index.js";
import type { ContentHarness } from "../../index.js";

export type SpainRow = Record<string, string | null>;
type Packet = { extraction: string; fields: Array<{ key: string; label: string; coverage: number }> };

const COLUMNS = ["title", "store", "price", "rating"] as const;
const BASE = { projectId: "project.spain-hubs", flowId: "flow.spain-hubs", maxEvidenceBytes: 48_000 } as const;
let commandCount = 0;

/** The task's own expected answer: thirteen rows of title, store, price, rating. */
export const SPAIN_HUBS_EXPECTED: readonly SpainRow[] = spainHubRecords() as unknown as SpainRow[];

const run = (harness: ContentHarness, action: Omit<BrowserActionCommand, "commandId">): Promise<BrowserActionResult> =>
  harness.runAction({ commandId: `answer-proof.${++commandCount}`, ...action } as BrowserActionCommand);

async function contentReady(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect.poll(async () => await page.evaluate(() => {
    const stub = (window as unknown as Record<string, { sent: Array<{ type?: string }> } | undefined>).__fluxiqContentHarness;
    return stub?.sent.some((message) => message.type === "fluxiq.contentReady") ?? false;
  }).catch(() => false), { timeout: 15_000 }).toBe(true);
}

async function named(harness: ContentHarness, label: string): Promise<DomElementDescriptor[]> {
  const snapshot = await harness.capture();
  return snapshot.interactiveElements.filter((element) => (element.visibleText ?? element.text ?? "").replace(/\s+/gu, " ").trim() === label);
}

async function click(harness: ContentHarness, label: string, where: (element: DomElementDescriptor) => boolean = () => true): Promise<void> {
  const found = (await named(harness, label)).filter(where);
  expect(found, `the snapshot lists exactly one control named "${label}"`).toHaveLength(1);
  const reply = await run(harness, { actionType: "web.dom.click", selector: found[0]!.selector });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
}

async function clickAndLoad(harness: ContentHarness, label: string, where?: (element: DomElementDescriptor) => boolean): Promise<void> {
  const before = harness.page.url();
  await click(harness, label, where);
  await harness.page.waitForURL((url) => url.href !== before, { timeout: 15_000 });
  await contentReady(harness.page);
}

/** The traffic screen is a person's hand-off in the task; the person passes it. */
async function personPassesTrafficScreen(page: Page): Promise<void> {
  if ((await page.title()) !== "Security check") return;
  await page.getByText("I'm not a robot").click();
  await expect.poll(async () => await page.title().catch(() => "Security check"), { timeout: 15_000 }).not.toBe("Security check");
  await contentReady(page);
}

const inSidebar = (element: DomElementDescriptor): boolean => / aside( |$)|^aside /u.test(element.selector);

async function walkFilteredRoute(harness: ContentHarness): Promise<void> {
  expect((await run(harness, { actionType: "web.dom.wait_for_text", text: "Welcome back, Mara!", timeoutMs: 8_000 })).status).toBe("succeeded");
  await click(harness, "No thanks");
  await click(harness, "Accept all");
  const boxes = (await harness.capture()).interactiveElements.filter((element) => element.tagName.toLowerCase() === "input" && (element.name ?? element.attributes?.name) === "q");
  expect(boxes).toHaveLength(1);
  const box = boxes[0]!.selector;
  expect((await run(harness, { actionType: "web.dom.type", selector: box, text: "usb c hub" })).status).toBe("succeeded");
  const before = harness.page.url();
  expect((await run(harness, { actionType: "web.dom.keypress", selector: box, key: "Enter" })).status).toBe("succeeded");
  await harness.page.waitForURL((url) => url.href !== before && url.pathname.endsWith("/search"), { timeout: 15_000 });
  await contentReady(harness.page);
  expect((await run(harness, { actionType: "web.dom.wait_for_text", text: "Never miss a price drop", timeoutMs: 8_000 })).status).toBe("succeeded");
  await click(harness, "Not now");
  await clickAndLoad(harness, "Spain", inSidebar);
  await clickAndLoad(harness, "Free shipping", inSidebar);
  await personPassesTrafficScreen(harness.page);
  await clickAndLoad(harness, "4★ & up", inSidebar);
  await expect.poll(async () => await harness.page.locator('main section a[target="_blank"] [title]').count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(10);
}

function reader(harness: ContentHarness) {
  const sent: Array<{ actionType: string; parameters: JsonObject; reply: BrowserActionResult }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const action = { commandId: `answer-proof.${++commandCount}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand;
      const reply = await harness.runAction(action);
      sent.push({ actionType: request.actionType, parameters: request.parameters, reply });
      const payload: JsonObject = {};
      if (reply.snapshot !== undefined) payload.snapshot = JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      if (reply.structure !== undefined) payload.structure = JSON.parse(JSON.stringify(reply.structure)) as JsonObject;
      if (reply.extracted !== undefined) payload.records = JSON.parse(JSON.stringify(reply.extracted)) as JsonObject;
      return { status: reply.status, payload, ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {}) };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), sent };
}

/** Walks the site's filters, detects the results, and reads title, store, price and rating of the 4.5-and-up organic hubs. */
export async function readSpainHubs(harness: ContentHarness): Promise<SpainRow[]> {
  await walkFilteredRoute(harness);
  const read = reader(harness);
  const detected = await read.runtime.executeTool({ ...BASE, callId: `call.detect.${++commandCount}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  expect(detected.resultCode, JSON.stringify(detected.evidence)).toBe("web.structure.detected");
  const packet = detected.evidence as unknown as Packet;
  const readList = async (extractList: JsonObject): Promise<SpainRow[]> => {
    const result = await read.runtime.executeTool({ ...BASE, callId: `call.read.${++commandCount}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-extract_list", parameters: { extractList }, consequences: [] } });
    expect(result.resultCode, JSON.stringify(result.evidence).slice(0, 1_000)).toBe("web.inspect.succeeded");
    return (read.sent.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1)!.reply.extracted ?? []) as SpainRow[];
  };
  const everything = await readList({ handle: packet.extraction, minItems: 0 });
  const holding = (value: string): string[] => packet.fields.filter((field) => everything.some((row) => row[field.key] === value)).map((field) => field.key);
  const first = SPAIN_HUBS_EXPECTED[0]!;
  const one = (what: string, keys: string[]): string => {
    expect(keys, `exactly one detected column holds the ${what}`).toHaveLength(1);
    return keys[0]!;
  };
  const adKeys = packet.fields.filter((field) => field.coverage < 1 && everything.some((row) => row[field.key] === "Ad") && everything.every((row) => row[field.key] === null || row[field.key] === "Ad")).map((field) => field.key);
  const price = holding(first.price!)[0] ?? packet.fields.find((field) => field.label.endsWith("(currency amount)"))?.key;
  const kept = await readList({
    handle: packet.extraction,
    fields: { title: one("title", holding(first.title!)), store: one("store", holding(first.store!)), price: price!, rating: one("rating", holding(first.rating!)) },
    where: [{ field: one("ad mark", adKeys), is: "absent" }, { field: "rating", atLeast: 4.5 }],
    minItems: 0
  });
  return kept.map((row) => Object.fromEntries(COLUMNS.filter((column) => column in row).map((column) => [column, row[column] ?? null])));
}
