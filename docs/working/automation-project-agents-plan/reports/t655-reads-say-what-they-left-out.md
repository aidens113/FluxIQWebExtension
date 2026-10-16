# t655 reads-say-what-they-left-out: worker report

## Outcome

Partial. Part B is done end to end. Part A is done in every file the brief
gave me, and its tests pass. But on a real run nothing will send the new
rows yet, because the producers are outside my files (see "Open questions").

- **Part A (rows left out by two or more conditions).**
  - The domain's replayed read now lists such rows (`readRows.leftOutTogether`).
  - Core's read-account contract and reader carry them.
  - t654's completeness test now counts them.
  - t631's joint-exclusion guard now uses them.
  - The gap: a playback read, and today's replay too, asks the page for each
    condition's alone rows only. The page then cuts every other rejected row
    before it leaves the browser, and Core's extraction-summary admission does
    not take the new member. Until those files change, real reads carry no
    such rows, and t654's test behaves as before.
- **Part B (what a narrowing step left out).**
  - The domain's snapshot summary now carries `groups` and `resultCount`.
  - Core's narrowing step carries `group`, `chose`, `leftOptions` and
    `resultCount`.
  - The agreement marks a narrowing doubt and asks that call once more.

## What changed and why

### Part A, downstream (`C:/Users/osrs_/FluxStuff/fxwork/t655/!FluxIQWebExtension`)

- **New `domain/src/runtime/llm-evidence/node-run/left-out-together/`**
  (`grouped-rows.ts`, `index.ts`, `tests/left-out-together.test.ts`).
  - `webNodeReplayLeftOutTogether` reads each condition's rejected samples
    after its alone lead (`rejectedSamplesAlone`).
  - It groups identical rows across conditions. A row found under two or more
    conditions is listed once, as `{ conditions: [names], conditionIndexes:
    [0-based], rows: [label] }`.
  - The label alone is used, through `replay-answer.ts`'s own labeller, so a
    row is withheld under the same rules as `leftOutOnlyByThis`.
  - It lists nothing when:
    - the page sent no leads;
    - the read asked only for alone rows;
    - a row appears under only one condition.
  - It is a directory because `node-run/` and `node-run/tests/` were at the
    25-file limit.
- **`node-run/replay-answer.ts`.** `webNodeReplayReadRows` adds
  `leftOutTogether` to `readRows`. A read whose only named rows are these now
  still answers. No note sentence changed (no prompt change).
- **`node-run/rejected-rows.ts`: unchanged.** The explored read already lists
  these rows once each, as `rejectedRows.rowsWithOthers` grouped by `failed`.
  It is asked for every rejected row (`rejectedSamples: true`).

### Part A, Core (`C:/Users/osrs_/FluxStuff/fxwork/t655/!FluxIQ`, under `runtime/result-verification/`)

- **`contracts/read-account.ts`.**
  - New `AutomationStudioResultLeftOutTogether = { conditions: number[]; rows: string[] }`.
  - New `leftOutTogether?` on `AutomationStudioResultReadAccount`.
- **New `read-account/together-rows.ts`.**
  `automationStudioResultReadTogetherRows(value, conditionCount, deniedKeys)`
  takes `[{ failed: 0-based[], rows }]` and returns sets numbered from 1.
  - Each row is cut to its first cell and screened by
    `automationStudioResultReadAloneRows`, so a denied column or a credential
    shape reads `(withheld)` and still counts.
  - The whole list is refused when it holds:
    - fewer than two conditions in a set;
    - an out-of-range or repeated place;
    - a row that is not a row.
- **`read-account/accounts.ts`.** Reads `metadata.extraction.conditions.togetherRows`,
  only under a denied-keys declaration.
- **`read-account/looped-account.ts`.** Merges every pass's sets, each set once,
  rows in pass order.
- **`read-account/index.ts`.** Export and header line.
- **`build-test/read-rows.ts`.** Screens a replay's `leftOutTogether` into
  `{ numbers, conditions, rows }` and drops any set that is not that shape.
- **`refuted-no/record.ts`.**
  - **Completeness.** `seenReads`' test is now
    `itemsSeen === kept + Σ alone + rows left out together`. It also requires:
    - every together label is sayable;
    - every condition has `alone` defined;
    - the read is not unfiltered.
    The stored-set checks are unchanged.
  - **Seen labels.** Together labels join `seenLabels` only, not `pools`. So a
    quote of such a row is never called unseen, and the row-naming path in
    `named-rows.ts` is unchanged.
  - **New `together`.** Lists each read whose listing is complete, with the
    sets of condition numbers.
- **`refuted-no/types.ts`.** Adds `together?` on the record and updates the doc
  of `AutomationStudioResultNoSeenRead`.
- **`refuted-no/advice-condition.ts`.** `mayLeaveOutTogether` takes the record.
  This applies to a read's conditions only, never a saved answer's.
  - If the read's together listing is complete, the advice stands only where
    some row failed only named conditions.
  - Otherwise the old t631 count rule applies.

### Part B, downstream

- **New `domain/src/runtime/llm-evidence/page-groups/`**
  (`option-groups.ts`, `result-count.ts`, `index.ts`, `tests/page-groups.test.ts`).
  - **`webLlmPageOptionGroups`.** Covers every visible control with a group
    name, as `page-view/group-names.ts` names groups.
    - `words` are the words the control's line prints. A trailing `(N)` is
      taken off them and becomes `count`.
    - `chosen` is set when the control is checked, aria-checked, selected,
      pressed, current or marked.
    - Each option appears once per group, chosen if any copy of it is.
  - **`webLlmPageResultCount`.** Gives the one number a visible text line states
    before `results|items|matches|products|listings`. It gives none where the
    page states no such number, or more than one.
- **`domain/src/runtime/host-runtime.ts`.** `captureStateSnapshot`'s summary
  gains `groups` (when non-empty) and `resultCount` (when stated), beside `page`.
  The header paragraph is updated. They are read from the same screened packet
  as the view.
- **New test `domain/src/runtime/tests/host-runtime-groups.test.ts`.**

### Part B, Core

- **`contracts/read-account.ts`.** `AutomationStudioResultNarrowingStep` gains
  `group?`, `chose?`, `leftOptions?: [{ words, count? }]` and
  `resultCount?: { before?, after? }`.
- **New `narrowing-group.ts`.** `automationStudioResultNarrowingGroup` reads
  `groups` and `resultCount` from `stateRefs.beforeAction.summary` and
  `stateRefs.afterAction.summary`.
  - **Which group.** First, the one option chosen after the step that was shown
    unchosen before it. Otherwise, the one option whose words equal the step's
    control words, less a trailing count. If neither finds exactly one, it says
    nothing.
  - **`leftOptions`.** The group's other options that are still unchosen after
    the step, each with the count from before the step.
  - **Screening.** Words are screened. With no denied-keys declaration, or any
    word flagged, the group is withheld. Result counts are always said.
- **`narrowed-before.ts`.** `TracedAttempt.stateRefs` now carries
  `beforeAction`/`afterAction` summaries, and each step spreads the group's
  fields. Header updated.
- **New `unsure-doubts/` directory.** It sits beside `refuted-no/` because
  `refuted-no/` was at 25 files and a nested directory broke the 9-segment
  depth limit. It holds:
  - `narrowing.ts`: `automationStudioResultNarrowingDoubtContradicted`;
  - `recheck-words.ts`: `automationStudioResultDoubtRecheckWords`;
  - `index.ts`;
  - `tests/narrowing.test.ts`.
- **The rule (`narrowing.ts`).** A doubt sentence counts when it does both:
  - matches a generic "the request does not name/mention/specify/ask for",
    "not requested/in the request", or "unrequested" form;
  - names a narrowing step by its label, node id, group or chosen option.

  It is contradicted only when every step it names has `group` and `chose`,
  and each `chose` passes the existing `automationStudioResultRequestTextTest`
  (as `option contains "<words>"`; a quote or escape in the words fails safe).
  Core's words name the step, the option and the request's words, the options
  left unchosen with their counts, and the before/after result counts.
- **`agreement.ts`.**
  - `contradictedUnsure` checks narrowing after pages and dedupe, as
    `about: "narrowing"`.
  - The recheck goes through `automationStudioResultDoubtRecheckWords`, which
    is one sentence frame. The pages and dedupe recheck text is byte-identical
    to before.
  - A header paragraph was added.
  - The file is now 797 lines, against the 800-line limit (it was 796).
- **`contracts/verification.ts`.** `about?: "dedupe" | "narrowing"`, doc updated.
- **`build-test/judge.ts`.** `doubtContradicted` names a narrowing doubt in its
  own words.

### Docs

- **Downstream `docs/architecture/page-evidence.md`.** Documents the snapshot's
  `groups` and `resultCount`.
- **Downstream `docs/architecture/build-loop.md`.** Documents
  `readRows.leftOutTogether`, and that `"alone"` reads send none.
- **Core `docs/architecture/automation-studio.md`.** Two paragraphs: the
  narrowing step's group fields and the narrowing doubt; and `leftOutTogether`,
  the completeness test and the guard. It says plainly that
  `extraction-summary.ts` does not yet admit the member and that the playback
  read does not send it.
- **Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`.**
  `readRows.leftOutTogether`.

### Tests added

- **Domain.**
  - `node-run/tests/replay-read-account.test.ts`: one existing assertion
    updated, as described under "Commands run".
  - `left-out-together.test.ts` (4 tests): a row left out by two conditions is
    listed once with both; it is withheld as an alone row is; there is none for
    an alone-only or unordered read; there is none for a row under one
    condition.
  - `page-groups.test.ts` (3 tests): a chosen option with the other options and
    their counts; a control in no group, or a page with no groups, gives none;
    the result count is one number, or none.
  - `host-runtime-groups.test.ts` (2 tests).
- **Core, part A.**
  - `refuted-no/tests/together-rows.test.ts` (7 tests):
    1. Seen 6 = kept 3 + 2 alone + 1 together is whole, and t654's unseen
       refutation fires.
    2. Seen 7 is still short and refutes nothing; so does the same read
       without the together rows.
    3. A withheld together label is not whole.
    4. A together row is never called unseen.
    5. Removing conditions 1 and 2 is weighed by its conditions where the sets
       are {1,3} and {2,3}.
    6. It stands where a set is {1,2}.
    7. It stands as before where the listing is short.
  - `read-account/tests/together-rows.test.ts` (4 tests): the account carries
    the sets; nothing without denied keys or with a malformed list; screening;
    loop merge.
  - `build-test/tests/read-rows.test.ts` (+1 test): a replay's sets are
    numbered and screened, and a one-condition set is dropped.
- **Core, part B.**
  - `tests/narrowed-before.test.ts` (+3 tests):
    1. A Format/Hardcover step carries `group`, `chose`, `leftOptions` with
       counts and `resultCount {55, 40}`.
    2. A step is matched by its control words when no option is seen to change,
       and a no-group step carries none.
    3. With no denied keys there is no group (withheld), and the counts are
       still said.
  - `unsure-doubts/tests/narrowing.test.ts` (5 tests):
    1. Marked for "hardcover books", with the exact record words.
    2. Asked again once, and a yes makes two yeses (verdicts unsure, answers,
       answers; 3 calls).
    3. Asked again and still unsure; never asked a second time.
    4. Not marked for a request for "books".
    5. A no is never asked again on this ground.

## Commands run and observed results

All runs are in the t655 worktrees.

- **Domain tests.**
  - `node domain/scripts/test-domain.mjs runtime/llm-evidence/node-run runtime`
    (downstream root), final run: `# tests 1450`, `# pass 1450`, `# fail 0`,
    exit 0.
  - Earlier runs printed 1449/1 failing:
    `not ok 438 - a replayed read whose conditions removed nothing by themselves and kept rows carries no note`.
    That test pinned `readRows` exactly. Its fixture's row "X" was rejected by
    both conditions, so it now correctly appears under `leftOutTogether`. I
    updated that one assertion in `node-run/tests/replay-read-account.test.ts`
    (the note is still absent), then reran: 0 failures.
  - Targeted runs before that (`DOMAIN_TEST_BUILD_LABEL=t655`): `left-out-together`
    4/4, `page-groups` 3/3, `host-runtime-groups` 2/2.
- **Domain typecheck.** `npx tsc -p tsconfig.json --noEmit` and
  `npx tsc -p tsconfig.test.json --noEmit` (in `domain/`): no output, exit 0
  each.
- **Downstream structure audit.** `node scripts/structure-audit.mjs`
  (= `pnpm structure:check`).
  - First run had 4 violations:
    - two `contract-spread`: one in my test, one in `option-groups.ts`;
    - two `directory-files`: `node-run/` and `node-run/tests/` at 26 files.
  - Fixed with `present<T>()`, by setting the field explicitly, and by moving
    the module into `node-run/left-out-together/`.
  - Final: `structure-audit: passed (198 warning(s), 639 baselined)`. My only
    warnings are the pre-existing `replay-answer.ts` ones (now 469 lines, 10
    exports).
- **Core typecheck.** `npx tsc --noEmit -p tsconfig.json` (`packages/fluxiq`):
  no output, exit 0, on the final tree.
- **Core tests.** `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/service/subflow-trial`:
  `Test Files 119 passed (119)`, `Tests 1018 passed (1018)`, exit 0. Run twice,
  the second after the final file moves. Nothing heavy ran beside them.
- **Core structure audit.** `node scripts/structure-audit.mjs` (Core root).
  - First run had 2 violations: an `as never` cast in my read-account test, and
    `refuted-no/` at 26 files.
  - A nested `refuted-no/unsure-doubts/` then broke the 9-segment depth limit,
    so it moved to `result-verification/unsure-doubts/`.
  - Final: `structure-audit: passed (383 warning(s), 1156 baselined)`. My
    warnings are advisory line counts on `agreement.ts` (797) and
    `build-test/judge.ts` (432).

## Not verified

- **Nothing on a real run.** No live run (the brief forbids one), and no full
  suites.
- **Part A on real reads.** Untested until the producers below change: a
  playback's extraction account gets no `togetherRows` today, so on a real run
  t654's completeness test still fails exactly as before when two conditions
  share a row.
- **Real pages.** Whether they print counts as `Words (N)` and state results as
  "N results" is unchecked. Pages that do otherwise give no count and no
  `resultCount`, and fail safe.
- **Recovery model.** The new `groups` and `resultCount` keys also reach the
  recovery model through `core.state_snapshot`. That is data the view already
  shows, but I did not check any Core consumer that might project a snapshot
  summary by a closed key list.
- **Real judges' wording.** The doubt regex matches the debug's wording and
  generic variants. How often real judges phrase the doubt that way is
  unmeasured.

## Open questions or contradictions found

1. **The brief's file list cannot make part A reach a real read.** On the
   playback path (candidate trials, the judged trials of
   `run-mva6mlm4-97fe42f9`) these steps happen:
   - `domain/src/output-nodes/extract-list/dispatch.ts` (`withFlowAsks`) sends
     `rejectedSamples: "alone"`;
   - the extension's `apps/extension/src/content/actions/extract-list.ts`
     (`sampledRows`, `aloneOnly`) then slices each list to its alone lead
     before it leaves the page;
   - Core's `service/summaries/extraction-summary.ts` (`conditionReport`,
     `aloneRowLabels`) admits only `aloneRows`.

   The replay asks the same way, through `webAutomationExtractListAloneRowsAsked`
   in `replay.ts`. To finish part A, a follow-up needs these files:
   - **Producer:** either `dispatch.ts`, asking `true` instead of `"alone"`, or
     `extract-list.ts`, keeping rows after the lead in alone mode. The second
     is the smaller payload change.
   - **Core admission:** `extraction-summary.ts`, admitting
     `conditions.togetherRows: [{ failed: number[] (0-based), rows: [row
     records] }]`, built from the rows after each lead and grouped by identical
     values (the shape `accounts.ts` now reads).
   - **Maybe:** the continued-read checkpoint
     (`apps/extension/src/content/extraction/continued-read/read-checkpoint.ts`).
2. **`rejected-rows.ts` needed no change.** The brief named it, but the explored
   read already lists these rows (`rowsWithOthers`).
3. **One import line in `agreement.ts`.** It is a new import line, which kept
   it under 800 only because the recheck words moved to
   `unsure-doubts/recheck-words.ts`.

## Round 2

### Outcome

Done. Part A now works on a real run: a playback (and the draft's replay)
sends the rows two or more conditions left out together. Core admits them, the
read account names them, and a read whose counts then add up is complete, so
t654's unseen-row refutation can fire.

### What changed and why

- **`apps/extension/src/content/actions/extract-list.ts` (Chrome/Edge and
  Firefox share this content path).** When a read asks only for alone rows
  (`rejectedSamples: "alone"`), `sampledRows` now keeps, after each list's
  alone lead, the rows it shares with another condition's list.
  - **How it finds them.** It matches by value (`sharedRows`). A row in one
    list only is still dropped.
  - **What they carry.** They are the same row records as the alone rows, with
    declared fields only; there is no row bound, as for the alone rows.
  - **Counts and observations.** `rejectedSamplesAlone` still gives the alone
    counts. Observations stay aligned with the rows, as the domain's and Core's
    validators require, but a together row's observation is `null`, so no
    value a condition read on it leaves the page.
  - **Why this route.** The payload is smaller than asking `true`: no
    single-list rows and no witnesses for these rows.
  - The header is updated.
  - **Unchanged:**
    - `dispatch.ts`, so playback still asks `"alone"`;
    - the continued-read checkpoint, which already carries full lists (only
      `sampledRows` cut them);
    - the explored read path (`rejectedSamples: true`, `rejected-rows.ts`).
- **Core `runtime/service/summaries/extraction-summary.ts`.**
  `extractionSummaryFromOutputs` now admits `conditions.togetherRows: [{ failed:
  0-based[], rows }]` beside `aloneRows`.
  - **How it builds them** (`togetherRowGroups`). It takes the rows after each
    lead (already shape-checked by `aloneRowLabels`), groups identical rows,
    and keeps those found in two or more lists.
  - **Row shape.** Each row is led by its label (`rowLabel`), the shape
    `read-account/accounts.ts` reads.
  - **Order and absence.** Sets are sorted by their condition places. The key
    is absent when there are none.
  - The header is updated.
- **Downstream round-1 replay code** (`node-run/left-out-together/`). It now
  receives these rows too, since the replay asks `"alone"`.
- **Docs.**
  - **Downstream `docs/architecture/build-loop.md`.** Says alone reads now
    carry these rows, with `null` observations.
  - **Core `docs/architecture/automation-studio.md`.** The "does not yet admit
    / send" text is replaced by how `extraction-summary.ts` builds the sets.
- **Tests.**
  - **Extension `content/actions/tests/extract-list-rejected-samples.test.ts`.**
    - **Updated.** The first test now expects "Record B", which both
      conditions rejected, to stay after each lead, with observations
      `[[obs, null], [null]]` (it had expected them sliced to `[1, 0]`).
    - **New.** A playback whose row "Desert Poems, Paperback" failed both
      conditions comes back after each list's lead, through the domain wire
      copy. `rejectedSamplesAlone` stays `[1, 1]`, and the row's observations
      are `null`.
  - **Core new `service/summaries/tests/extraction-summary-together.test.ts`.**
    It goes from the page summary through admission and the read account to
    `automationStudioResultNoRecord` (3 tests):
    1. `togetherRows` is admitted once under `[0, 1]`, and a row in one list
       only gives none.
    2. Seen 6 = kept 3 + 2 alone + 1 together gives `leftOutTogether [{
       conditions: [1, 2] }]`; the read is whole, and the "Condition 2 missed
       <unseen>" no is wholly refuted with t654's finding.
    3. Seen 7 is not whole and refutes nothing.
  - **Explored path unchanged.**
    - The extension's `true`-mode test ("a command that asks for samples gets
      them ... whole") passes unchanged.
    - `rejected-rows.ts` and its tests are untouched and pass in the domain run
      below.

### Commands run and observed results

- **Extension content tests.**
  - `node scripts/test-extension.mjs src/content/actions src/content/extraction`
    (in `apps/extension`): `# tests 468`, `# pass 468`, `# fail 0`.
  - `node scripts/test-extension.mjs src/content/actions/tests/extract-list-rejected-samples`:
    6/6 ok, including the new test.
- **Extension check.** `node scripts/check-extension.mjs` (`apps/extension`):
  no output, exit 0.
- **Domain tests.** `DOMAIN_TEST_BUILD_LABEL=t655 node scripts/test-domain.mjs runtime/llm-evidence/node-run runtime/tests/host-runtime-groups llm-evidence/page-groups`:
  `# tests 370`, `# pass 370`, `# fail 0`.
- **Domain typecheck.** `npx tsc -p tsconfig.json --noEmit` and
  `npx tsc -p tsconfig.test.json --noEmit`: exit 0 each.
- **Downstream structure audit.** `node scripts/structure-audit.mjs`:
  `structure-audit: passed (198 warning(s), 639 baselined)`. The advisory
  warnings on `extract-list.ts` are its line count (now 475).
- **Core typecheck.** `npx tsc --noEmit -p tsconfig.json`: exit 0.
- **Core tests.** `npx vitest run` on `service/summaries`, `result-verification`,
  `service/candidate-trial` and `service/subflow-trial`: `Test Files 135
  passed`, `Tests 1128 passed (1128)`, exit 0.
- **Core structure audit.** `node scripts/structure-audit.mjs`:
  `structure-audit: passed (385 warning(s), 1156 baselined)`. The new advisory
  warning is the `extraction-summary.ts` line count (409).

### Not verified

- **No live or browser run.** Whether real pages yield identical row records
  across conditions is unchecked. Rows whose values differ per condition list
  would not group, so the count stays short and nothing is refuted (it fails
  safe).
- **No full suites.** The extension check ran; the full domain suite did not.

### Open questions or contradictions found

1. **Stale domain docs I do not own.** These say an `"alone"` read's lists are
   its alone rows "and nothing else", and `rejectedSamplesAlone` is "each
   list's length". Both are now false; leads are counts that are at most the
   list length:
   - `domain/src/actions/extraction/rejected-samples.ts`:
     `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY` doc and header;
   - `domain/src/output-nodes/extract-list/dispatch.ts` header ("and only
     those").

   No code relies on the old meaning: the domain and Core validators accept a
   lead up to the list length, and Core slices alone rows by the lead.
2. **Partial reads still fall short.** A row first seen alone by one condition
   and, identically, together on a later page stays in that condition's lead.
   It then appears after one list's lead only, so it is not grouped. The read
   then reads short, and fails safe.
