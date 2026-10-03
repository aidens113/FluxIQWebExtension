# t193-1002m-w2: a hidden target cannot run (worker report)

Brief: t193-1002m-w2-hidden-target-cannot-run (worker-high). Tree
`C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQWebExtension`, branch
`task/t193-live-self-repair`. No commits. Test build label `t193-1002m-w2`.

## Outcome

Done. The actionability gate's `hidden` refusal now travels as a new closed code,
`TARGET_NOT_SHOWN` = `web.target.not_shown`, category `target_not_found`, retryable
`true`, stage `target_resolution`. So Core's state routing and its sometimes-present
skip, which run only for `target_not_found`, now apply to a step whose target is in
the DOM but not shown. `disabled` and `covered` stay `TARGET_NOT_ACTIONABLE`
(`unexpected_state`, not retryable, `execution`), unchanged. The page-side recovery
loop, the word the model sees, and the draft replay treat a hidden target exactly
as they did before.

## Design

- **Code table** (`domain/src/runtime/failure/codes.ts`). A new key,
  `TARGET_NOT_SHOWN`, placed right after `TARGET_NOT_ACTIONABLE`, and a new row
  `{ category: "target_not_found", retryable: true, stage: "target_resolution" }`.
  Core's parser allows `target_not_found` only at `target_resolution`, and it does
  not forbid retrying that category, so the record survives the parser. A test checks
  this, including with `effect: "unacted"`.
- **Producer** (`apps/extension/src/content/action-runtime/results.ts`). The set
  `PAGE_STATE_REASONS` was replaced by `PAGE_STATE_CODES`. This is a
  `Record<ActionabilityRejectionCode, WebAutomationFailureCode>`, exhaustive over the
  gate's three reason words: `disabled` and `covered` map to `TARGET_NOT_ACTIONABLE`,
  and `hidden` maps to `TARGET_NOT_SHOWN`. A small `refusalCode(reason)` helper
  returns `ACTION_REJECTED` for any other reason word. The reason still leads
  `actual` (`hidden: ...`). The dialog branch runs before this, so a hidden target
  under a dialog is still `BLOCKED_BY_DIALOG` or `USER_INTERVENTION_REQUIRED`, as
  before. Every `hidden` refusal comes from the gate, before any verb dispatches: I
  checked every `deps.rejected` call site in `content/actions/`.
- **Local recovery** (`recovery/fault.ts`). The new code is added to
  `OBSTRUCTION_FAULTS` as `obstructed_target`. No reason word is needed, because the
  code is only ever produced from `hidden`. It is also added to
  `RECOVERY_FAULT_BY_CODE`, because the totality test requires a fault word for every
  retryable code. Because `obstructionFault` runs first, the loop still clears what is
  over the target and then attempts again, on every verb, as it did for a hidden
  `TARGET_NOT_ACTIONABLE`. The refused-control note still covers `disabled` only.
- **Model-facing word** (`domain/src/runtime/llm-evidence/action-failure/refusal.ts`).
  `BY_FAILURE_CODE[TARGET_NOT_SHOWN] = "target_not_actionable"`, with no reason
  detail, so exploration is unchanged. `tool-rejection.ts` needed no change: its
  existing `target_not_actionable` doc already says "disabled or hidden".
- **Draft replay** (`node-run/replay.ts`): no change needed. It sends only
  `TARGET_NOT_FOUND` to `missing-target.ts` (`remembered` / `unreproducible`), so
  `web.target.not_shown` answers `core.replay.failed`. A test now pins this.
  `verify.ts` also checks for `TARGET_NOT_FOUND` by code, so it is unaffected.
- **Exhaustiveness**: the compiler reported no errors. The only `Record` over the
  rejection reasons is the new `PAGE_STATE_CODES`. Every other consumer of the set
  derives from the table (`isWebAutomationFailureCode`, `domain/src/runtime/adapter.ts`,
  `expectation/evaluate.ts`, `recovery/record.ts`) or is a `Partial` map that its
  tests hold total. No scenario manifest expects a hidden refusal: the
  `web.target.not_actionable` expectations in `apps/scenario-lab` are all for disabled
  or covered targets (failure-surfaces disabled, member-directory support-drawer
  covered, basic-form covered).

## Every file

Source:
- `domain/src/runtime/failure/codes.ts`: new code, new definition row, and updated
  `TARGET_NOT_ACTIONABLE` doc.
- `apps/extension/src/content/action-runtime/results.ts`: per-reason code map and
  `refusalCode`; imports the gate's reason type.
- `apps/extension/src/content/action-runtime/actionability.ts`: header comment only
  (names both codes).
- `apps/extension/src/content/action-runtime/recovery/fault.ts`: new code added to
  `OBSTRUCTION_FAULTS` and `RECOVERY_FAULT_BY_CODE`, plus a comment.
- `domain/src/runtime/llm-evidence/action-failure/refusal.ts`: new code mapped to
  `target_not_actionable`.

Tests:
- `domain/src/runtime/failure/tests/codes.test.ts`: table row, and a new test for the
  hidden record (category, Core parse with `unacted`, disabled/covered row unchanged).
- `domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts`: new test
  that the hidden code is `target_not_actionable` with no detail, and that
  disabled/covered are unchanged.
- `domain/src/runtime/llm-evidence/tests/page-refusal.test.ts`: one case-table row.
- `domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts`:
  new test that a replayed hidden step answers `core.replay.failed`. The helper now
  takes an optional `actual`. I added it to this file rather than a new one because
  `node-run/tests/` is at the audit's 25-file limit.
- `apps/extension/src/content/action-runtime/tests/results.test.ts` (new): the real
  `actionRejected` with a stub page. `hidden` gives `TARGET_NOT_SHOWN` with the full
  record; `disabled` and `covered` give `TARGET_NOT_ACTIONABLE` unchanged; any other
  reason gives `ACTION_REJECTED`.
- `apps/extension/src/content/action-runtime/recovery/tests/fault.test.ts`: new test
  that hidden is `obstructed_target` on every verb under both codes; the read-only
  absorb list now includes `obstructed_target`.
- Playwright content specs, updated only where a hidden target was asserted:
  `apps/extension/e2e/content/tests/failures.spec.ts` (hidden test and two titles or
  comments), `click.spec.ts` (hidden click), `select.spec.ts` (hidden select),
  `actionability/tests/actionability-gate.spec.ts` (inert upload, which the gate calls
  `hidden`).

Docs:
- `docs/architecture/failure-taxonomy.md`: count corrected to twenty-two (it said
  nineteen when the table already had 21 rows), new table row, producer line, and a
  new section on `TARGET_NOT_SHOWN` and how the other consumers read it.
- `docs/architecture/web-capabilities.md`: the result-contract bullet.

## Commands run and observed results

Failing first (before any source change), with the scoped runner
`<scratchpad>/t193-1002m-w2-scoped-tests.mjs`. It bundles only the named test files,
exactly as the package scripts do, into `<pkg>/.test-build-scratch/t193-1002m-w2/`.
- Domain (`codes`, `action-failure/refusal`, `page-refusal`, and the replay test,
  which was then in its own file): `# tests 29 # pass 23 # fail 6`. The failures:
  codes tests 1-3 (the table has a `TARGET_NOT_SHOWN` row the set lacks), test 13
  (new hidden-record test, TypeError on the undefined code), test 20 (new refusal
  test), test 29 (page-refusal case table). The replay test **passed before the
  change**: the replay was already correct for any code other than `not_found`, so
  this test guards against regression rather than failing first.
- Extension (`results.test.ts`, `fault.test.ts`): `# tests 21 # pass 19 # fail 2`.
  Test 15 (hidden under the new code is not `obstructed_target`) and test 19 (actual
  `category: 'unexpected_state', code: 'web.target.not_actionable', retryable: false,
  stage: 'execution'` against the expected `target_not_found` / retryable /
  `target_resolution`). The disabled/covered and `ACTION_REJECTED` tests passed before
  and after, as they should.

After the change:
- `node <runner> domain domain/src/runtime/failure/tests domain/src/runtime/llm-evidence/action-failure/tests domain/src/runtime/llm-evidence/tests domain/src/runtime/llm-evidence/node-run/tests`:
  `running 56 test files`, `# tests 391 # pass 391 # fail 0`, exit 0.
- `node <runner> domain domain/src/client/tests domain/src/runtime/tests domain/src/runtime/expectation`:
  `running 17 test files`, `# tests 146 # pass 146 # fail 0`, exit 0.
- `node <runner> apps/extension apps/extension/src/content/action-runtime apps/extension/src/content/actions`:
  `running 42 test files`, `# tests 379 # pass 379 # fail 0`, exit 0.
- `node <runner> apps/extension apps/extension/src/runtime/tests`:
  `running 19 test files`, `# tests 244 # pass 244 # fail 0`, exit 0.
- Typechecks, all with exit 0 and no output: domain `npx tsc -p tsconfig.json --noEmit`,
  domain `npx tsc -p tsconfig.test.json --noEmit`, extension
  `npx tsc -p tsconfig.json --noEmit`, extension `npx tsc -p tsconfig.test.json --noEmit`.
  The extension test config includes `e2e/**/*.ts`, so the edited specs typecheck.
- `node scripts/structure-audit.mjs`: the first run failed on 2 violations, both mine:
  a conditional spread in `refusal.test.ts` (`contract-spread`) and
  `node-run/tests/` reaching 26 files. I fixed both (no spread; replay test folded into
  the existing file). The rerun printed `structure-audit: passed (159 warning(s), 118 baselined).`
  with exit 0.
- `pnpm --filter @fluxiq-web-extension/extension build`: exit 0; chrome, firefox and
  e2e-chromium each "verified 22 files". The build cache noted "not stamped, because
  inputs changed while it ran (core:packages/fluxiq/dist)". Core's dist was being
  rebuilt by someone else at the same time; the build itself succeeded.

## Not verified

- I did **not run** the Playwright content harness specs I edited (`failures.spec.ts`,
  `click.spec.ts`, `select.spec.ts`, `actionability-gate.spec.ts`). They only
  typecheck. They assert, in a real page, that hidden gives `web.target.not_shown` /
  `target_not_found`, and that `actual` still starts with `hidden: ...;` after the
  recovery account is appended.
- No live run. I did not exercise Core's state routing or the absent-step skip
  against the new code. Reading Core: `could-not-run.ts` and `absent-step.ts` check
  only `attempt.failure.category === "target_not_found"`, and Core's parser accepts the
  record.
- Core's retry ladder now treats a hidden step as retryable `target_not_found`, where
  it used to treat it as non-retryable `unexpected_state`. So Core may spend its retry
  rung and state routing on it instead of going straight to diagnosis or repair. That
  is what the brief asks for, but I did not measure its effect on run time or cost.
- Full suites: not run, per the brief.

## Open questions or contradictions found

- `docs/architecture/testing-facility.md` (lines about 909 and 1696) still says
  `web.target.not_actionable` covers "hidden, covered, disabled". Another worker has
  uncommitted edits in that file, so I left it alone. One sentence there needs "hidden"
  dropped and `web.target.not_shown` named. The same wording is in a comment in
  `packages/test-contracts/src/scenario.ts` (about line 108), which the brief does not
  give me. Comment only, no behavior.
- `domain/src/runtime/adapter.ts:252` and `recovery/record.ts` rebuild records from the
  code row, so the gate's call-site `effect: "unacted"` is dropped before the record
  reaches Core. This was already true for every code and is unchanged here. I note it
  only because a retryable `target_not_found` with `unacted` would tell Core's
  defensive executor that a retry repeats no act.
- The header of `recovery/fault.ts` still says "Five codes say yes" to `retryable`.
  That count was already wrong before this change (RATE_LIMITED, TRANSPORT_TRANSIENT),
  and I left it as it was.
