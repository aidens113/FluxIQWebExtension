// A read refused because its list is not on the page it read says which list it
// is and where it was made (t1022).
//
// The reason is t1013's `list_not_on_page`, which until now only a Next page
// was refused for, and whose `next` speaks of pressing. A read is refused for it
// when its saved list does not stand on the page it ran on
// (`../plan-resolution/extraction/list-stands.ts`): its rows were another page's
// elements its selector matched, and none is kept. The page the list was
// detected on rides in `instead` as `web.list.made_on:<path>`, its address path
// and nothing else -- an address this domain's own binding holds, never a word
// of the page -- so a repeat of the refusal, which passes `instead` back
// (`../repeated-refusal.ts`), says the same.

/** The prefix the list's own page rides under in `instead`. */
const MADE_ON_CODE = "web.list.made_on:";

/** The longest path told; a longer one is left off, and the sentence says "its own page". */
const MAX_PATH = 200;

/** A path as told: an address path of plain URL characters, never words. */
const PATH = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/u;

export const webLlmListMadeOn = {
  /** The code for the page the list was detected on, or none where its address has no path to tell. */
  code(madeAt: string): string[] {
    if (!URL.canParse(madeAt)) return [];
    const path = new URL(madeAt).pathname;
    return path.length <= MAX_PATH && PATH.test(path) ? [`${MADE_ON_CODE}${path}`] : [];
  },
  /** Whether `instead` says a read was refused, rather than a Next page. */
  isRead(instead: readonly string[] | undefined): boolean {
    return (instead ?? []).some((code) => code.startsWith(MADE_ON_CODE));
  },
  /** What to do after a read whose list `target` is not on this page (header). */
  next(target: string | undefined, instead: readonly string[] | undefined): string {
    const path = (instead ?? []).map((code) => code.startsWith(MADE_ON_CODE) ? code.slice(MADE_ON_CODE.length) : undefined).find((found) => found !== undefined && PATH.test(found));
    const list = target === undefined ? "the list this read names" : `the list ${target}`;
    const where = path === undefined ? "its own page" : `the page it was detected on (${path})`;
    return `Nothing was kept: ${list} is not on this page, so the rows the read found here belong to another list. `
      + `Go back to ${where} and read it there; or, for a list this page shows, detect it here and read it by the handle that detection issues.`;
  }
};
