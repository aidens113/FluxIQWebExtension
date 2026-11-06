import type { ChatBrowserSession } from "../../extension-chat-check/index.js";

const PANEL_PATH = "sidepanel/index.html";
/** The panel reads its thread on a beat of about four seconds (`read-beat.ts` in Core), so an ended attempt's turn and its buttons are given several beats to draw. */
const DRAW_MS = 30_000;
const POLL_MS = 500;

/**
 * Presses Run again on an attempt's answer turn in the panel, as a person does: the real button the
 * turn draws (`packages/ui-components/src/chat/answer/view/foot.ts` in Core), found by its turn and
 * its action, clicked in the panel's own document. It is what tells Core the person asked for it
 * again: no message the Lab could send says so. Throws, naming what it waited for, where the turn or
 * its button never drew or the button stayed disabled.
 */
export async function pressPanelRunAgain(session: Pick<ChatBrowserSession, "panel" | "control">, attemptId: string, drawMs: number = DRAW_MS): Promise<void> {
  const until = Date.now() + drawMs;
  let last = "no turn";
  while (Date.now() < until) {
    const page = session.panel?.page;
    last = page
      ? await page.evaluate(pressInDocument, { attemptId })
      : await session.control.evaluate(pressInDocument, { attemptId, panelPath: PANEL_PATH });
    if (last === "pressed") return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Run again could not be pressed on the answer of ${attemptId}: ${last}`);
}

/** Self-contained, because Playwright serializes it into the panel's page or the control tab. */
function pressInDocument(input: { attemptId: string; panelPath?: string }): "pressed" | "no turn" | "no button" | "disabled" {
  const current = globalThis as unknown as Window & { chrome?: { extension: { getViews(): Window[] } } };
  const panel = input.panelPath === undefined ? current : current.chrome?.extension.getViews().find((view) => view !== (current as Window) && view.location.pathname === `/${input.panelPath}`);
  const turn = panel ? Array.from(panel.document.querySelectorAll<HTMLElement>("li.answer-turn")).find((element) => element.getAttribute("data-attempt-id") === input.attemptId) : undefined;
  if (!turn) return "no turn";
  const button = turn.querySelector<HTMLButtonElement>('button[data-action="run-again"]');
  if (!button) return "no button";
  if (button.disabled) return "disabled";
  button.scrollIntoView({ block: "center" });
  button.click();
  return "pressed";
}
