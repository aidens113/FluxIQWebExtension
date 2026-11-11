# Judge sees whole looks (F3, F4b)

Worker report. Brief: the answer-first judge must see what a call found, whole (one-row-table.md, sections (b) and (d), F3 and F4b).

## Outcome

Partial. My part is done: F3 is fixed in `call-chain.ts`, and F4b's cuts are removed from `call-chain.ts` and `completion/check.ts`. The question no longer calls a look "a short cut". The third cut, in `flow-less/judged-summary.ts`, stays as it is because another lane owns that file. The exact change for it is below. Until it lands, what the judge model receives is still cut to 600 characters per look, and the question now says looks are whole. Land both changes in one unit.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src/`.

**F3: `framework/automation-service/service/answer-first/attempt/call-chain.ts` (`lookOf`)**
- `lookOf` now hands on what the call found, whole:
  - a search's `found`
  - a single read's value under the domain's declared read key (`readRowsKey`, which is `read.extracted` in the web domain)
  - a described element's `element`
- It uses `page` only when none of those is there. If a call holds more than one, they are joined by newlines.
- A list at the read key is still treated as a list read's rows, never as a look. The existing `said.reads.length > 0` exclusion is unchanged. A list read that kept no rows (an empty array) also falls back to `page`, as before. The summary's `readPages` already reports that read.
- A read value that is not a string (a number, or an object of fields) is passed on as JSON.
- Why: in run-mwbkuxqt-c57f42cb, dom-extract's evidence held the line in `read.extracted`. The page view in its `page` did not hold that line because the element was hidden. describe_element's whole line sat in `element`, a key `lookOf` never read.
- I removed `FOUND_CHARS = 600`, `WHERE_CHARS = 300` and `cut`. I kept `LOOKS_REMEMBERED` (the dedupe memory). I updated the header comment to match.

**F4b: `.../answer-first/completion/check.ts` (`shownLooks`)**
- Removed `FOUND_CHARS`, `WHERE_CHARS` and `cut`. Each distinct look now goes to `judge(summary)` whole: the address and every line, still screened line by line.
- Dedupe is unchanged. `LOOKS_SHOWN = 6` stays: the bound is now a count of distinct looks, not a cut of any look's text. The header and doc comments say so.

**`runtime/result-verification/flow-less/question.ts:18`**
- Changed "each with where it was made and a short cut of what was found, from the site itself" to "each with where it was made and what was found there, whole, from the site itself".
- The new text names no scenario, site or task.

**Tests**
- `attempt/tests/looked.test.ts`:
  - New: "hands on the value a single read returned, whole, not the page after the read". It uses a 970-character single line, which is not in the page view.
  - New: "hands on a described element's words whole".
  - Changed: the page-look test now expects the whole page instead of at most 600 characters.
- `completion/tests/looked-evidence.test.ts`:
  - "shows the latest few distinct looks, none of them cut" now expects the six latest looks exactly, each over 600 characters. I dropped the old `< 5_000` size bound, because it only held because of the cut.
  - New: "gives the judge a long single line a read found whole".
- `runtime/result-verification/flow-less/tests/looked-view.test.ts:54-57`: pins the new question sentence and checks that "short cut" is gone. I added only those lines. Lines 72-78 of that file test `judged-summary.ts`'s cut, so I left them for the owning lane (see below).

The fixtures are a generic saved-folders page, not a realistic scenario.

### Exact change for `runtime/result-verification/flow-less/judged-summary.ts` (not edited, other lane)

```diff
@@ header, line 14
-// (screened and bounded again, `lookedShown`) and, on a repeat the person asked
+// (screened again, the latest distinct ones each whole, `lookedShown`) and, on a repeat the person asked
@@ lines 34-37
-/** The latest looks the judge is shown, and how much of each: the completion check's own bounds (`SVC/answer-first/completion/check.ts`). */
+/** The latest distinct looks the judge is shown, each whole: the completion check's own bound (`SVC/answer-first/completion/check.ts`). */
 const LOOKS_SHOWN = 6;
-const FOUND_CHARS = 600;
-const WHERE_CHARS = 300;
@@ lines 83-87 (lookedShown doc)
- * screened it before, because this is what leaves for the model: the latest few, each cut short, and an
+ * screened it before, because this is what leaves for the model: the latest few, each whole, and an
@@ line 96
-  const shown = looks.slice(-LOOKS_SHOWN).map((look) => ({ where: line(cut(look.where, WHERE_CHARS)), found: cut(look.found, FOUND_CHARS).split("\n").map(line).join("\n") }));
+  const shown = looks.slice(-LOOKS_SHOWN).map((look) => ({ where: line(look.where), found: look.found.split("\n").map(line).join("\n") }));
@@ lines 100-104: delete `cut` (its only caller is line 96)
-/** At most `most` characters, by code point, with `…` where it was cut. */
-function cut(text: string, most: number): string {
-  const characters = [...text];
-  return characters.length <= most ? text : `${characters.slice(0, most - 1).join("")}…`;
-}
```

Its test `flow-less/tests/looked-view.test.ts:72-78` must change with it:

```diff
-  it("shows the latest few, each cut short", async () => {
+  it("shows the latest few, none of them cut", async () => {
     const many = Array.from({ length: 10 }, (_, index) => ({ where: `http://127.0.0.1:5000/bookings/${index}/`, found: `${index} ${"word ".repeat(400)}` }));
     const shown = lookedOf(await sentFor(many))!;
     expect(shown).toHaveLength(6);
     expect(shown[0]!.where).toBe("http://127.0.0.1:5000/bookings/4/");
-    for (const look of shown) expect([...look.found].length).toBeLessThanOrEqual(600);
+    expect(shown.map((look) => look.found)).toEqual(many.slice(-6).map((look) => look.found));
   });
```

I did not check whether the trailing spaces in `"word ".repeat(400)` survive the harness's context packet unchanged. If that assertion fails on whitespace alone, add `.trim()` to the fixture.

## Commands run and observed results

1. From `packages/fluxiq`: `npx vitest run src/framework/automation-service/service/answer-first/attempt src/framework/automation-service/service/answer-first/completion src/runtime/result-verification/flow-less`
   - Printed `Test Files 37 passed (37)`, `Tests 232 passed (232)`, exit 0.
   - The path prefix also matched `attempt-in-flight/` and `attempt-store/`.
   - This run included the parallel worker's uncommitted edits in `attempt/`.
2. Revert check. I copied my `call-chain.ts` and `check.ts` to the scratchpad, wrote the `HEAD` versions over them with `git show HEAD:<path> > <path>` (read-only git), and ran `npx vitest run .../attempt/tests/looked.test.ts .../completion/tests/looked-evidence.test.ts`.
   - Printed `Tests 5 failed | 7 passed (12)`, exit 1.
   - The 5 failures were exactly the new or changed tests: the page whole, the read value whole, the describe words whole, six looks none cut, and the long single line reaching the judge whole.
   - I then restored my versions. `git diff --stat` matched the stat taken before the revert.
3. After adding the question pin: `npx vitest run src/runtime/result-verification/flow-less` printed `Test Files 7 passed (7)`, `Tests 83 passed (83)`, exit 0.
   - An earlier combined run of flow-less, `looked.test.ts` and completion printed `17 passed`, `139 passed`, exit 0.
4. `pnpm --filter fluxiq check` (tsc --noEmit; it writes only its tsbuildinfo cache under node_modules, not dist) exited 0. It printed `{"build-cache":"build","step":"fluxiq:check",...}` with no errors.
5. Core `pnpm structure:check` exited 1 with `2 violation(s)`, both `[directory-files]`:
   - `answer-first/attempt/: 26 source files exceeds the 25-file limit`
   - `answer-first/tests/: 26 source files exceeds the 25-file limit`
   - Neither is mine. Tracked files in each directory number 25. The 26th files are untracked new files from the parallel worker: `attempt/stand-in.ts` and `answer-first/tests/hand-fix.test.ts`. I added no files.

## Not verified

- **The judge model's request.** `judged-summary.ts` still cuts each look to 600 characters there, so no test proves the whole line reaches the model. My tests prove it reaches `judge(summary).looked`, the boundary I own.
- **A single test from read to judge.** No one test runs a read through the chain and on to the judge. Two unit tests cover the two halves: chain to look, and look to `judge(summary)`. Both fail with the fix reverted. A composed test would belong in `answer-first/tests/`, which is not in my owned paths.
- **Live behaviour.** Not tested. No Lab run, no build, as the brief required.
- **Size of whole page looks.** A look that falls back to `page` is now a whole page view, up to 6 of them.
  - The purse's judge hold counts the summary's size (`check.ts:241`).
  - I found no request size cap in the harness (`runtime/llm/harness/request-evidence-check.ts` only screens).
  - I did not measure a real summary's size.

## Open questions or contradictions found

1. **The domain does not declare the look keys.** The report's F3 fix says to add the declaration to the runtime contract. That needs edits outside my paths:
   - `domain/src/runtime/llm-evidence/runtime-contract/runtime.ts` and `tools.ts`
   - Core's binding type
   - `attempt/run-attempt.ts`, to pass the declaration to the chain

   For now the read value comes from the declared `readRowsKey`. `found`, `element` and `page` are Core constants naming the web domain's answer keys, as `found` and `page` already were. To finish F3 fully, add something like `lookedKeys: readonly string[]` (`["found", "element"]`) to the domain contract and pass it through.
2. **Two other cuts remain.**
   - `runtime/result-verification/flow-less/read-pages-shown.ts:38` cuts a read's `leftOut` words to 200 characters for the judge. That was outside this brief.
   - The domain's search cut (F4a, `page-find/search.ts`) still truncates what `found` holds at the source.
3. **The question and the sent copy disagree** until `judged-summary.ts` changes. Land both together.

```text
Outcome: Partial
Changed: packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/call-chain.ts, .../attempt/tests/looked.test.ts, .../answer-first/completion/check.ts, .../completion/tests/looked-evidence.test.ts, packages/fluxiq/src/runtime/result-verification/flow-less/question.ts, .../flow-less/tests/looked-view.test.ts (all under C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ)
Validation: vitest over attempt, completion, flow-less -> 37 files, 232 tests passed, exit 0; fix reverted -> the 5 new or changed tests failed, exit 1; `pnpm --filter fluxiq check` -> exit 0; `pnpm structure:check` -> exit 1, 2 directory-files violations from the parallel worker's untracked files only
Not verified: the judge model's request is still cut by judged-summary.ts (not mine); no live run; no single test from read to judge (two unit halves instead)
Report: C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQWebExtension/docs/working/mvp-seal-plan/reports/live-checks-r3/judge-whole-looks.md
Notes: The exact judged-summary.ts and looked-view.test.ts:72-78 change is in the report; land it together with this.
The domain declaration of look keys (found, element) is still needed for a full F3 and touches domain and Core binding files.
```
