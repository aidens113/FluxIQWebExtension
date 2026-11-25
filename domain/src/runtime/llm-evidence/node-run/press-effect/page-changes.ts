// What a node call that changes the page in place changed, in the page view's
// own line terms (t174/F37).
//
// A press, a type or a choice answered `ok`, `pageChanged` and the control's
// words, and the page beside them was left for the model to compare with the
// one before. It did not. On `run-muqk4u32-0b36e58f` a press of the colour
// already chosen, `t941 clickable "Space Grey" marked`, un-chose it: after it
// `t939 "Space Grey"` was gone and t941 had lost `marked`, and the model went
// on as though a colour were chosen. Its Add to cart then answered with
// `t968 "Please select a Color."`, the model completed, and the cart stayed
// empty. Each was one line of the page it was shown, among hundreds.
//
// So the outcome says which lines changed, compared by handle from the facts
// the view prints (`../../page-view/line/facts.ts`): a line that gained or lost a
// state token, a text line that appeared, went, or now reads otherwise
// (`t5 "Cart (1)" was "Cart (0)"`). Never
// the raw page: the words are the view's, withheld words already withheld.
//
// Said only where the two pages are the same page: a call that moved the page
// elsewhere changed everything, and the page it left says so. Not for a look,
// a navigation, a read or a replay, none of which change the page in place.
// Read from the one walk (`./change/walk.ts`) the draft statement's change list
// is read from too (`./change/statement.ts`, t285), so the two never disagree.
//
// A line the page changes by itself (`byPage`, `./self-change/`, t1043) is still said,
// since the model should see the page move, but as the page's own -- `(changes by
// itself)` -- and after what the press itself changed, so a carousel's slide or a
// ticker never crowds the press's own changes out of the entries named.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import { quotedWords, type WebLlmLineFact } from "../../page-view";
import type { WebRunnableNode } from "../catalog";
import { webChangeWords, webPageChangeWalk, type WebPageChange, type WebPressMade } from "./change";
import { webIsTextLine as isText } from "./text-line";

/** At most this many changes are named; the rest are counted. */
const MOST_CHANGES = 8;
/** What an entry adds for a line the page changes by itself (header). */
const BY_PAGE = "(changes by itself)";

/**
 * The state tokens a change is said of. A paired state says only where it now
 * stands (`now unchecked`, `now closed`); a lone one says it came or went.
 */
const PAIRED: ReadonlyArray<readonly [string, string]> = [["checked", "unchecked"], ["open", "closed"]];
const LONE: readonly string[] = ["selected", "pressed", "marked", "disabled"];

/**
 * What a call changed on the page it found, as at most nine short entries in
 * page order; `undefined` where it is not said: a node that does not change
 * the page in place, a page missing on either side, a different location, or
 * nothing changed in these terms. `press`: the control a press was made on, so the
 * page's own changes are said as its own (header).
 */
export function webNodePageChanges(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  press?: WebPressMade
): string[] | undefined {
  const changes = webPageChangeWalk(node, before, after, press) ?? [];
  const entries = [...changes.filter((change) => !change.byPage), ...changes.filter((change) => change.byPage)].flatMap((change) => {
    const said = entryOf(change);
    return said === undefined ? [] : [said];
  });
  if (entries.length === 0) return undefined;
  if (entries.length <= MOST_CHANGES) return entries;
  return [...entries.slice(0, MOST_CHANGES), `and ${entries.length - MOST_CHANGES} more changes`];
}

/** The entry for one changed line, or nothing where it is not a change said here: only text and states are. */
function entryOf(change: WebPageChange): string | undefined {
  const by = change.byPage ? ` ${BY_PAGE}` : "";
  if (change.kind === "both") return changed(change.was, change.now, by);
  return isText(change.line) ? entry(change.line, `${change.kind === "went" ? "gone" : "appeared"}${by}`) : undefined;
}

/** A line on both pages: the states it gained or lost, or, for text, the words it now reads. */
function changed(was: WebLlmLineFact, now: WebLlmLineFact, by: string): string | undefined {
  const states = stateChanges(was.tokens, now.tokens);
  if (states.length > 0) {
    // A line whose words went with the change is named by the words it had.
    const named: WebLlmLineFact = now.words === undefined && was.words !== undefined ? { ...now, words: was.words } : now;
    return entry(named, `${states.join(", ")}${by}`);
  }
  if (isText(was) && isText(now) && was.words !== now.words && now.words !== undefined) {
    return entry(now, `${webChangeWords.was(was.words)}${by}`);
  }
  return undefined;
}

function stateChanges(was: readonly string[], now: readonly string[]): string[] {
  const changes: string[] = [];
  for (const pair of PAIRED) {
    const before = pair.find((token) => was.includes(token));
    const after = pair.find((token) => now.includes(token));
    if (after !== undefined && after !== before) changes.push(`now ${after}`);
    else if (after === undefined && before !== undefined) changes.push(`no longer ${before}`);
  }
  for (const token of LONE) {
    const had = was.includes(token);
    const has = now.includes(token);
    if (has && !had) changes.push(`now ${token}`);
    else if (had && !has) changes.push(`no longer ${token}`);
  }
  return changes;
}

/** One entry: the handle, the line's words (or its kind, where it has none) cut to fit, and what changed. */
function entry(line: WebLlmLineFact, what: string): string {
  const words = webChangeWords.quoted(line, what);
  const named = words === undefined ? line.kind : quotedWords(words);
  return [line.handle, named, what].filter((part) => part !== undefined).join(" ");
}
