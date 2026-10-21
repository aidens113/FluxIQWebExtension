// One action over one snapshot: load the snapshot in a fresh sandbox, wait for
// the content code to announce itself, hand it the action exactly as the
// background hands it to a tab (`SnapshotContentCode.actionMessage`, the
// background's own builder), and return its result with what the sandbox saw.
//
// A DOM read goes to the tab as that one message: the background's only
// continuation loop is a Next-page press that loads another document
// (`apps/extension/src/runtime/next-page-continuation.ts`), which a snapshot
// cannot load; offline the content code's navigation is held instead and
// counted. An action addressed to a child frame is not run: the snapshot holds
// the top document, and a frame's document only as a resource.

import type { Browser } from "@playwright/test";
import type { WebAutomationActionCommand, WebAutomationActionResult, WebPageSnapshot, WebSnapshotPageEvaluation } from "@fluxiq-web-extension/domain/node";
import { contentWorldSource } from "./content-world-source.js";
import { openSnapshotSandbox, type SnapshotSandbox } from "./open-snapshot-sandbox.js";
import type { SandboxDelivery } from "./sandbox-runtime-stub.js";
import { snapshotCanaries } from "./canaries.js";
import type { SnapshotContentCode } from "./page-options.js";
import { snapshotRoutes } from "./routes.js";

/** How long the content code may take to announce itself once the snapshot has loaded. */
const READY_WITHIN_MS = 5_000;
const READY_POLL_MS = 100;
/** A read with no timeout of its own is given the content code's default; the answer may take this much longer. */
const DEFAULT_ACTION_MS = 30_000;
const ANSWER_MARGIN_MS = 30_000;

export async function evaluateOverSnapshot(
  browser: () => Promise<Browser>,
  content: SnapshotContentCode,
  snapshot: WebPageSnapshot,
  action: WebAutomationActionCommand
): Promise<WebSnapshotPageEvaluation> {
  if ((typeof action.frameId === "number" && action.frameId !== 0) || action.frameUrlPath !== undefined) {
    return unavailable("the action is addressed to a child frame, and the snapshot holds the top document only");
  }
  const routes = snapshotRoutes(snapshot, snapshotCanaries.arm);
  if (routes.status === "unavailable") return unavailable(routes.detail);
  const world = contentWorldSource(content.contentScript);
  const sandbox = await openSnapshotSandbox(await browser(), routes.answer, world, content.pageWorldScript);
  try {
    const notLoaded = await sandbox.load(snapshot.url);
    if (notLoaded !== undefined) return unavailable(notLoaded);
    if (!await contentCodeStarted(sandbox, world.harnessGlobal)) return unavailable("the content code did not start in the snapshot page");
    const message = content.actionMessage(action, action.frameId === 0 ? 0 : undefined);
    const delivered = sandbox.inContentWorld(`window[${JSON.stringify(world.harnessGlobal)}].deliver(${JSON.stringify(message)})`)
      .then((value) => value as SandboxDelivery, (error: unknown) => (error instanceof Error ? error.message : String(error)));
    const delivery = await answerWithin(delivered, answerBudget(action));
    if (delivery === "timed_out") return unavailable(`the content code did not answer ${action.actionType} within ${answerBudget(action)} ms`);
    if (typeof delivery === "string") return unavailable(`the content code failed on ${action.actionType}: ${delivery.split("\n")[0]}`);
    const { responded, response } = delivery;
    if (!responded) return unavailable(`the content code did not answer ${action.actionType}`);
    const scrolls = await sandbox.inContentWorld(`window[${JSON.stringify(world.scrollGlobal)}]?.pastEnd ?? 0`);
    return { status: "evaluated", result: response as WebAutomationActionResult, observations: await sandbox.observations(Number(scrolls) || 0) };
  } finally {
    await sandbox.close();
  }
}

async function contentCodeStarted(sandbox: SnapshotSandbox, harnessGlobal: string): Promise<boolean> {
  const announced = `(window[${JSON.stringify(harnessGlobal)}]?.sent ?? []).some((message) => message && message.type === "fluxiq.contentReady")`;
  for (let waited = 0; waited <= READY_WITHIN_MS; waited += READY_POLL_MS) {
    const ready = await sandbox.inContentWorld(announced).catch((error: unknown) => (error instanceof Error && /isolated world was not created/u.test(error.message) ? false : Promise.reject(error)));
    if (ready === true) return true;
    await sandbox.wait(READY_POLL_MS);
  }
  return false;
}

function answerBudget(action: WebAutomationActionCommand): number {
  const own = typeof action.timeoutMs === "number" && Number.isFinite(action.timeoutMs) && action.timeoutMs > 0 ? action.timeoutMs : DEFAULT_ACTION_MS;
  return own + ANSWER_MARGIN_MS;
}

async function answerWithin<T>(promise: Promise<T>, ms: number): Promise<T | "timed_out"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<"timed_out">((resolve) => {
    timer = setTimeout(() => resolve("timed_out"), ms);
  });
  try {
    return await Promise.race([promise, stalled]);
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(detail: string): WebSnapshotPageEvaluation {
  return { status: "unavailable", reason: "snapshot_unavailable", detail };
}
