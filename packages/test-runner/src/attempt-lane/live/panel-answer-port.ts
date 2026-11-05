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
