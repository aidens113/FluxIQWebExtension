// The Core action probe: before the recording lane records anything, prove that
// one action FluxIQ Core issues reaches the page through the production gateway
// -- Core's control API, the gateway session, the extension's background worker
// and the content script in the page -- and that what came back was read from
// that page.
//
// It used to type into a field on the start page, in a fresh automation tab
// Core navigated to first. A type needs an uncovered control, and a fresh tab
// restarts every overlay a site shows on load: on `auction-marketplace` the app
// promotion and on `crossborder-marketplace` the coupon popup and cookie banner
// were up again by the time Core's type arrived, the extension rightly refused
// to type under them, and five of six recording lanes on those two sites failed
// before recording (E1 lane C, defect L1). Whether the site under test is
// covered has nothing to do with what the probe proves, so it no longer depends
// on it.
//
// It reads instead. The runner plants a random mark on the start page's root
// element, Core issues `web.dom.extract` for that attribute through the
// gateway, and the probe passes only when the value that comes back is the
// mark. A read runs no actionability check, so an overlay cannot refuse it, and
// only a content script reading that very document, after the mark was
// planted, can return it. So a gateway that refuses or cannot reach the
// session, an extension that returns nothing or a failed result, a content
// script that is missing, and an action routed to any other tab all still fail
// the probe. Nothing is opened or pressed: the extract runs in the tab the
// runner activated, which is the one the recording starts on, and the mark is
// removed before the recording begins.

import { randomBytes } from "node:crypto";
import type { RunActionTiming } from "@fluxiq-web-extension/test-contracts";
import { createCorrelationId } from "@fluxiq-web-extension/test-evidence";
import { RunnerFailure } from "../failure.js";
import { runActionStatus } from "../run-manifest/index.js";

/** The root-element attribute the probe plants and Core reads back. */
const PROBE_MARK_ATTRIBUTE = "data-fluxiq-core-probe";

/** A mark to set on the page's root element, or, with `value` null, to remove from it. */
export type CoreProbeMark = { attribute: string; value: string | null };

/** The part of a Playwright page the probe needs: enough for a fake to stand in for one. */
export type CoreProbePage = { evaluate(pageFunction: (mark: CoreProbeMark) => void, mark: CoreProbeMark): Promise<void> };

/** The part of the FluxIQ control client the probe dispatches through. */
export type CoreProbeControl = { executeClientAction(sessionId: string, command: Record<string, unknown>, authorizationPin: string): Promise<unknown> };

export type CoreActionProbeInput = {
  /** The start page, in the tab the extension holds as active: the one the recording is about to begin on. */
  page: CoreProbePage;
  control: CoreProbeControl;
  sessionId: string;
  authorizationPin: string;
  /** Publishes one probe event into the run's evidence. */
  publish: (trigger: "runtime.dispatch" | "runtime.settle", summary: string, details: Record<string, unknown>) => Promise<unknown>;
  /** Receives the probe's action timing and Core's result, whatever the result was, before it is judged. */
  record: (timing: RunActionTiming, result: unknown) => void;
};

/** The fields of Core's action result the probe reads. What the page returned rides in `payload` (`ClientGatewayActionResult`). */
type ProbeResult = { status?: unknown; commandId?: unknown; message?: unknown; error?: unknown; payload?: unknown };

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * Proves one Core-issued action reaches the start page, as the file comment
 * describes. Throws `action.dispatch` when Core or the extension does not
 * return a successful result, and `runtime.behavior` when the result is not the
 * page's own mark or the mark cannot be removed afterwards.
 */
export async function proveCoreActionRoundTrip(input: CoreActionProbeInput): Promise<void> {
  const mark = randomBytes(12).toString("hex");
  const correlationId = createCorrelationId("command");
  await input.page.evaluate(applyProbeMark, { attribute: PROBE_MARK_ATTRIBUTE, value: mark });
  const read = await settle(readMarkThroughCore(input, correlationId));
  // Removed whatever the read did, so the recording never starts on a page that carries the probe's mark.
  const removed = await settle(input.page.evaluate(applyProbeMark, { attribute: PROBE_MARK_ATTRIBUTE, value: null }));
  if (!read.ok) throw read.error;
  if (!removed.ok) throw new RunnerFailure("runtime.behavior", "The Core action probe could not remove its mark from the start page", { cause: removed.error });
  const result = read.value;
  const extracted = asRecord(result.payload)?.extracted;
  if (extracted !== mark) {
    // What came back is never quoted: it is whatever some document held, and only that it is not the mark matters.
    const details = { correlationId, commandId: result.commandId, status: result.status, extractedType: typeof extracted };
    await input.publish("runtime.settle", "Core action read did not return the mark planted on the start page", details);
    throw new RunnerFailure("runtime.behavior", "Core action result did not reach page state: the read did not return the mark planted on the start page", { details });
  }
  await input.publish("runtime.settle", "Core action read the mark planted on the start page", { correlationId, commandId: result.commandId, status: result.status });
}

async function readMarkThroughCore(input: CoreActionProbeInput, correlationId: string): Promise<ProbeResult> {
  const command = { actionType: "web.dom.extract", parameters: { selector: "html", extract: { mode: "attribute", attribute: PROBE_MARK_ATTRIBUTE } }, metadata: { correlationId } };
  await input.publish("runtime.dispatch", "Dispatch Core action through the production gateway", { correlationId, actionType: command.actionType, target: command.parameters.selector });
  const startedAt = Date.now();
  const result = resultOf(await input.control.executeClientAction(input.sessionId, command, input.authorizationPin));
  input.record({ actionType: command.actionType, startedAt: new Date(startedAt).toISOString(), durationMs: Math.max(0, Date.now() - startedAt), status: runActionStatus(result?.status) }, result);
  if (result?.status !== "succeeded") {
    await input.publish("runtime.settle", "Core action returned a failed result", { correlationId, commandId: result?.commandId, status: result?.status, message: result?.message ?? result?.error });
    throw new RunnerFailure("action.dispatch", `Core action did not succeed: ${String(result?.status ?? "missing result")}: ${String(result?.message ?? result?.error ?? "no error detail")}`);
  }
  return result;
}

/** Core answers `{ ok, payload: { result } }`; anything else carries no result. */
function resultOf(response: unknown): ProbeResult | undefined {
  const payload = asRecord(response)?.payload;
  return asRecord(asRecord(payload)?.result);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then((value): Settled<T> => ({ ok: true, value }), (error: unknown): Settled<T> => ({ ok: false, error }));
}

/** Runs in the page: sets or removes the mark on the document's root element. */
function applyProbeMark(mark: CoreProbeMark): void {
  const root = (globalThis as unknown as { document: { documentElement: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void } } }).document.documentElement;
  if (mark.value === null) root.removeAttribute(mark.attribute);
  else root.setAttribute(mark.attribute, mark.value);
}
