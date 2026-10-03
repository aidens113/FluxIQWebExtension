// What the page answered a refused press with, quoted (t174-w82, cause 14 of
// `run-murwd8le-79e735a8`).
//
// A press the page refuses (`refused_by_page`) is refused in the page's own
// words, written beside the control: "Please select a Color.", "Network busy,
// please try again", "You have reached the purchase limit for this item.". The
// client concludes the refusal from those words and, deliberately, sends only
// the conclusion (`apps/extension/src/content/action-runtime/results.ts`), so
// the refusal carried the reason code and the words stayed one line among a
// hundred on the page beside it. Live, steps 0020 and 0027 of that run said
// only `page_busy_try_later` and `page_needs_something_first`.
//
// So the refusal quotes them: the text lines the page after the press has that
// the page before it did not, or that now read otherwise, in the view's own
// form (`t968 "Please select a Color."`). They are the view's words
// (`../../page-view/line/facts.ts`), so a word the packet withheld as shaped
// like a secret is quoted withheld, exactly as the page beside it shows it.
//
// This is the one place a refusal's `detail` carries page words. The rule in
// `../../tool-rejection.ts` keeps page text out of a refusal so a refusal
// cannot become a side channel for a page the model was not shown; these words
// are on the page the same refusal carries, printed the same way, so nothing
// reaches the model by this path that it does not already hold.
//
// Said only where both pages are the same page, and only where something was
// written: a notice that stood unchanged from an earlier refusal is not new,
// and nothing here guesses which of the old lines was the answer.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import { quotedWords, webLlmLineFacts } from "../../page-view";
import type { WebLlmToolRejectionCode, WebLlmToolRejectionDetail } from "../../tool-rejection";
import { webIsTextLine } from "./text-line";

/** At most this many lines are quoted: a notice is a line or two, and a press that rewrote the page wrote no single answer. */
const MOST_LINES = 3;

/** A refusal's detail with the page's answer beside its closed reason. */
export type WebNodeNoticedDetail = WebLlmToolRejectionDetail & { notice?: string[] };

/**
 * The text lines `after` gained over `before`, or that now read otherwise, in
 * page order and in the view's own form; `undefined` where there are none, a
 * page is missing, or the two are different pages.
 */
export function webNodePageNotice(before: WebLlmSnapshotBinding | undefined, after: WebLlmSnapshotBinding | undefined): string[] | undefined {
  if (before === undefined || after === undefined || before.evidence.location !== after.evidence.location) return undefined;
  const was = new Map(webLlmLineFacts(before.evidence).map((line) => [line.handle, line.words] as const));
  const written = webLlmLineFacts(after.evidence)
    .filter((line) => webIsTextLine(line) && (!was.has(line.handle) || was.get(line.handle) !== line.words))
    .map((line) => `${line.handle} ${quotedWords(line.words ?? "")}`);
  return written.length === 0 ? undefined : written.slice(0, MOST_LINES);
}

/**
 * The refusal's detail, quoting what the page answered when the page refused
 * the press (`refused_by_page`); every other refusal's detail is left as it is.
 */
export function webNodeNoticedDetail(
  code: WebLlmToolRejectionCode,
  detail: WebLlmToolRejectionDetail | undefined,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined
): WebNodeNoticedDetail | undefined {
  if (code !== "refused_by_page" || detail === undefined) return detail;
  const notice = webNodePageNotice(before, after);
  return notice === undefined ? detail : { ...detail, notice };
}
