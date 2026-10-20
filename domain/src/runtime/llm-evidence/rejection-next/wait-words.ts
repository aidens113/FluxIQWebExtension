// What a refusal's `next` adds when the site refused a press for now (t741 C1b,
// job-board `run-mvgo9wzn-fad4e050` step 0116): the wait the site asked for,
// in whole seconds rounded up so the model never comes back early, and that
// the tab was taken back to the page the press was made on, so what the press
// had opened is closed again. Read off two facts the extension wrote as fields
// (`retryAfterMs`, a confirmed return), never off the page's words. Generic:
// it names no site, control or page.

/** `next`, followed by the site's wait and the tab's return where either is known (header). */
export function webLlmRejectionNextWithWait(next: string | undefined, retryAfterMs: number | undefined, tabReturned: true | undefined): string | undefined {
  const words: string[] = [];
  if (retryAfterMs !== undefined) {
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    words.push(`The site asked to wait ${seconds} ${seconds === 1 ? "second" : "seconds"} before this is made again.`);
  }
  if (tabReturned) words.push("The tab was taken back to the page it showed before the press, so anything the press had opened, such as a menu, is closed again.");
  if (words.length === 0) return next;
  return next === undefined ? words.join(" ") : `${next} ${words.join(" ")}`;
}
