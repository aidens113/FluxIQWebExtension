# t510 Core half: record-output refusal remedy and detail, exclude/columns guidance, date and number reading

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t510/!FluxIQ`, branch `task/t510-record-output-one-reader`. Nothing
committed.

## Outcome

Done, after the continuation. In the first pass, F2's detail could not be attached because two files were not owned;
open question 1 below records that. The coordinator then granted `plan/validation.ts` and `plan/issue-feedback.ts`,
and asked for the year rule in open question 3. See "Continuation" at the end; it supersedes those two open questions.

## What changed and why

**F2: `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/record-output-contract.ts`**
- The message now picks its remedy by how the refused field is used:
  - `process_excluded_field` when a sort or dedupe key names the field: "A sort or dedupe key must be stored: to order
    by, or drop repeats by, a field the answer should not show, keep it stored -- remove handling "exclude" from it --
    and list the answer's columns in process.columns, which leaves every other stored field out of the answer."
  - A where field: "A where field must be stored: remove handling "exclude" from it."
  - `columns` only: "Name a stored field id instead." (unchanged).
  - `process_unknown_field` on a sort or dedupe key: says to add the field to schema.fields and hide it with
    process.columns. Otherwise the old text stays.
- New export `automationStudioFlowBootstrapRecordOutputIssueDetail(code, value)` gives `{field, valid}` in the t489
  shape. `field` is the first field the refusal names. `valid` is the ids the schema stores, or, for
  `process_where_column_dropped`, the columns kept. Other codes give `undefined`. One private `fieldRefusal` builds
  both the message and the detail.
- Contract text (F3, shown in the catalog and in a refused parameter's `accepted` shape): the schema line says
  `exclude: never stored, for a value that must not be kept, and not the way a field leaves the answer`. The
  processing text says `columns picks the answer's columns, so a sort or dedupe key may be a stored field columns
  leaves out`. A longer wording made the catalog entry 4,001 bytes against its 4,000 limit
  (`extraction-vocabulary.test.ts:125`), so I shortened it. The limit was not raised.

**F3: `.../flow-bootstrap/plan/flow-script-format.ts`** (`AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`)
- Removed "over the columns `recordOutput.columns` saves" ("over the columns it stores").
- Added: "In a record output, a schema field with `handling: "exclude"` is never stored, for a value that must not be
  kept, while `process.columns` keeps a field stored but leaves it out of the answer. A sort or dedupe key must be
  stored: one the answer should not show stays in the schema and out of `process.columns`." It contains no scenario
  words.
- Also added a t510 note to the constant's doc comment.
- The 6,500-byte completion-schema budget does not apply: that schema carries only `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT`
  (`plan/evidence-schema.ts:53`), and the recordOutput guidance sits only in the loop format, which the candidate
  submit tool's description carries (`candidate/authoring-loop.ts:124`). The format and schema digests are therefore
  unchanged. `system-prompt-pins.json` did not need a change.

**F6: `packages/contracts/src/record-sets/process/read-date.ts`**
- The time of day is kept on day-month, month-day and numeric dates (`14:00`, `2:30 pm`, `9am`, `12:15 AM`). The ISO
  path already kept it.
- "today", "tomorrow" or "yesterday" beside a time gives that time on that day.
- A time alone states no date. An impossible time (`25:00`) leaves the value unread, rather than reading it as
  midnight.
- A time left (`1d 0h left`, `5h 12m left`, `3 days left`, `2 days, 4 hours remaining`, `ends in 45 min`) is read as
  `now` plus the time left, which is the instant it runs out. A bare `m` means minutes only inside a time left. "Only 2
  left" (no unit) is still not a date.
- An `auto` sort key therefore reads a column of times left as dates, so it orders them by when they run out.

**Coordinator addition: `packages/contracts/src/record-sets/process/read-number.ts`**
- k/K or m/M directly on the number's digits, and before anything but a letter or digit, multiplies it: `£72k` is
  72000, `72K` is 72000, `$1.2m` is 1200000, `3.5M views` is 3500000, and `€1,5k` (continental) is 1500.
- "4 thousand" and "1.5 million" (a word after a space) are read too.
- These are not magnitudes: `72kg`, `5 km away`, and `10 m cable` (a letter after a space). Scaling is done in
  decimal (`"1.2e6"`), so there is no float error.
- Rule chosen for the domain worker to match: the letter must be attached to the digits. I chose this so that "5 m"
  (metres) and "12 M" are not read as millions.

**Tests (fail-first, generic values)**
- `packages/contracts/src/record-sets/process/value-reading-cases.ts`: 15 date cases, 1 auto case and 10 number cases
  added to the parity table.
- `packages/contracts/src/record-sets/process/tests/value-reading.test.ts`: two sort tests (one day by time; times
  left soonest first).
- `.../plan/tests/record-output-contract.test.ts`: 5 tests (remedy by use, detail, and the contract wording).
- `.../plan/tests/flow-script-format.test.ts`: 1 test (the loop-format sentence; the old clause is gone).

## Commands run and observed results

- Fail-first, before the fixes:
  - `npx vitest run src/record-sets/process/tests/value-reading.test.ts` (contracts) printed `60 tests | 15 failed`
    (the date and sort cases).
  - After the number cases were added: `7 failed` (the k/m/thousand/million cases; `72kg`, `5 km` and `10 m` already
    passed).
  - `npx vitest run .../plan/tests/record-output-contract.test.ts` printed `5 failed | 22 passed`. The failures were
    `...IssueDetail is not a function`, a message missing `remove handling "exclude"`, and the contract text missing
    `exclude: never stored`.
  - `flow-script-format.test.ts` printed `1 failed | 69 passed`.
- After the fixes:
  - contracts `npx vitest run src/record-sets` printed `Test Files 12 passed (12)`, `Tests 148 passed (148)`.
  - fluxiq `npx vitest run` over flow-bootstrap/plan/tests, flow-bootstrap/candidate/tests,
    flow-bootstrap/tests/plan.test.ts (the 6,500 budget), llm/deepseek/tests (the pins) and
    result-verification/build-test/tests (a processing consumer) printed `Test Files 59 passed (59)`,
    `Tests 633 passed (633)`.
  - Only once during the work, `.../plan/tests` alone showed `1 failed`:
    `extraction-vocabulary ... expected 4001 to be less than or equal to 4000`. Shortening the sentence fixed it, and
    the rerun printed `16 passed / 206 passed`.
- Typecheck:
  - `pnpm run check` in packages/contracts printed only the build-cache line (`"step":"contracts:check"`, `ms":5616`)
    and no tsc errors.
  - `pnpm run check` in packages/fluxiq printed only the build-cache line (`"ms":47523`) and no tsc errors.
- `pnpm structure:check` printed `structure-audit: passed (340 warning(s), 1159 baselined)`.
  - Warnings on my files are the existing 400-line advisory: `flow-script-format.ts` 585 lines and
    `flow-script-format.test.ts` 541 lines.
  - It also said "2 baseline entries can be lowered". These are not mine, and I did not run `structure:baseline`.

## Not verified

- **F2's detail is not wired** (see open questions). Feedback shows today's improved message, because the code is in
  `AUTHORED_CODES`, but not `field`/`valid`.
- I did not check that the fluxiq tests read contracts from source rather than a stale `packages/contracts/dist`.
  The fluxiq suites I ran do not exercise the new date or number cases directly.
- No full suites, Lab or provider runs. The downstream parity of the new readers was not checked.

## Open questions or contradictions found

1. **Two files needed for F2's "trial feedback and submit refusals show it"** (not owned, not edited):
   - `flow-bootstrap/plan/validation.ts:284-286`: attach the detail, e.g.
     `const detail = automationStudioFlowBootstrapRecordOutputIssueDetail(code, value); return { ...error(code, message, path), ...(detail ? { detail } : {}) };`
     (import it from `./record-output-contract.ts`).
   - `flow-bootstrap/plan/issue-feedback.ts` (entry built in `automationStudioFlowBootstrapIssueFeedback`). Today any
     issue with a detail has its message **replaced** by the domain sentence
     (`automationStudioFlowBootstrapIssueDetailSentence`: "The domain that runs this step refused it ... write one of
     those instead"). Attaching the detail alone would therefore bring back the wrong remedy. For a code in
     `AUTHORED_CODES` that has a message, keep `issue.message` and add `field`/`valid` beside it.
   - Tests: `plan/tests/validation.test.ts:302` (expect `detail` `{field:"secret", valid:["name"]}` and
     `process.columns` in the message), and an `issue-feedback.test.ts` case that an authored record-output issue with
     a detail keeps its own message.
   - `candidate/submission-refusal.ts` reads `field`/`valid` only for handle codes, so it needs nothing.
2. **Parity is not enforced downstream.** No file in the extension or domain imports
   `AUTOMATION_STUDIO_RECORD_VALUE_READING_CASES` (grep, observed). The page-side sort reader
   (`apps/extension/src/content/extraction/order-rows.ts`, its own date reader) and the domain's
   `condition-match.ts:webAutomationExtractConditionNumber` need the same rules, or they drift silently. Running the
   parity table there would make the drift fail a test.
3. **A month-day with no year is still "the latest such date not after now plus a day"** (an existing rule for posted
   dates). For future end dates more than a day away ("ends 25 Sep" read on 20 Sep), it picks last year and sorts
   those rows first. I did not change it, because it breaks an existing parity case ("Dec 25" with now in October is
   last year). This needs a decision, such as reading the nearest date or using the column's sense.
4. A time left is measured from the processing `now`, not from the page's capture time. Rows read minutes apart are
   off by those minutes. A row-level capture time would remove the skew.
5. With the attached-suffix rule, "4K UHD" reads as 4000 when it is the first number. I accepted this.

## Continuation (coordinator: validation.ts and issue-feedback.ts granted; year rule decided)

### What changed

**F2 wiring: `packages/fluxiq/.../flow-bootstrap/plan/validation.ts`**
- `recordOutputIssues` attaches `detail` from `automationStudioFlowBootstrapRecordOutputIssueDetail(code, value)` when
  there is one. The issue is otherwise unchanged.

**F2 wiring: `packages/fluxiq/.../flow-bootstrap/plan/issue-feedback.ts`**
- An issue whose code is in `AUTHORED_CODES` and has a message now keeps that message and carries `field`/`valid` from
  its detail beside it. It never gets the domain sentence ("... write one of those instead").
- A domain refusal (code not authored) with a detail still gets the rebuilt domain sentence, as before.
- A t510 note was added to the header.
- The record-output codes are already in `AUTHORED_CODES` (t489). Their message names only field ids the model wrote.

**Year rule (supervisor decision): `packages/contracts/src/record-sets/process/read-date.ts`**
- `withYear` now reads a month-day with no year as the occurrence of last year, this year or next year nearest `now`.
  That is always within about six months.
- A date ahead of `now` is this year's or next year's, never last year's.
- The header comment states the rule and why the old one was replaced.
- "Capture time" is `now` as passed in. Neither the readers nor `processAutomationStudioRecordRows` get a per-row
  capture time, so the read's own time is used only when the caller passes it as `now`. Adding a row capture time
  would be a wider contract change.

### Tests (fail-first observed)
- `plan/tests/validation.test.ts` "names a field the schema excludes" now also expects `process.columns` in the
  message and `detail` `{field:"secret", valid:["name"]}`.
- `plan/tests/issue-feedback.test.ts`, new describe "the feedback on a sort key the schema excludes, from submit". It
  runs `validateAutomationStudioFlowBootstrapPlan`, then `automationStudioFlowBootstrapIssueFeedback`, and expects:
  the issue's detail `{field:"due", valid:["name","owner"]}`; the feedback entry carrying the same `field`/`valid`; and
  a message that contains `remove handling "exclude"` and `process.columns` but not `write one of those instead`.
- `value-reading-cases.ts` (NOW = 2026-10-06T12:00Z). The parity case "Dec 25" changed from 2025-12-25 to
  2026-12-25. New cases:
  - `Feb 3` gives 2027-02-03 (a future date in next year).
  - `5 Oct` gives 2026-10-05 (just past).
  - `Apr 10` gives 2026-04-10 (179.5 days back is nearer than 185.5 days ahead).
  - `Apr 2` gives 2027-04-02 (177.5 days ahead is nearer than 187.5 days back).
- `tests/value-reading.test.ts`, across the turn of a year:
  - "Jan 2, 09:00" at 2026-12-30 gives 2027-01-02T09:00.
  - "30 Dec" at 2027-01-03 gives 2026-12-30.

### Commands run and observed results
- Fail-first, F2: validation + issue-feedback tests printed `2 failed | 40 passed`, both
  `expected undefined to deeply equal {field: ...}`.
- After wiring `validation.ts` only: `1 failed | 41 passed`, with
  `expected 'The domain that runs this step refuse…' to deeply equal StringContaining`. That is the swap the brief
  warned of, observed.
- After fixing `issue-feedback.ts`: `42 passed (42)`.
- Fail-first, year rule: `3 failed | 71 passed` ("Dec 25", "Feb 3", the turn-of-year test).
- After the fix there was one failure, my own miscomputed `Apr 2` expectation (2026). Nearest is 2027, as stated
  above. I corrected the case, not the code, and added `Apr 10` for the other side of the boundary.
  `npx vitest run src/record-sets` (contracts) then printed `Test Files 12 passed (12)`, `Tests 153 passed (153)`.
- fluxiq `npx vitest run` over flow-bootstrap/plan/tests, flow-bootstrap/candidate/tests,
  flow-bootstrap/tests/plan.test.ts, llm/deepseek/tests and result-verification/build-test/tests printed
  `Test Files 59 passed (59)`, `Tests 634 passed (634)`.
- The other users of issue feedback, flow-bootstrap/authoring/tests and llm/harness-options, printed
  `Test Files 41 passed (41)`, `Tests 429 passed (429)`.
- `pnpm run check` in packages/contracts printed only the build-cache line (inputs changed, ms 5650), exit 0.
- `pnpm run check` in packages/fluxiq printed only the build-cache line (ms 76213) and no tsc errors.
- `pnpm structure:check` printed `structure-audit: passed (340 warning(s), 1159 baselined)`, with the same 2
  pre-existing "can be lowered" entries, which I did not touch.

### Files changed in total (Core tree)
- packages/contracts/src/record-sets/process/read-date.ts, read-number.ts, value-reading-cases.ts,
  tests/value-reading.test.ts
- packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/record-output-contract.ts,
  flow-script-format.ts, validation.ts, issue-feedback.ts
- Their tests: tests/record-output-contract.test.ts, tests/flow-script-format.test.ts, tests/validation.test.ts,
  tests/issue-feedback.test.ts

### Still open
- Downstream parity: the extension's `order-rows.ts` date reader and the domain's `condition-match.ts` number reader
  must take the same rules: the year rule, time of day, time left, and k/m (attached only) plus thousand/million.
  Nothing downstream runs the parity table.
- Per-row capture time for time-left values and year-less dates (see above).

## Refinement (supervisor decision: a bare m is not million)

This replaces the m/M rule stated under "Coordinator addition" above.

### Rule now in `packages/contracts/src/record-sets/process/read-number.ts`
- k/K attached to the digits, and before anything but a letter or digit, is thousand: "72k" and "£72k" are 72000.
- m/M attached to the digits is million only in these cases:
  - a currency symbol (`\p{Sc}`) is written directly before the number: "£3m" is 3000000, "€2M" is 2000000;
  - the number has a decimal separator: "1.5m" is 1500000, "$1.2m" is 1200000, "3.5M views" is 3500000.
- "thousand" and "million" written out are read as before.
- A bare "3m" or "10m" stays as written: "3m ago" is 3, "10m" is 10.
- A letter after a space ("10 m") and a longer unit ("72kg", "5 km") are never a magnitude.
- Decimal separator here means the number as read. A continental decimal comma ("1,5m") counts, because the reader
  has already turned it into "1.5". The domain worker should match this or say otherwise.
- Implementation: `scaled(digits, value, index, length)` checks the text before the number for a currency symbol
  (`CURRENCY_BEFORE = /\p{Sc}$/u`) and the read digits for ".". The header comment states the rule.

### Cases added to `value-reading-cases.ts`
- `3m ago` -> 3
- `10 m` -> 10
- `10m` -> 10
- `£3m` -> 3000000
- `€2M` -> 2000000
- `1.5m` -> 1500000
- `$1.2m` -> 1200000 (was already present)

### Commands run and observed results
- Fail-first: `npx vitest run src/record-sets/process/tests/value-reading.test.ts` printed `2 failed | 79 passed`. The
  failures were "3m ago" (it read 3000000) and "10m" (it read 10000000).
- After the change: contracts `npx vitest run src/record-sets` printed `Test Files 12 passed (12)`,
  `Tests 159 passed (159)`.
- fluxiq `npx vitest run` over flow-bootstrap/plan/tests, flow-bootstrap/candidate/tests,
  flow-bootstrap/tests/plan.test.ts, llm/deepseek/tests, result-verification/build-test/tests,
  flow-bootstrap/authoring/tests and llm/harness-options printed `Test Files 100 passed (100)`,
  `Tests 1063 passed (1063)`.
- `pnpm run check` in packages/contracts printed only the build-cache line (ms 2838) and no tsc errors.
- `pnpm run check` in packages/fluxiq printed only the build-cache line (ms 35601) and no tsc errors.
- `pnpm structure:check` printed `structure-audit: passed (340 warning(s), 1159 baselined)`.
