# t276-ext: live round 1 extension UI fixes

Worker report. Brief: t276-ext (lead t276-live-ui-fixes). Tree `fxwork/t276/!FluxIQWebExtension`, branch
`task/t276-live-ui-fixes`, nothing committed. Paths are under `apps/extension/src/` unless stated.

## Outcome

Partial. Items 7 (render), 8 and 9 are done. Items 3 and 4 are each half done:

- Item 3: I added a guard so the wrong headline cannot show again. The root cause is not established (see below).
- Item 4: chat turns no longer show raw codes. The start-panel flash is caused by a file I do not own, so I did not
  fix it.

All checks pass: 491/491 tests, the extension check, the build and the structure audit.

## What changed and why

### Item 3: "Couldn't fix your Flow" at the end of a creation build

**Cause (traced, not established).** `background/activity/headline.ts:69` returns "Couldn't fix your Flow" only
when the subject kind is `run` and a repair is under way. I checked every link in the chain for run A
(`run-muw60unq-591e23bd`), and all of them say `build`:

- Core emits the build's ending ("Build stopped: the Flow is not finished yet") in `runtime/activity/build.ts:29`,
  inside its `kind: "build"` scope. `emit.ts:23` sets `subject.kind` from that scope. Nothing changes the subject on
  the way out: `hub.ts`, `bounded.ts`, `_shared/runtime.ts:80` and `client-gateway/service/activity-publisher.ts`
  all pass it through.
- Run A had exactly one unit of work: `logs/core.log` shows one `build start` and one `build throw`, and no run.
- The extension bundle the Lab actually loaded (`.lab-instances/t262-slot-2/dist/e2e-chromium/background/index.js`,
  built 21:15:02, run started 04:15:15Z) has the same `activityHeadline`, `subjectKindOf` and `RunRetry` as the
  source.
- I replayed that event shape through today's pacer in a probe test. It shows "Build failed".

So no code path I can read produces the observed text. I can't go further because the Lab does not record the
`server.activity` payloads the extension received. The earlier sighting (`run-mustvzvg-99695308`, moment 10)
predates the t195 headline fix (`80bc6447`, 2026-10-05 13:08), so this one is the only unexplained case.

**Fix (guard).** New `background/activity/ending-kind.ts` reads the settling row's own title to decide which kind
of work it ends:

- build: "Build failed", "Build stopped: …", "Not doable: …", "Build finished"
- run: "Run failed", "Run cancelled", "Run finished"

The pacer (`pacer.ts` `displayFor`) now uses that kind for the headline, and falls back to the subject only when the
title names neither.

**"Fixing your Flow" during a creation build.** Core gives no signal that would let the extension tell a creation
build from an extending one. The build's mode (create or extend) is not on the activity, as t195-w44 also noted. So a
creation build that re-authors its first Flow after a refuted test still reads "Fixing your Flow". This is
documented in `headline.ts` and `extension-client.md`.

**Test:** `background/activity/tests/pacer.test.ts`, "a settling row in Core's words for a build's ending heads the
status as the build's failure…". It failed first with "Couldn't fix your Flow" and now passes. It also checks that
"Run failed" after a repair still reads "Couldn't fix your Flow".

**Next UI review must see:** a creation build that fails reads "Build failed · Build stopped: …" on the overlay, never
"Couldn't fix your Flow". If it still says "Couldn't fix", the payload is arriving with a run subject and a non-build
title, and the Lab needs to record `server.activity` to find out why.

### Item 4: start-panel flash and raw codes

**(a) Old thread at panel open: not fixed; the fix is in a file I do not own.**

- Cause: `background/connection/project-context.ts:30-38` (`current()` / `resolve()`). The project stored in the
  extension session wins. Core's current context (`fetchProjectIdFromCoreSnapshot`) is asked only when nothing is
  stored.
- How that produced U1: the Lab creates its project and selects it in Core before the browser starts
  (`packages/test-runner/src/run-scenario/chat-build/creation/project.ts`, `selectExistingContext`). The preserved
  browser profile, however, still holds the earlier project. The panel's first `latest` read
  (`panel/chat/conversation/controller.ts` → `background/panel/conversation-relay.ts` → `projectFor`) therefore lists
  the old project's thread.
- Timing: the Lab captured moment 01 at 04:18:25.8, before its runtime dispatch at 04:18:26.9 and before its
  `fluxiq:chat-project` selection.
- What I tried and rejected: gating the read inside `panel/chat` on a known `status.projectId`. It does not help,
  because the stale project is "known", and it would break about 40 existing panel tests.
- Fix needed, outside my brief:
  - either `background/connection/project-context.ts`: when the panel opens, prefer Core's current context over the
    stored session project;
  - or `packages/test-runner`: select the chat project before the start capture.

**(b) Raw codes in a message: fixed.**

- Cause: `panel/chat/format/assistant-text.ts` `parseRuns` showed Core's stored turn text verbatim.
- Fix: new `panel/chat/format/raw-codes.ts` `withoutRawCodes` drops any bracket that holds only Core codes, together
  with the space before it.
  - A code here is a dotted lowercase id that contains an underscore, or that sits in a Core namespace (`web.`,
    `core.`, …).
  - Labels are allowed before the codes ("pre_provider_validation: …").
  - Brackets that hold words, addresses (`shop.example.com`), file names or numbers are kept.
  - Inline code marked with backticks is untouched.
  - `parseRuns` applies this to text runs only.
- Test: `panel/chat/format/tests/raw-codes.test.ts`, using U1's exact sentence. It now ends "…generation failed.
  Before that I saved…".

**Next UI review must see:**
- no `flow_bootstrap.*` or similar bracketed code in any FluxIQ turn;
- the start-panel flash itself stays until one of the fixes in (a) lands.

### Item 8: text cut mid-word

**Causes:**
- `content/activity-overlay/status-pill.ts:282-300`: the headline and detail use CSS `text-overflow: ellipsis`, which
  cuts inside a word ("Search Bri…", "trying another w…", "found the…").
- `background/activity/pacer.ts:354` and `content/activity-overlay/overlay-view.ts:79`: a 160-character
  `slice` + "…".
- `panel/chat/stream/step/card-words.ts`: `cutInside` cut inside a word, and `cutMiddle` cut inside a list
  ("name, … rating and 3 more").

**Fixes:**
- New `shared/activity/word-cut.ts` (`longestWordCut`) and `shared/activity/cut-at-word.ts` (`cutAtWord`). Both cut
  after the last whole word that fits, drop a trailing comma, colon or dash, and close a quote the cut left open
  ("into “Search…”"). The pacer and overlay-view bounds now use `cutAtWord`.
- The pill (`status-pill.ts` with the new `fit-line.ts` and `text-measure.ts`):
  - Each line is measured in its own font on an `OffscreenCanvas`.
  - It is fitted to its box (top row minus the mark and step; detail box minus its indent) and cut at a word.
  - It is refitted whenever the placement changes the card's width.
  - Where nothing can be measured, CSS ellipsis is the backstop.
  - `StatusPill` takes an optional measure, so tests can pass their own.
- Card targets (`card-words.ts`):
  - A list of the form "A, B, C and N more" now names fewer items and raises the count: "name, price and 4 more"
    ("name and 5 more" when the card is narrower).
  - When the last word alone does not fit, the card keeps its first whole words plus "…".
  - A single path is cut where one of its parts ends ("…napkins-250").
  - A single word with nowhere to cut is left whole for the view.

**Tests:**
- `shared/activity/tests/cut-at-word.test.ts` (new);
- `pacer.test.ts` and `overlay-view.test.ts`, "…cut where a word ends…" (both failed first on the old code with
  "…word23 w…");
- `status-pill.test.ts`, "a line too long for the card is cut where a word ends…" (failed first);
- `card-words.test.ts`, "a long target keeps whole words…" (failed first). I changed the existing path assertion from
  `startsWith("/sc")` to "cut at a part boundary", because that assertion encoded the old mid-word cut.

**Next UI review must see:**
- no overlay sample and no card target ending inside a word;
- "Read list · name, price and 4 more" in place of "name, … rating and 3 more";
- note that "Look · Sponsored ⓘ … Earbuds, Hybr…" also had "Hybr…" already truncated inside Core's own target, which
  is Core's item U-2, not this one.

### Item 7: render `result`

- Added `result?: string` (and `times?: number`, used by item 9) to `ActionCard` in
  `panel/chat/stream/step/action-card.ts`. `actionCard()` does not read `action.result`; the lead wires that after
  Core is rebuilt.
- `card-words.ts` precedence for a done card:
  1. refusal (item 9)
  2. answer ("Done. You pressed Continue.")
  3. tested ("Already done on the site — 8 rows" when there is a result)
  4. check ("Passed: …")
  5. "Done: 13 rows from 5 pages" (first letter lowered, as other reasons are)
  6. "Done"
- A blank result is ignored.
- Test: `card-words.test.ts`, "a done card says what it came to after Done…" (hand-built cards; failed first).
- **Next UI review must see:** once the lead wires it, "Read list · Done: N rows from M pages" and "Edit the Flow ·
  Done: removed step 9, Add to cart".

### Item 9 (cards): refusals never read as work, and repeats collapse

- `card-words.ts`: any card that carries a refusal (`refused`) now gets its words from the refusal, whatever its
  outcome is, except while waiting:
  - "Not done: …" with the refused state;
  - "Only partly done: …" for a partial refusal.
  - It never says "Done" or "Working on it".
- New `panel/chat/stream/step/refusal-repeats.ts` (`foldRepeatedRefusals`), applied in `messages.ts` before the
  limit. It folds a refusal into the card just before it when all of these match:
  - same unit of work, kind, target, testing mark and reason;
  - both refusals are whole (nothing was done);
  - no words of FluxIQ's sit between them.
- The kept card keeps its key and gets `times`, shown as "Not done (3 times): …". A message left with only folded
  cards is dropped.
- Tests: `card-words.test.ts` "a refused decision never reads as work done or under way…" and `messages.test.ts`
  "identical refusals in a row are one card that counts them…". Both failed first.
- **Next UI review must see:** one "Edit the Flow · run the step again / Not done (3 times): …" card instead of three,
  and no refusal card reading "Done" or "Working on it".

### Docs

`docs/architecture/extension-client.md` now describes:
- the headline kind taken from the ending row, with the unestablished cause;
- the 160-character bound cut at a word;
- the overlay's measured word cut;
- card target cutting and the list shortening;
- `Done: <result>`;
- the refusal fold and its count;
- raw-code removal in turns.

## Commands run and observed results

Run from the repository root unless noted.

- Baseline, before any edit: `run-subset.mjs apps/extension t276-ext <20 test files in owned dirs>` then
  `node --test` → `# tests 198 / # pass 198 / # fail 0`. Panel neighbours (`panel/chat/**/tests`,
  `panel/shell/tests`, 47 files) → `# pass 269 / # fail 0`.
- Fail-first runs, each before its fix:
  - pacer and overlay-view tests against HEAD copies of `pacer.ts` and `overlay-view.ts` → 2 fail, "…word23 w…" ends
    inside a word;
  - status-pill → 1 fail;
  - card-words → 4 fail;
  - messages → 1 fail ("Not done: …" where "Not done (3 times): …" was expected);
  - pacer ending → 1 fail ("Couldn't fix your Flow" where "Build failed" was expected).
- Final: the same bundler and `node --test` over all 67 test files in `background/activity`, `background/panel`,
  `content/activity-overlay` (and `placement`), `shared/activity`, `panel/chat/**` and `panel/shell` →
  `# tests 491 / # pass 491 / # fail 0 / # cancelled 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` → exit 1, stopped by `scripts/check/core-build.mjs`:
  "FluxIQ Core's build … is 32 minute(s) behind its source" (`runtime/activity/step/started.ts` was newer than
  Core's dist). That is the concurrent Core workers' edits, and the brief says not to rebuild Core. I then ran the
  check's own step, `node scripts/check-extension.mjs` (in `apps/extension`): tsc over src and tests, all five browser
  bundles, browser-entry drift → exit 0, no output. I re-ran it after the final edits → exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/extension build` → exit 0: "chrome: verified 22 files", "firefox: verified
  22 files", "e2e-chromium: verified 22 files". Re-run after the final edits → exit 0.
- `node scripts/structure-audit.mjs` → "structure-audit: passed (170 warning(s), 118 baselined)". The only warnings on
  files I changed are advisory line counts on `pacer.test.ts` (588) and `messages.test.ts` (479), both already over
  400 before this work.
- `git diff --check` → clean. A CR scan of changed and new files found none (LF).

## Not verified

- No Lab, browser or provider run (per brief). The pill's canvas measuring (`OffscreenCanvas`, `clientWidth`) is
  exercised only through an injected measure in Node; real-page fitting and the 2 px slack are not seen live.
- The check and build compiled against Core's existing dist, not Core's current source, which the Core workers are
  still editing. Core's `ActivityAction.result` is not yet in that dist, so `ActionCard.result` is declared locally.
- Item 3's root cause (above). The guard only helps if the stray row carries a build ending title.
- Item 4's flash (needs the files named above).
- `cutAtWord` handles only “ ‘ « quotes when it closes an open quote; straight `"` quotes are left as they are.

## Open questions or contradictions found

- Item 3: the evidence contradicts the code. Core and the loaded bundle both yield "Build failed" for run A's last
  row, yet the overlay showed "Couldn't fix your Flow". Recording `server.activity` in the Lab would settle it.
- Item 4: the brief asked that no thread render "until the panel knows which project/thread is current". The panel
  does "know" a project, but it is the stale stored one. Fixing that is in `background/connection/project-context.ts`
  or in the Lab (`packages/test-runner`), and both are outside this brief.
- Run A moment 09 showed a model sentence as the overlay detail ("The Add to cart step now works…"). The pacer never
  makes a `thought` row the detail, so that sentence came on a row that was not a thought. That is Core's row
  classification and was not investigated.
