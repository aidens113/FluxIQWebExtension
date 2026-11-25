import { shortenChartText } from "../shorten-chart-text.js";

/**
 * What the completion check said, in plain words with its reason code: accepted, held unconfirmed (with the evidence it
 * could not read, where it names it), refused, or refused unchecked because nothing new had been offered. The check's own
 * first sentence follows where it gave one.
 */
export function completionOutcomeWords(code: string, instruction: string | undefined): string[] {
  const unread = /evidence Core could not read: (.*?)\. Only/su.exec(instruction ?? "")?.[1];
  const said = instruction === undefined ? undefined : /^(.*?[.!?])(?:\s|$)/su.exec(instruction)?.[1];
  if (code === "answer_first.judged_yes") return [`check: accepted (${code})`];
  if (code === "answer_first.judged_unsure") return [`check: held unconfirmed (${code})`, ...(unread ? [`could not read: ${unread}`] : [])];
  if (code === "answer_first.same_evidence") return [`check: refused without being checked, nothing new since the last no (${code})`];
  if (code === "answer_first.judged_no") return [`check: refused, it said no (${code})`, ...(said ? [`it said: ${shortenChartText(said, 200)}`] : [])];
  return [`check: refused (${code})`, ...(said ? [`reason: ${shortenChartText(said, 200)}`] : [])];
}
