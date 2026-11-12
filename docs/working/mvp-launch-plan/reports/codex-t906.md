# Codex t906: restore site-reset acceptance

Outcome: Partial — assertion coverage restored; a reproduced product readiness failure blocks acceptance.

## Findings and decisions

- Read the prior t906 report, validation intake, and MVP launch Current State before source inspection. Lead merged current dev into this task and prepared shared Core before authorizing validation.
- The job-redraw spec's `tests[0]` is absent after Core completes a judged yes. Assertions against its missing `failed` and `actsUnsettleable` fields are vacuous. Removed that dead answer capture. Actual undo answers contain `resetSettlement.open` and `resetSettlement.actsStillOpen`, not top-level `actsToUndo`. The assertions require that nested contract, an exact three-act list with settle instructions, exact inherited trial act identity, an explicit `leftFromEarlier` array, a real successful unskipped trial click, and final site state.
- Existing office assertions already inspect judge `startedWith`, Flow shape, and end view. The retained passing artifact confirms project trials do not expose `buildTest` in that request, so adding assertions over that absent field would repeat the same error.
- Added metadata-only gateway observation through both existing public `executeAction` overloads, preserving durable options and forwarding the returned result unchanged. It includes trial playback, which the evidence runtime's own click count excludes. Trial click assertions require a nonempty, exact one-result list with `status: succeeded`; absent or failed execution cannot satisfy them.
- The store intentionally installs Buy Now's listener 1200 ms after page load (`client/product-script.ts`, `STORE_TIMINGS.productHydrate`). Passive office instrumentation records listener and press timing, including whether the listener was installed at each press, without waiting or changing behavior. The one-worker rerun reproduced the historical two-miss failure and proved both trial presses preceded the listener; see measurements below. Product changes are outside this worker's owned paths and have been routed to the lead.
- The save-then-read script selected the first detected column, `data-jk`, and stored opaque job IDs under a `title` label. This test defect became visible only after requiring the judge's actual dataset. Select the detected text column whose sample is the observed saved job title. Require the exact nonempty title dataset (the two originally saved titles plus the new title), exactly one record set/one title column, and the four-step Flow. An exploration-only read cannot satisfy these assertions.

## Validation

- `Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize` -> 2,687,812 KiB free / 12,513,528 KiB visible before builds.
- `git diff --check` -> exit 0 before validation.
- Guarded `pnpm --filter @fluxiq-web-extension/domain build` -> exit 0, 36.9 s; current shared Core confirmed.
- `node scripts/structure-audit.mjs` -> exit 0, `structure-audit: passed (249 warning(s), 552 baselined).`
- Guarded `pnpm exec tsc -p tsconfig.test.json --noEmit` from `apps/extension` -> exit 0, no errors. This preceded final assertion corrections; final typecheck remains required.
- Guarded `pnpm test:e2e -- <three spec paths> --workers=1` -> extension bundles built; `3 failed, 1 passed (3.1m)`. The literal `--` made Playwright ignore the worker option, so it used four workers. Office passed (39.9 s); job variants failed (41.1/41.9 s) on my new top-level settlement assertion; save/read failed (27.6 s) because the dataset held IDs rather than titles. Inspected retained diagnostics and corrected both test causes above, with no concurrency attribution.
- Office's trial first press occurred at document age 753 ms before the listener installed at 1347 ms; its second press at 1577 ms had the listener and succeeded. This proves the first-press hydration miss and recovery mechanism. The historical two-miss failure remains unreplicated; no product fix is claimed.
- Guarded direct `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts --workers=1 site-reset/tests/job-undo-redraws-on-load.spec.ts site-reset/tests/office-site-reverted-toggle.spec.ts site-reset/tests/judged-change/tests/judged-change-save-then-read.spec.ts` -> `2 failed, 2 passed (5.2m)`, **one worker confirmed**. Job A/B passed (31.0/30.1 s). Save/read's exact three-title dataset passed, then its four-label assertion found a generated `builtin.control.start` node without a label. Corrected by requiring exactly one generated start definition and exactly four authored labels; no dataset assertion relaxed.
- **Office historical failure reproduced (32.7 s).** Trial presses at document ages **359.2 ms and 1178.4 ms both had `listener:false`**, then the listener installed at **1273.6 ms**. Actual trial action: `status: failed`, `validation: failed`, `failureCode: web.validation.output_not_observed`. The trial returned `execution_failed`; its Buy Now step's feedback says both presses were ignored, and the build ended `flow_bootstrap.evidence_repeat_without_progress`. The command completed its two presses before hydration, and no successful trial happened. The exact successful-unskipped-result assertion caught it. No product fix or test wait added.
- Evidence: `apps/extension/e2e/test-results/artifacts/site-reset-tests-office-si-0fe1a-f-and-admits-the-next-trial/reset-office-toggle.json` and its `trace.zip`; job and save/read diagnostics are in sibling test output directories. All are ignored, isolated scenario artifacts.
- Latest source is frozen after accounting for the generated start node; final typecheck and save/read rerun remain required. Office acceptance requires a product fix in the content/readiness/retry owner before revalidation.

## Not verified

No claim that final source passes yet. Office root cause is reproduced and routed, not fixed in this bounded brief. No paid run, full suite, panel management, or git mutation performed.

## Handoff

- All worker commands ended naturally. Final `heavy-slot.mjs status` printed `queue: empty` with no active slots; this worker has no remaining process.
- Product source pointers: `apps/scenario-lab/src/scenarios/everything-store/client/product-script.ts:102` schedules hydration; `client/timings.ts:26` sets 1200 ms; `apps/extension/src/content/actions/click.ts:415` chooses the second press; `click.ts:702` builds ignored-twice validation. Do not add a test delay or weaken the fixture/oracle to hide the failure.
- Exact final browser command (from `apps/extension`): `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts --workers=1 site-reset/tests/job-undo-redraws-on-load.spec.ts site-reset/tests/office-site-reverted-toggle.spec.ts site-reset/tests/judged-change/tests/judged-change-save-then-read.spec.ts`.
- Final typecheck: `pnpm exec tsc -p tsconfig.test.json --noEmit` from `apps/extension`. Earlier clean typecheck predates the final assertion edits. Structure audit should be rerun after product edits; no full suite authorized in this brief.
- Latest stdout was observed through the command session; there is no separate text log. HTML report: `apps/extension/e2e/test-results/report/index.html`. Office diagnostic/trace exact paths are above; save/read diagnostic is `apps/extension/e2e/test-results/artifacts/site-reset-tests-judged-ch-79f83-ve-skipped-already-in-state/change-job-save-then-read.json` (the latest entry-node assertion was corrected after this run). Job diagnostics: `.../site-reset-tests-job-undo--6bc13-e-list-redraws-only-on-load/reset-job-redraw.json` and `.../site-reset-tests-job-undo--edb2d-t-that-redraws-only-on-load/reset-job-redraw.json`.
- Only the four owned source files and this report were edited. The untracked `codex-validation-intake.md` was already present and was only read. All changes remain uncommitted by worker policy and because acceptance is blocked.

Outcome: Partial
Changed: `apps/extension/e2e/site-reset/instrumented-runtime.ts`; the three owned spec files; this report.
Validation: direct focused Playwright command -> 2 passed, 2 failed (5.2m); actual office readiness failure reproduced; save/read dataset proved, then generated-entry assertion corrected. Earlier extension test typecheck/domain build/structure audit passed as recorded above.
Not verified: final assertion edit typecheck/rerun; product readiness fix and final acceptance; no full suite.
Report: `docs/working/mvp-launch-plan/reports/codex-t906.md`
Notes: No processes remain. Lead routing product fix; no git mutations or paid work.
