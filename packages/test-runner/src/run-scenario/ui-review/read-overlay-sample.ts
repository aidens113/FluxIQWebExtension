import { screenText } from "../extension-start-trace/index.js";
import { screenLocation } from "./screen-location.js";
import type { OverlaySample } from "./types.js";
import { withTimeout } from "./with-timeout.js";

/** The one DevTools call the sampler needs: a page-scoped session's `send`. */
export type OverlayCdp = { send(method: string, params?: Record<string, unknown>): Promise<any> };

const HOST_TAG = "fluxiq-activity-overlay";
const OBJECT_GROUP = "fluxiq-lab-ui-review";
const READ_TIMEOUT_MS = 1_000;

// Runs in the sampled tab's main world. Read-only: it changes nothing in the page, which the recorder may be recording.
const HOST_STATE = `(() => {
  const hosts = document.querySelectorAll(${JSON.stringify(HOST_TAG)});
  const out = { hostCount: hosts.length, documentVisibility: document.visibilityState, documentOrigin: performance.timeOrigin, href: location.href };
  const host = hosts[0];
  if (!host) return out;
  const r = host.getBoundingClientRect();
  const s = getComputedStyle(host);
  const attributes = {};
  for (const a of host.attributes) if (a.name !== "style") attributes[a.name] = a.value;
  return { ...out, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, display: s.display, visibility: s.visibility, opacity: Number(s.opacity),
    inViewport: r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight, attributes };
})()`;

type HostState = { hostCount: number; documentVisibility?: string; documentOrigin?: number; href?: string; rect?: OverlaySample["rect"]; display?: string; visibility?: string; opacity?: number; inViewport?: boolean; attributes?: Record<string, string> };
type DescribedNode = { nodeType?: number; nodeName?: string; nodeValue?: string; children?: DescribedNode[]; shadowRoots?: DescribedNode[] };

/**
 * One read of the activity overlay in a tab's top frame.
 *
 * The overlay draws everything inside a **closed** shadow root, which no page
 * script can open, so its text is read through DevTools instead:
 * `DOM.describeNode` with `pierce` returns closed shadow roots too. Its box and
 * computed style are read by a main-world expression that changes nothing.
 *
 * Each read carries the location of the document it was taken in, screened by
 * `screenLocation` (origin and path, never query or fragment), so a change of
 * document says which page the tab moved to.
 *
 * It never throws: a read that fails is a sample carrying `error`, which
 * `countOverlayChanges` counts as a failed read rather than an absent overlay.
 */
export async function readOverlaySample(cdp: OverlayCdp, atMs: number, secrets: readonly string[]): Promise<OverlaySample> {
  try {
    const evaluated = await withTimeout(cdp.send("Runtime.evaluate", { expression: HOST_STATE, returnByValue: true }), READ_TIMEOUT_MS, "the overlay's state");
    if (evaluated?.exceptionDetails) return { atMs, present: false, hostCount: 0, visible: false, error: `overlay state threw: ${screenText(String(evaluated.exceptionDetails.text ?? "exception"), secrets)}` };
    const state = evaluated?.result?.value as HostState | undefined;
    if (!state || typeof state.hostCount !== "number") return { atMs, present: false, hostCount: 0, visible: false, error: "overlay state returned no value" };
    const base = { atMs, hostCount: state.hostCount, ...(state.documentVisibility === undefined ? {} : { documentVisibility: state.documentVisibility }), ...(typeof state.documentOrigin === "number" && Number.isFinite(state.documentOrigin) ? { documentOrigin: state.documentOrigin } : {}), ...(typeof state.href === "string" ? { pageUrl: screenLocation(state.href, secrets) } : {}) };
    if (state.hostCount === 0) return { ...base, present: false, visible: false };
    const textParts = (await hostText(cdp)).map(part => screenText(part, secrets));
    const phaseName = textParts[0];
    const step = textParts.find(part => part.startsWith("· "))?.slice(2);
    const visible = state.display !== "none" && state.visibility !== "hidden" && (state.opacity ?? 1) > 0.05 && state.inViewport === true;
    const attributes = Object.fromEntries(Object.entries(state.attributes ?? {}).map(([name, value]) => [name, screenText(value, secrets)]));
    return {
      ...base, present: true, visible, ...(state.rect ? { rect: state.rect } : {}), ...(state.display === undefined ? {} : { display: state.display }),
      ...(state.visibility === undefined ? {} : { visibility: state.visibility }), ...(state.opacity === undefined ? {} : { opacity: state.opacity }),
      inViewport: state.inViewport === true, attributes, textParts, text: textParts.join(" | "), ...(phaseName === undefined ? {} : { phaseName }), ...(step === undefined ? {} : { step }),
    };
  } catch (error) {
    return { atMs, present: false, hostCount: 0, visible: false, error: screenText(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error), secrets) };
  }
}

async function hostText(cdp: OverlayCdp): Promise<string[]> {
  try {
    const handle = await withTimeout(cdp.send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(HOST_TAG)})`, objectGroup: OBJECT_GROUP }), READ_TIMEOUT_MS, "the overlay host");
    const objectId = handle?.result?.objectId;
    if (typeof objectId !== "string") throw new Error("the overlay host went away between two reads");
    const described = await withTimeout(cdp.send("DOM.describeNode", { objectId, depth: -1, pierce: true }), READ_TIMEOUT_MS, "the overlay's shadow tree");
    const parts: string[] = [];
    collectText(described?.node as DescribedNode | undefined, parts);
    return parts;
  } finally {
    await cdp.send("Runtime.releaseObjectGroup", { objectGroup: OBJECT_GROUP }).catch(/* best-effort: an unreleased handle only lives until the next navigation */ () => undefined);
  }
}

/** Text nodes in document order, a shadow root before light children as it renders, style text skipped. */
function collectText(node: DescribedNode | undefined, into: string[]): void {
  if (!node) return;
  if (node.nodeType === 3) { const text = (node.nodeValue ?? "").trim(); if (text) into.push(text); return; }
  if (node.nodeName === "STYLE" || node.nodeName === "SCRIPT") return;
  for (const root of node.shadowRoots ?? []) collectText(root, into);
  for (const child of node.children ?? []) collectText(child, into);
}
