// The words a change entry quotes, cut to fit: one rule for the outcome's
// entry (`../page-changes.ts`) and the draft statement's
// (`./statement.ts`), so a line the statement states is quoted in the
// very words the outcome showed.

import { quotedWords, type WebLlmLineFact } from "../../../page-view";

/** About how long one entry may be; the line's words are cut to fit. */
const ENTRY_LENGTH = 120;
/** The fewest characters of words an entry keeps, however long the rest of it is. */
const LEAST_WORDS = 24;

/** How a change entry quotes a line's words. */
export const webChangeWords = {
  /** The line's words as the entry for it quotes them beside `what`, cut to fit; `undefined` for a line with none. */
  quoted(line: WebLlmLineFact, what: string): string | undefined {
    if (line.words === undefined) return undefined;
    const fixed = `${line.handle}  ${what}`.length;
    return cut(line.words, Math.max(LEAST_WORDS, ENTRY_LENGTH - fixed - 2));
  },
  /** What an entry says of a line whose words now read otherwise: the words it had, cut to the fewest kept. */
  was(words: string | undefined): string {
    return `was ${quotedWords(cut(words ?? "", LEAST_WORDS))}`;
  }
} as const;

function cut(words: string, most: number): string {
  return words.length <= most ? words : `${words.slice(0, most - 1)}…`;
}
