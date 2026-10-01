import { writeFile } from "node:fs/promises";
import type { BrowserContext, CDPSession, Page } from "@playwright/test";
import { screenText } from "../extension-start-trace/index.js";
import { PanelTargetSession } from "./panel-target-session.js";
import { screenLocation } from "./screen-location.js";
import type { UiReviewCapture } from "./types.js";
import { withTimeout } from "./with-timeout.js";

export type ExtensionPanelCaptureInput = { context: BrowserContext; controlPage: Page; path: string; file: string; secrets: readonly string[]; timeoutMs: number };

const PANEL_PATH = "/sidepanel/index.html";
/** The panel's approval-code element (`apps/extension/src/panel/getting-started/start-view.ts`). */
const PAIRING_CODE = "#pairingReferenceCode";
const MASK_ATTRIBUTE = "data-fluxiq-lab-ui-review-mask";

// The panel's rendered text, and the pairing code it shows, if any: only a code element with a box on screen is shown (the pairing
// card stays in the document, hidden, after pairing, which the first validation run took for a code on screen). Read-only.
const PANEL_TEXT = `(() => { const el = document.querySelector(${JSON.stringify(PAIRING_CODE)}); const r = el ? el.getBoundingClientRect() : null;
  const rendered = !!el && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  return { text: document.body ? document.body.innerText : "", code: rendered ? (el.textContent || "").trim() : "" }; })()`;
// Blacks out the pairing code in the side panel, which has no Playwright mask; removed straight after the picture.
const MASK_ON = `(() => { let n = 0; for (const el of document.querySelectorAll(${JSON.stringify(PAIRING_CODE)})) { const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const box = document.createElement("div"); box.setAttribute(${JSON.stringify(MASK_ATTRIBUTE)}, ""); box.style.cssText = "position:fixed;left:" + (r.left - 4) + "px;top:" + (r.top - 4) + "px;width:" + (r.width + 8) + "px;height:" + (r.height + 8) + "px;background:#000;z-index:2147483647;pointer-events:none"; document.documentElement.append(box); n += 1; } return n; })()`;
const MASK_OFF = `(() => { for (const box of document.querySelectorAll("[${MASK_ATTRIBUTE}]")) box.remove(); return true; })()`;

type PanelText = { text: string; code: string };

/**
 * Photographs the extension panel the person watching a headed run sees.
 *
 * In order: a panel page Playwright holds other than the control page (the
 * docked popup, or the side panel if Playwright exposes it); else the real
 * side panel through its own DevTools target, which Playwright does not hand
 * out as a page; else the control page, which is the same panel document in a
 * background tab, and is said to be what was captured. `source` names which.
 *
 * The pairing approval code is blacked out wherever it is shown. A picture is
 * withheld when the code also appears elsewhere in the panel's text, when a
 * run secret does, or when the code could not be masked. It never throws.
 */
export async function captureExtensionPanel(input: ExtensionPanelCaptureInput): Promise<UiReviewCapture> {
  const started = Date.now();
  const done = (capture: UiReviewCapture): UiReviewCapture => ({ ...capture, ms: Date.now() - started });
  try {
    const held = input.context.pages().find(page => page !== input.controlPage && !page.isClosed() && page.url().includes(PANEL_PATH));
    if (held) return done(await capturePanelPage(held, await heldPanelSource(held, input.timeoutMs), input));
    const target = await capturePanelTarget(input);
    if (target) return done(target);
    return done(await capturePanelPage(input.controlPage, "control-page", input));
  } catch (error) {
    return done({ source: "unknown", error: screenText(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error), input.secrets) });
  }
}

/** A panel page in a tab is the docked popup; one in no tab is the side panel. */
async function heldPanelSource(page: Page, timeoutMs: number): Promise<string> {
  const inTab = await withTimeout(page.evaluate(async () => Boolean(await (globalThis as any).chrome?.tabs?.getCurrent?.())), timeoutMs, "the panel's tab").catch((error: unknown) => `unknown (${error instanceof Error ? error.message : String(error)})`);
  return inTab === true ? "popup" : inTab === false ? "side-panel" : `panel-page ${inTab}`;
}

async function capturePanelPage(page: Page, source: string, input: ExtensionPanelCaptureInput): Promise<UiReviewCapture> {
  const base: UiReviewCapture = { source, location: screenLocation(page.url(), input.secrets) };
  try {
    const shown = await withTimeout(page.evaluate(PANEL_TEXT) as Promise<PanelText>, input.timeoutMs, "the panel's text");
    const refusal = withholding(shown, input.secrets);
    if (refusal) return { ...base, withheld: refusal };
    const code = page.locator(PAIRING_CODE);
    const masked = shown.code ? await code.count() : 0;
    await page.screenshot({ path: input.path, timeout: input.timeoutMs, caret: "initial", animations: "allow", ...(masked > 0 ? { mask: [code], maskColor: "#000000" } : {}) });
    return { ...base, file: input.file, masked };
  } catch (error) {
    return { ...base, error: screenText(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error), input.secrets) };
  }
}

/** The real side panel, through its DevTools target; `undefined` when no such target is open. */
async function capturePanelTarget(input: ExtensionPanelCaptureInput): Promise<UiReviewCapture | undefined> {
  const cdp: CDPSession = await input.context.newCDPSession(input.controlPage);
  try {
    const own = await withTimeout(cdp.send("Target.getTargetInfo"), input.timeoutMs, "the control page's target") as { targetInfo: { targetId: string } };
    const { targetInfos } = await withTimeout(cdp.send("Target.getTargets"), input.timeoutMs, "the browser's targets") as { targetInfos: Array<{ targetId: string; type: string; url: string }> };
    const panel = targetInfos.find(info => info.targetId !== own.targetInfo.targetId && info.type !== "service_worker" && info.url.includes(PANEL_PATH));
    if (!panel) return undefined;
    const base: UiReviewCapture = { source: `side-panel (devtools target, type ${panel.type})`, location: screenLocation(panel.url, input.secrets) };
    const session = await PanelTargetSession.open(cdp, panel.targetId, input.timeoutMs);
    try {
      const evaluated = await session.send("Runtime.evaluate", { expression: PANEL_TEXT, returnByValue: true }, input.timeoutMs);
      const shown = evaluated?.result?.value as PanelText | undefined;
      if (!shown || typeof shown.text !== "string") return { ...base, withheld: "the side panel's text could not be read, so it could not be screened" };
      const refusal = withholding(shown, input.secrets);
      if (refusal) return { ...base, withheld: refusal };
      const maskResult = shown.code ? await session.send("Runtime.evaluate", { expression: MASK_ON, returnByValue: true }, input.timeoutMs) : undefined;
      const masked = typeof maskResult?.result?.value === "number" ? maskResult.result.value as number : 0;
      if (shown.code && masked === 0) return { ...base, withheld: "the pairing code is shown and could not be masked" };
      try {
        const shot = await session.send("Page.captureScreenshot", { format: "png" }, input.timeoutMs) as { data?: string };
        if (typeof shot?.data !== "string") return { ...base, error: "Page.captureScreenshot returned no image" };
        await writeFile(input.path, Buffer.from(shot.data, "base64"));
        return { ...base, file: input.file, masked };
      } finally {
        if (masked > 0) await session.send("Runtime.evaluate", { expression: MASK_OFF, returnByValue: true }, input.timeoutMs);
      }
    } finally {
      await session.close();
    }
  } finally {
    await cdp.detach();
  }
}

/** Why a panel picture may not be kept, or `undefined` when it may. */
function withholding(shown: PanelText, secrets: readonly string[]): string | undefined {
  if (secrets.some(secret => secret.length > 0 && shown.text.includes(secret))) return "a run secret is shown in the panel";
  if (shown.code.length >= 4 && shown.text.split(shown.code).length - 1 > 1) return "the pairing code is shown outside the region that is masked";
  return undefined;
}
