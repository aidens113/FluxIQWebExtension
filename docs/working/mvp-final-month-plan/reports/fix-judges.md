# t286 judges and repair: report

Lead: t286 (lead-xhigh). Trees `fxwork/t286/!FluxIQ` (branch `task/t286-fix-judges`) and
`fxwork/t286/!FluxIQWebExtension` (same branch). Nothing committed. `R` =
`packages/fluxiq/src/programs/automation-studio/runtime` in Core. Worker reports: `fix-judges-{a,b,c,d,e}.md` beside
this file.

Brief: the t286 bullet of "Briefs: fix every open item of the week report" and the shared rules of the round-3 fix
briefs in `docs/working/mvp-final-month-plan.md`. Items: W4 open (exploration leftovers read as the Flow's result; an
in-place URL rewrite read as a location change), W17 (the re-author cannot end "nothing to change"), lane C R3-3,
`testedLabel` hidden from the judge, W7 R2-C8.

## Outcome (2026-10-06)

| Item | State | Where |
| --- | --- | --- |
| W4a judges read state that predates the run or test | **Done**: both judges get `startView` and are told to credit only what changed | worker C + lead |
| W4b in-place URL rewrite read as a page move | **Done**: document identity (`timeOrigin`), diff `documentChanged`, Core skips only real page moves | worker B + lead |
| `testedLabel` hidden from models | **Done**: judge's copy and the recovery model's copy | worker A + lead |
| W7 R2-C8 | **Done** in `verify-only.ts`; one optional follow-up in t283's `replay-draft.ts` | worker A |
| W17 re-author "nothing to change" | **Ready, inert until a 4-edit patch to `R/service.ts` (t282's file) lands** | worker D |
| R3-3 rows now kept after a rerun | **Partial**: data and function ready; wiring is t287's `evidence-loop.ts`/`resume.ts`, and live reads need `readRows` (downstream domain, t284's area) | worker E |

## What changed, per item

**W4a (`startView`).** Runs `run-musp8nz1` cause 3, `run-musq0b1m` cause 7, `run-mux6pndp` line 45 (judges read
"2 · $28.96", soap plus exploration's 3-Pack, as the two towel packs).
- Finished run: `R/result-verification/result-summary.ts` reads `startView` off the session trace (first attempt that saw
  the page; the page it left when its diff says `documentChanged`, else `locationChanged` for older diffs; otherwise the
  page it found), cut to the domain's declared view keys, screened as `endView`. Lead change: when the ports name no
  view keys, it uses the keys the end view holds (the end-view reader already cut them to the declared ones), so it
  works today without touching `R/service.ts`. `run-outcome.ts` has an optional `observedStateKeys` port (now 800
  lines, the fail limit: split before the next addition).
- Build test: `R/llm/node-tools/dry-run-gate.ts` takes one look through the existing `endView` hook just before each
  replay (`core.dry_run.<n>.start_view`); a failed look is no start view, never a failed test. `build-judge.ts` and
  `build-test/summary.ts` pass it, screened. `evidence-loop.ts` untouched.
- Instructions (`R/llm/diagnosis-instructions.ts`): one sentence each; the end view's "do not suppose a step left undone"
  now excludes what `startView` already showed; "may predate the test" is gone. Both prompts re-pinned.

**W4b (`documentChanged`).** Extension `content/evidence/navigation.ts` carries `performance.timeOrigin`; domain types
and sanitizer carry it as a finite number only; `host-runtime.ts` puts `documentTimeOrigin` on the state summary beside
the view (never in the page text, never in `publishedWebLlmPage`); `state-diff.ts` adds `documentChanged`;
Core `step-changes.ts` skips only `documentChanged` (old diffs: `locationChanged`). The state digest omits navigation, so
no digest changes. Lead fix: `apps/extension/src/shared/tests/present.test.ts` lists the new optional field.

**testedLabel.** `read-account/judge-paging.ts` drops it on the judge's copy; `verify.ts` flags rows before the paging
copy is made (order swapped, nothing else depends on it). Lead: new `read-account/without-tested-label.ts` shared by the
judge copy and `R/recovery/annotation/annotate.ts`, which handed the raw summary to the recovery model (worker A's
finding); test in `recovery/annotation/tests/annotate.test.ts`.

**R2-C8.** `automationStudioFlowDraftStepWithholdsLater`: a moved target excuses later steps only when the step's own
declaration names something lasting. A step verified only for an instructed act claim (the `run-mux6pndp` 3-Pack link)
no longer sets `withheldBy`, so the existing reanchor puts the next step on its own page, and it must hold there. Cost:
a step after a claim-only verified move whose page cannot be reached again now fails instead of being excused.

**W17.** A wrong-answer re-author that completes its seeded draft unchanged (same Flow signature) is saying the Flow
needs no change; its summary is the reason (`recovery/refuted-result/nothing-to-change.ts`, a watch the completion
check asks). Nothing is approved, applied, held or re-run; `resultReauthor.outcome: "nothing_to_change"` with the
screened reason; the check's verdict stands (smaller change; one model reading does not overrule the check). The brief
now carries the run's own record (each step's change, start and end view) and a "When the Flow needs no change"
section. Today's behaviour without it: an unchanged completion is tested, judged, held as an empty edit and re-run; in
`muw5zv4m` the model never completed (41 of 46 decisions were `amend_draft`).

**R3-3.** `request-rows/checked-rows-named.ts` reads the rows Core's own `checked` lines name, per read and condition;
the build-test judge's no and the repair judgement carry them as `checkedRows`; `request-rows/rerun-rows.ts` says which
a rerun's rows keep, which are still out, and (all kept) to complete.

## Needed in other streams' files (not applied)

1. **`R/service.ts` (t282), for W17**, in place, no new lines: (a) import `type AutomationStudioReauthorEndingWatch`
   from `"./recovery/index.ts"` (line ~89); (b) `generateFlowBootstrapAdaptationInternal` gains a last parameter
   `repairEnding?: AutomationStudioReauthorEndingWatch` (~1472); (c) in `checkCompletion`, right after
   `if (unchanged) { accepted.verdict = undefined; return unchanged; }` (~1581):
   `const nothing = repairEnding?.completed({ seed: extend?.seed.steps, steps: context.steps, result }); if (nothing) { accepted.verdict = undefined; throw nothing; }`;
   (d) the reauthor deps (~2548): `generate: (request, brief, costLeftUsd, startPages, ending) => this.generateFlowBootstrapAdaptationInternal(request, brief, costLeftUsd, startPages, ending),`.
   **Until this lands the brief's new section promises an ending Core does not take** (the unchanged completion would
   go the old tested-and-held way): land W17 together with this patch, or hold W17. Also not carried: the spend of a
   nothing-to-change build (needs the same file to end through the loop's accounting).
2. **`R/activity/wording/run-ending.ts` (t288)**, in `repairEnding` before the "Not re-run" block:
   `if (reauthor?.outcome === "nothing_to_change") return "the fix changed nothing: the run's own record shows it was done";`
   and close the "Checking the proposed Flow" note the ending's throw leaves open.
3. **`R/llm/evidence-loop.ts` and `R/llm/evidence-loop/resume.ts` (t287), for R3-3**: the exact `runCall` change and
   test are in `fix-judges-e.md` ("Wiring to apply"); `resume.ts` `CORE_ON_ROWS` should explain `judge.checkedRows`
   (suggested sentence there), since the judgement value the model sees now carries it.
4. **Downstream domain (t284's area), for R3-3**: a live list read's answer carries no `readRows` (only replay answers,
   `node-run/replay.ts:406`); without it the wiring finds no labels. Either add `readRows.rows` to live read answers or
   let the loop take labels from the read's output rows.
5. **`R/llm/node-tools/replay-draft.ts` (t283), optional for R2-C8**: reanchor the step right after a verified step that
   moved the target before sending it, and keep a declared-lasting step's excuse when that reanchor fails.

## Found, not fixed

- The build test numbers steps by the judged round's draft positions while the repair seed renumbers, so the repair is
  told one read as "Step 9" (`checked`) and "step 5" (`whereToFix`) (`fix-judges-e.md` question 2).
- `screenedText` exists twice (`result-verification/repair-directive.ts`, `recovery/refuted-result/nothing-to-change.ts`).
- E reads `checkedRows` back from Core's own `checked` lines rather than carrying them from `checked-rows.ts`; tested,
  but a format change to those lines must update `checked-rows-named.ts`.
- The re-author brief now carries both page views on every re-author decision (cached prefix; accepted).

## Validation (lead, after every worker stopped)

- Core `node scripts/build-cache/cli.mjs fluxiq:check` -> first run 1 error (my `Object.keys` on a `JsonValue`), fixed;
  second run exit 0 ("stored in the shared store").
- Core `node scripts/build-cache/cli.mjs structure-audit:check` -> first run 1 violation (worker C's test imported
  `../deepseek/system-prompt.ts` past the barrel; rewritten to `automationStudioDiagnosisPromptInstruction`); then
  `structure-audit: passed (266 warning(s), 349 baselined)`.
- Core `npx vitest run` on 170 exact test files (all of `R/result-verification/**`, `R/flow-draft/tests`,
  `R/recovery/{refuted-result,annotation}/tests`, `R/llm/{deepseek,harness}/tests`, dry-run-gate and replay-draft
  tests, `R/llm/tests/diagnosis-channel.test.ts`, `R/service/{flow-bootstrap-commands,runtime-adaptation,end-view}/tests`,
  `R/flow-bootstrap/unfinished-build/tests`, `R/tests/refuted-result`) in four batches -> 45/45/45/35 files passed,
  424 + 368 + 445 + 389 = 1,626 tests passed.
- Lead fail-first: end-view-keys fallback (`judge-sees-the-end.test.ts`) red "1 failed | 13 passed" without it, green
  14/14; annotate `testedLabel` (`annotate.test.ts`) red "expected '{...}' not to contain 'testedLabel'", green 30/30.
  Workers' red/green are in their reports.
- Core `pnpm.cmd build` -> exit 0 (web:build 153 s).
- Downstream: `pnpm.cmd --filter @fluxiq-web-extension/domain check` exit 0 ("Core's build ... is current");
  `pnpm.cmd --filter @fluxiq-web-extension/extension check` exit 0; run-subset + `node --test`: state-diff,
  host-runtime, page-evidence 34/34; navigation and present 10/10; state-digest 45/45;
  `node scripts/structure-audit.mjs` -> `passed (171 warning(s), 118 baselined)`.
- Docs: Core `docs/architecture/automation-studio.md` (step changes, `startView`, `testedLabel`),
  `docs/architecture/package-boundaries.md` (migration note); downstream `docs/architecture/page-evidence.md`.

## Not verified

No live, Lab, browser or provider run (by the rules): `timeOrigin` through a real capture, the judges' use of
`startView`, and the re-author ending end to end (needs item 1 above).
