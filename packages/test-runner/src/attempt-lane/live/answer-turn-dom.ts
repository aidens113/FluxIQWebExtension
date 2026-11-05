/** The answer turn as it stands in the panel's DOM: only what a person can read. */
export type AnswerTurnDom = {
  attemptId: string;
  kind: string;
  headline: string;
  columns: string[];
  rows: string[][];
  /** The lines under what it did on the site, one per lasting act, or one that says nothing changed. */
  siteTitle: string | null;
  siteLines: string[];
  note: string | null;
  text: string | null;
  /** How the turn stands on screen: the element has a box. */
  visible: boolean;
};

/**
 * Reads the attempt's answer turn out of a document, after opening "Show all" so every
 * row it holds is on screen as a person would open it. Self-contained, because
 * Playwright serializes it into the panel's own page or the control tab; `null` when
 * the turn is not there. The view keeps a turn per attempt
 * (`packages/ui-components/src/chat/answer/view/answer-view.ts` in Core).
 */
export function readAnswerTurnInDocument(input: { attemptId: string; panelPath?: string }): AnswerTurnDom | null {
  const current = globalThis as unknown as Window & { chrome?: { extension: { getViews(): Window[] } } };
  const panel = input.panelPath === undefined ? current : current.chrome?.extension.getViews().find((view) => view !== (current as Window) && view.location.pathname === `/${input.panelPath}`);
  if (!panel) return null;
  const turn = Array.from(panel.document.querySelectorAll<HTMLElement>("li.answer-turn")).find((element) => element.getAttribute("data-attempt-id") === input.attemptId);
  if (!turn) return null;
  const toggle = turn.querySelector<HTMLButtonElement>('button[data-action="toggle-rows"]');
  if (toggle && toggle.getAttribute("aria-expanded") === "false") toggle.click();
  const words = (element: Element | null | undefined): string | null => element?.textContent?.trim() || null;
  const box = turn.getBoundingClientRect();
  return {
    attemptId: input.attemptId,
    kind: turn.getAttribute("data-kind") ?? "",
    headline: words(turn.querySelector(".answer-headline")) ?? "",
    columns: Array.from(turn.querySelectorAll(".answer-table thead th")).map((cell) => cell.textContent ?? ""),
    rows: Array.from(turn.querySelectorAll(".answer-table tbody tr")).map((row) => Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent ?? "")),
    siteTitle: words(turn.querySelector(".answer-site > .answer-line")),
    siteLines: Array.from(turn.querySelectorAll(".answer-site-list li")).map((line) => line.textContent ?? ""),
    note: words(turn.querySelector(".answer-note")),
    text: words(turn.querySelector(".answer-text-body")),
    visible: box.width > 0 && box.height > 0,
  };
}
