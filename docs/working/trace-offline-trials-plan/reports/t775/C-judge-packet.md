# t775 phase C: the judge packet and the agreement for judging the change (Core)

## Outcome

Done, with one forced deviation in file placement, explained below. Tree:
`fxwork/t775/!FluxIQ`, branch `task/t775-minimal-reset-judging`. Nothing was committed.

The deviation: `result-verification/agreement/` and `result-verification/refuted-no/` each already hold
25 source files, which is the structure audit's `directory-files` limit, and that limit is not
baselined for either directory. A subdirectory under either one would also break the 9-segment depth
limit. So the new focused files live in a new sibling directory, `result-verification/site-change/`. The
hooks are where the brief puts them: the agreement in `agreement/`, and the refuted-no claim in
`refuted-no/weigh.ts`.

R below means `packages/fluxiq/src/programs/automation-studio/runtime`.

## What changed and why

### New: `R/result-verification/site-change/`

- **`held.ts`, `automationStudioResultSiteChangeHeld(verification, summary)`.** It acts on a yes whose
  summary's `siteChange.proofs` holds a proof of `no_change`, `already_in_end_state` or `unproven`. Those
  proofs only exist for parts with an effect, because the packet drops `none`.
  - The yes becomes `verdict: "unsure"`, `basis: "model_unconfirmed"`, code `core.result.change_not_proven`.
  - The reason names each such part, its proof, and the proof in words. For example:
    `part "p2" (already_in_end_state: the state it asks for already held before this trial began, and no step of this build was seen making that change)`.
  - It carries no repair and no failure record, so it is never a yes and never a no that Core made, and
    `FailsRun` is false.
  - `verdicts`, `calls` and `answeredReading` are kept.
  - Through the build-test judge this comes out as `unknown`, with that reason as `why`.
- **`count-claim.ts`, `automationStudioResultChangeCountClaim(sentence, siteChange)`.** This is the closed
  form of the refuted-no reason.
  - **Parts it matches.** A part counts as matched when all of these hold:
    - its proof is `shown`;
    - its effect is `change` with a numeric `count` N;
    - every witness of the part changed by exactly N.
  - **Witness rules.** For a list witness, `adds` needs `added`=N, `removed`=0 and `changed`=0; `removes`
    is the mirror image. For a control witness, the sum of the positive state moves must equal N. The
    direction of a control move cannot be told from opaque labels.
  - **Count claims.** A count claim is a numeral followed within two words by a content word of the part's
    `what` (plural-folded). A numeral after step, pass, row, page, condition, node, call or trial is
    skipped.
  - **Clause rule.** The sentence is split into clauses at `;`, `: `, `, but/and/yet/however/while/...`,
    ` but `. It is refuted only when at least one clause states a count other than N and every other
    clause either restates N or is too short to say anything. A clause about anything else leaves the
    sentence to the existing claims.
  - **Finding.** The finding is Core's change line, for example:
    `Core read where part "p1"'s change shows just before this trial and just after it -- "My holds": 1 row added, none removed or changed -- which is the change it asks for (adds 1 hold on a book). What those places held before the trial was already there and is not this trial's doing, so their total after it is not the count asked for.`
- **`screened.ts`, `automationStudioResultSiteChangeScreened`.** Every key in the packet is Core's own, so
  only its strings are screened. Each credential-shaped string becomes `(withheld)` and sets `withheld`.
  Proofs are never dropped. A finding's `where` is cut to 200 characters. This answers B's open point
  about screening.
- `index.ts` is the barrel. The tests are in `tests/`: `held.test.ts`, `count-claim.test.ts`,
  `judge-request.test.ts` and the fixture `library-holds-fixture.ts`.

### Edited

- **`R/result-verification/contracts/run-result-summary.ts`.** Added two fields, both type-only imports
  from `flow-bootstrap/trial-change/index.ts`:
  - `siteChange?: AutomationStudioTrialSiteChange`;
  - `siteChangeFindings?: AutomationStudioTrialChangeFinding[]`. This is how Core's findings reach the
    judge as Core findings on the summary, the same way `instructionColumnsUnread` and
    `leftOutNamingTheItem` do.
- **`R/service/candidate-trial/summary.ts`.** Takes optional `siteChange` and `siteChangeFindings`,
  screens them, and places them after `startedWith` and before `earlierAdvice`, which stays last (t752).
- **Already-in-state acts were not wired into the summary**, and that is left to phase D. The summary is
  given the trace and graph, not the trial's acts: `run.ts` computes `acts` separately and never passes
  them in. The `already_in_state` acts reach the judge inside the packet's `acts`, which phase D builds
  from `automationStudioCandidateTrialAlreadyInState`. `landed-acts.ts` was read and not changed.
- **`R/result-verification/agreement/verification-agreement.ts`.** This is the hook:
  `recorded(input, automationStudioResultSiteChangeHeld(agree(input), input.summary))`.
- **`R/result-verification/agreement/reask-contradicted.ts`.** It calls the raw `agree` in three places,
  which would bypass the hook, so its result goes through the same hold. The other re-asks (split-no,
  unsupported-no, narrowing) agree through `verify.ts`'s closure, which is the hooked function.
- **`R/result-verification/refuted-no/`.**
  - `types.ts`: the record gains `siteChange?`.
  - `record.ts`: sets it from `summary.siteChange`.
  - `weigh.ts`: adds the claim to the claims list, with a header paragraph.
  - The existing t607 machinery does the rest: it marks `refutedNo`, re-asks once with the finding in the
    recheck, and treats a still-refuted no as unsure.
- **`R/llm/diagnosis-instructions.ts`.** This file owns the judge's instructions, which reach `judge.ts`
  through `verify.ts` → harness → deepseek `system-prompt.ts`. Nine generic sentences were inserted right
  after the `startedWith` sentence, plus a header note. They cover:
  - how to read `siteChange` and `siteChangeFindings`;
  - that a part is judged by the change, never the total after;
  - the `change`, `end_state`, `carried` / `already_in_end_state` and other proof meanings;
  - that `unchanged` is met when before equals after, whatever the state;
  - that an `already_in_state` act did not act, yet targeting a row the task says to leave alone is a
    defect;
  - that `siteChange` overrides `startedWith` / `startView` for the parts it proves.

  The examples are a library's holds on books.
- **`R/llm/deepseek/tests/system-prompt-pins.json`.** Both verification pins were re-pinned by exactly
  that insertion. The file was rewritten by script after checking that it round-trips byte for byte.
- **`R/llm/deepseek/tests/system-prompt.test.ts`.** Updated the pin note and added a t775 describe block:
  the sentences are said once to both verifications and to no other task, they sit right after
  `startedWith`, and they contain none of the scenario words.
- **The judge's task checklist (`R/result-verification/build-test/task-checklist.ts` and
  `R/result-verification/contracts/task-checklist.ts`).** I added `effect` to each asked part, and
  `unchanged`, both only when present. When either is present, one more sentence is added to
  `supplementary`. A checklist with neither is unchanged byte for byte. Without this the judge would
  never see `unchanged`, and the new words could not be applied. Phase A typed these fields but did not
  render them.
- **`R/result-verification/build-test/judge.ts`.** Header table only: one row for the new unknown.

### Tests (the brief's fail-first set)

- (a) `site-change/tests/held.test.ts`:
  - two yeses with `already_in_end_state` give unsure, `change_not_proven`, and a reason naming
    `part "p2" (already_in_end_state: ...)`;
  - with `carried`, the outcome is a yes;
  - `no_change` and `unproven` are each named;
  - a no, an unsure, and a summary with no `siteChange` are untouched;
  - a yes from a contradicted re-ask is held too.
- (b) `service/candidate-trial/tests/site-change/tests/site-change.test.ts`. That directory is nested
  because `candidate-trial/tests` is at 25 files, following the existing `earlier-advice/tests/`
  pattern. It checks:
  - the last keys are `startedWith, siteChange, siteChangeFindings, earlierAdvice`;
  - without `startedWith`, the last keys are `siteChange, earlierAdvice`;
  - with no packet, `siteChange` is absent;
  - a card-number line becomes `(withheld)`, the proofs are kept, and `withheld` is true.
- (c) `site-change/tests/judge-request.test.ts`. A real build-test judge runs with a scripted provider
  that captures. The captured request is then run through the real DeepSeek adapter with a stubbed
  fetch, and the outbound wire body is read:
  - the user message contains `"siteChange":{"witnesses":[{"id":"w1"...`, `"proof":"already_in_end_state"`
    and `"outcome":"already_in_state"`;
  - the system message contains the new words;
  - the verdict is `unknown`, and `yes` with `carried`.
- (d) `site-change/tests/count-claim.test.ts`:
  - the no "The holds list now shows 4 holds, but the request asked to place only 1 hold." over a
    3 → 4 change for "adds 1 hold on a book" is wholly refuted with Core's change line;
  - the agreement marks `refutedNo` for calls [1, 2];
  - each call is asked once more with the line, and two yeses come back as a yes;
  - the claim does not fire for an unmatched delta (added 3), a row-value change, a clause about
    something else, a step number, or no packet.
- Plus `build-test/tests/task-checklist.test.ts`, one case for `effect` / `unchanged` rendering.

## Commands run and observed results

All runs were from `packages/fluxiq` unless noted.

1. **First run of the new tests.** Command:
   `node ../../scripts/vitest-groups.mjs --groups=parallel <site-change> <candidate-trial/tests/site-change> <build-test/tests/task-checklist.test.ts> <llm/deepseek/tests/system-prompt.test.ts>`.
   Result: `Test Files 6 passed (6)`, `Tests 67 passed (67)`, `all groups passed: parallel`.
2. **Fail-first.** I backed up and temporarily removed the hooks: the agreement and reask holds, the
   weigh claim line, the summary wiring, and the inserted instruction words. I ran the new test dirs,
   then restored from backup and confirmed by grep. Result: `Failed Tests 10`, every new behavioural
   test. For example:
   - `expected { …(10) } to match object { verdict: 'unsure', …(4) }`
   - `expected false to be true` (wholly refuted)
   - `expected undefined to match object { calls: [ 1, 2 ] }`
   - `expected 'Return exactly one JSON object…' to contain 'resultSummary.siteChange, where prese…'`
   - `expected [ 'flowShape', 'withheld', …(2) ] to deeply equal [ 'startedWith', 'siteChange', …(2) ]`
3. **Acceptance, final.** Command:
   `node ../../scripts/vitest-groups.mjs --groups=parallel R/result-verification/{site-change,agreement,refuted-no,build-test,tests} R/service/candidate-trial/tests R/llm/deepseek/tests R/llm/tests/diagnosis-channel.test.ts R/llm/harness/tests/{judge-request-prefix,context-packet,request-evidence-check}.test.ts R/flow-bootstrap/plan/tests/issue-feedback.test.ts R/service/project-build/tests/project-build-task-checklist.test.ts`.
   Exit 0, `Test Files 133 passed (133)`, `Tests 1254 passed (1254)`, `[vitest-groups] all groups passed: parallel`.
   - This set includes the prompt-contract tests the brief named: `system-prompt.test.ts` and
     `issue-feedback.test.ts`.
   - It also includes every test that pins the judge prompt, found by grepping for
     `loop_verification` / `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`: `diagnosis-channel`,
     `judge-request-prefix`, `context-packet` and `request-evidence-check`.
4. **`pnpm check` (packages/fluxiq).** Exit 0, no `error TS` lines. Last line:
   `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; ..."}`.
5. **`pnpm structure:check` (Core root).**
   - The first run exited 1: `FAIL [imports] .../site-change/tests/judge-request.test.ts: 1 import(s) reach into another directory's files instead of its barrel, e.g. "../../../llm/deepseek/request-body.ts"`.
   - I fixed it by rendering through the DeepSeek adapter's barrel (`createAutomationStudioDeepSeekProvider`).
   - The final run exited 0: `structure-audit: passed (443 warning(s), 1152 baselined).` No warning
     names a file I touched.
6. **Comment-only edit after the final runs.** The `judge.ts` header-table edit came after runs 3 to 5.
   It changes comments only and was not rerun.

## Not verified

- **No live or browser run.** Nothing produces `siteChange` yet: phase D wires the readings into the
  trial gates.
- **Closed form of the count claim.** It does not match:
  - a row whose value moved by some units (a list witness's `changed`; Core does not parse page
    quantities, so the 9 → 10 quantity case is the judge's alone, guided by the new words);
  - counts written as words ("four holds");
  - a count that is not followed within two words by a word of the part's `what`;
  - any sentence with a clause about something else.

  It also does not read `diagnosis.defects` (the t752 located-defects path). A no listing such a count
  only under `defects` goes through the unsupported-no re-ask instead.
- **The `already_in_state` row rule** ("a step that targeted a row the task says to leave alone is a
  defect") is instruction words only. Core does not check it mechanically. Doing that needs the
  `unchanged` rows matched to act rows, which is phase D's or a later phase's.
- **Repair findings.** `result.change_not_seen` and `result.unasked_change` reach the judge as summary
  findings. They are not added to the repair directive's finding codes, so they do not appear in a no's
  `findings[]`. That needs `repair-directive.ts`, which is not owned.

## Open questions or contradictions found

1. **Placement.** The brief puts the new files in `agreement/` and `refuted-no/`, but both are at the
   25-file limit and the depth limit forbids subdirectories. I used `result-verification/site-change/`;
   the lead can confirm.
2. **The hold's code is local to `held.ts`.** It is `core.result.change_not_proven`. It would belong in
   `verdict/codes.ts` (`AUTOMATION_STUDIO_RESULT_VERDICT_CODES`), which I do not own. A gate in phase D
   should read the code rather than the reason, and may want a typed field for the parts. That needs
   `contracts/verification.ts`.
3. **I touched the judge's checklist files beyond the named list:** `build-test/task-checklist.ts` and
   `contracts/task-checklist.ts`. I judged them to be inside "wherever the summary is rendered for the
   judge", because without them `unchanged` never reaches the judge. If the lead disagrees, revert those
   two and the one test case.
4. **A load-order hazard that I did not cause.** If a test imports `llm/deepseek/index.ts` before the
   build-test judge, `runAutomationStudioLlmHarness` is undefined inside `verify.ts` and the judge returns
   `not_judged` ("The judge failed before it answered").
   - I confirmed it is not mine: the probe still failed with every `site-change` edge removed from
     `agreement/` and `refuted-no/`.
   - My test imports the judge first, with a comment saying why. This is a real module cycle, and
     production entry order may be all that hides it.
5. **Re-pin.** Both verification pins in `system-prompt-pins.json` moved by exactly the inserted
   sentences, and no other pin changed.
