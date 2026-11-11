import type { ChatBrowserSession } from "../../extension-chat-check/index.js";
import type { ChatAnswerPort, ShownAnswer } from "../../flow-lane/index.js";
import { readAnswerTurnInDocument, type AnswerTurnDom } from "./answer-turn-dom.js";
import { shownAnswerOfDom } from "./shown-answer.js";

const PANEL_PATH = "sidepanel/index.html";
/** The panel reads its thread on a beat of about four seconds (`read-beat.ts` in Core), so an ended attempt's turn is given several beats to draw. */
const DRAW_MS = 30_000;
const POLL_MS = 500;

/** The attempt's answer turn as the panel holds it now, through whichever way this session reaches the panel. */
export async function readPanelAnswerTurn(session: Pick<ChatBrowserSession, "panel" | "control">, attemptId: string): Promise<AnswerTurnDom | null> {
  const page = session.panel?.page;
  return page
    ? await page.evaluate(readAnswerTurnInDocument, { attemptId })
    : await session.control.evaluate(readAnswerTurnInDocument, { attemptId, panelPath: PANEL_PATH });
}

/**
 * The attempt's answer turn once the panel has drawn it, and how long that took; `null` and the whole wait where it drew
 * none within `drawMs` (t897). The panel reads its thread on its own beat, so a turn draws a few seconds after its attempt
 * ends: read at once, every replay's turn of `run-mwbadi79-d928f922` read as none, while attempt 1's, read through the
 * port below, had waited for it.
 */
export async function awaitPanelAnswerTurn(session: Pick<ChatBrowserSession, "panel" | "control">, attemptId: string, drawMs: number = DRAW_MS): Promise<{ dom: AnswerTurnDom | null; drawnAfterMs: number | null; waitedMs: number }> {
  const started = Date.now();
  for (;;) {
    const dom = await readPanelAnswerTurn(session, attemptId);
    const waitedMs = Date.now() - started;
    if (dom !== null && dom.kind !== "") return { dom, drawnAfterMs: waitedMs, waitedMs };
    if (waitedMs >= drawMs) return { dom, drawnAfterMs: null, waitedMs };
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/**
 * The real chat's answer port: the turn the person reads, out of the panel's DOM, and
 * never from the route, so a right answer that never reached them fails. It waits a few
 * of the panel's read beats for a turn to draw, then says there is none. `columnIds`
 * maps the labels the panel prints to the ids the oracle keys by, and is read from the
 * attempt's record because the DOM holds only labels.
 */
export function panelAnswerPort(input: { session: Pick<ChatBrowserSession, "panel" | "control">; attemptId: string; columnIds: ReadonlyMap<string, string>; drawMs?: number; onRead?: (dom: AnswerTurnDom | null) => void }): ChatAnswerPort {
  return {
    readShownAnswer: async (): Promise<ShownAnswer | null> => {
      const deadline = Date.now() + (input.drawMs ?? DRAW_MS);
      for (;;) {
        const dom = await readPanelAnswerTurn(input.session, input.attemptId);
        if ((dom !== null && dom.kind !== "") || Date.now() >= deadline) {
          input.onRead?.(dom);
          return shownAnswerOfDom(dom, input.columnIds);
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    },
  };
}
