import path from "node:path";
import type { ChatCheckContext } from "../../types.js";
import { streamOpenedAfter, type StreamOpening } from "./push-evidence.js";

const STREAM_PATH = "/api/panel/changes";
const SETTLE_BOUND_MS = 60_000;
const REOPEN_BOUND_MS = 90_000;
const CHANGE_BOUND_MS = 60_000;
const MARK = "__panelStreamProofMark";

export type PanelStreamObservation = { openingsBeforeRestart: number; openingsAfterRestart: number; caughtUpAfterReopen: boolean; changeShownAfterMs: number | null };

/** A signed-in panel page held open on one chat's own page, recording every answer to its change stream. */
export type HeldPanelPage = {
  /** Waits for the panel's own change stream to open and the chat to show `knownText`, a turn it already holds. */
  settled(knownText: string): Promise<void>;
  /**
   * After Core restarted at `restartedAt`: waits for the page's stream to reopen by itself and the page to show `caughtUpText`
   * (a turn made while the stream was down), makes `change` (a turn written into this chat, carrying `changeText`), and waits
   * for the page to show `changeText`. Nothing reloads or navigates the page, so what it shows came over its change stream.
   */
  proveReconnect(restartedAt: number, input: { caughtUpText: string; changeText: string; change: () => Promise<void> }): Promise<{ observation: PanelStreamObservation; checks: Record<string, boolean> }>;
  close(): Promise<void>;
};

/**
 * Opens one chat as the web panel's own page, signed in as the person, and leaves it open. The page is never navigated
 * or reloaded afterwards, and its own marker and navigation count say whether anything reloaded it.
 */
export async function holdPanelChatPage(context: ChatCheckContext, input: { fluxiqOrigin: string; cookie: string; conversationId: string }): Promise<HeldPanelPage> {
  await context.session.context.addCookies([{ name: "fluxiq_session", value: input.cookie, url: input.fluxiqOrigin, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.session.context.newPage();
  const openings: StreamOpening[] = [];
  let navigations = 0;
  page.on("response", (response) => { if (new URL(response.url()).pathname === STREAM_PATH) openings.push({ at: Date.now(), status: response.status() }); });
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations += 1; });
  const address = `${input.fluxiqOrigin}/chats/${encodeURIComponent(input.conversationId)}?project=${encodeURIComponent(context.projectId)}`;
  await page.goto(address, { waitUntil: "domcontentloaded" });
  const shows = (text: string, timeoutMs: number): Promise<boolean> => page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => true, () => false);
  return {
    async settled(knownText) {
      if (!await shows(knownText, SETTLE_BOUND_MS)) throw new Error(`The held panel page never showed the chat's turn ${JSON.stringify(knownText.slice(0, 60))}`);
      const deadline = Date.now() + SETTLE_BOUND_MS;
      while (!openings.some((opening) => opening.status === 200) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
      await page.evaluate((key) => { (globalThis as unknown as Record<string, unknown>)[key] = true; }, MARK);
      navigations = 0;
    },
    async proveReconnect(restartedAt, { caughtUpText, changeText, change }) {
      const deadline = Date.now() + REOPEN_BOUND_MS;
      while (!streamOpenedAfter(openings, restartedAt) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
      const reopened = streamOpenedAfter(openings, restartedAt);
      context.log(`[chat-check] stream proof: panel page ${reopened ? "reopened" : "never reopened"} its change stream after the restart`);
      const caughtUp = await shows(caughtUpText, CHANGE_BOUND_MS);
      const wroteAt = Date.now();
      await change();
      const shown = await shows(changeText, CHANGE_BOUND_MS);
      const shownAfterMs = shown ? Date.now() - wroteAt : null;
      context.log(`[chat-check] stream proof: the page ${caughtUp ? "caught up with" : "missed"} the turn made while the stream was down, and ${shown ? `showed the turn written after it in ${shownAfterMs} ms` : "never showed the turn written after it"}`);
      const marked = await page.evaluate((key) => (globalThis as unknown as Record<string, unknown>)[key] === true, MARK).catch(() => false);
      await page.screenshot({ path: path.join(context.evidence.directory, "panel-stream-reconnect-page.png"), timeout: 10_000 }).catch(/* best-effort: a screenshot is evidence beside the checks, never one of them */ () => undefined);
      return {
        observation: { openingsBeforeRestart: openings.filter((opening) => opening.at <= restartedAt).length, openingsAfterRestart: openings.filter((opening) => opening.at > restartedAt).length, caughtUpAfterReopen: caughtUp, changeShownAfterMs: shownAfterMs },
        checks: {
          "panelStream:openedBeforeRestart": openings.some((opening) => opening.status === 200 && opening.at <= restartedAt),
          "panelStream:reopenedAfterRestart": reopened,
          "panelStream:caughtUpAfterReopen": caughtUp,
          "panelStream:showedChangeMadeAfterRestart": shown,
          "panelStream:pageWasNotReloaded": marked && navigations === 0,
        },
      };
    },
    close: () => page.close(),
  };
}
