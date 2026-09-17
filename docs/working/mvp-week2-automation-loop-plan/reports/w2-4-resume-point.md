# Phase 2.4, Core — can the run resume, and from where?

Worked entirely in the isolated pair `F:\fxwork\t004\!FluxIQ` and
`F:\fxwork\t004\!FluxIQWebExtension`, branch `task/t004-resume-point`. Nothing
in `F:\!FluxIQ` or `F:\!FluxIQWebExtension` was touched except this report.
Nothing was committed or merged.

## Outcome

Done. The existing change verdict now answers two questions instead of one, and
answers them separately: **was the change proved?** (`outcome`, `basis`,
unchanged) and **may normal deterministic execution continue, and from where?**
(`resumable`, `notResumableCode`, `resumeFrom`). No second verdict was built,
and nothing was added under `AS/runtime/recovery/`.

The coordinator's mid-task addition — the live fail-open where a host's
`passed: true` over conditions nobody could judge became evidence — is fixed in
the same worktree, with the end-to-end test that was missing.

## The extended contract

`AS/runtime/flow-change/contracts.ts`:

```ts
type AutomationStudioChangeResumePoint =
  ({ nodeId: string; route: string } | { completed: true }) & { subflowId?: string };

type AutomationStudioChangeVerdict = {
  schemaVersion: "automation-studio.change-verdict.v2";   // was v1
  outcome; basis; checks;                                 // unchanged
  resumable: boolean;                                     // new
  notResumableCode?: string;                              // new, present exactly when !resumable
  resumeFrom?: AutomationStudioChangeResumePoint;         // now on every outcome
  reason;
};

type AutomationStudioChangeVerdictInput = { /* … */ subflowId?: string };   // new
```

Three changes of behaviour, against the three gaps in the brief:

1. **`resumable` exists**, decided by a new module,
   `AS/runtime/flow-change/resume.ts` (`decideAutomationStudioChangeResume`),
   which reads the `checks` array and the resume point and **never reads
   `outcome`**. It is a separate file so the independence is structural rather
   than a comment: `verdict.ts` calls it, not the other way round.
2. **`resumeFrom` is emitted on every outcome that has a well-defined
   continuation**, including `unverifiable` and `contradicted` — previously only
   on `verified`. Where a run reached is a fact the trial observed. Whether it
   may go there is now `resumable`, and the two are no longer conflated.
3. **The resume point carries `subflowId`**, fed by `trial.ts` from
   `options.currentSubflowId`. A node id is unique only inside its own graph, so
   a continuation inside a Subflow that named a bare node id read as a node of
   the parent Flow.

`AUTOMATION_STUDIO_CHANGE_VERDICT_EVIDENCE_KINDS` moved from `verdict.ts` to
`contracts.ts`. Its public name is unchanged (both files are re-exported by the
barrel); the move exists so the verdict and the resume decision read one list
instead of each keeping its own idea of what counts as evidence, and so
`resume.ts` need not import a value from `verdict.ts` and close a module cycle —
the cycle class the repository's own audit config warns about at length.

The schema version was bumped to **v2**. Nothing in either repository reads the
string (grepped: only `dist/`, which is build output), and a stored v1 verdict
genuinely cannot answer the resume question — a reader that finds no `resumable`
on it gets `undefined`, which is falsy, which fails closed.

## How `resumable` is decided, and where it fails closed

In precedence order; the first that applies sets `notResumableCode`:

| Code | When | Why closed |
| --- | --- | --- |
| `no_checks` | the trial judged nothing (`not_executed`) | nothing to continue from |
| `check_failed` | any check failed | the change was contradicted |
| `check_unknown` | **any check is `unknown`** | a check exists because something declared it, so "could not tell" is not "held" |
| `no_resume_point` | the continuation is not well defined | cannot resume where the trial could not name |
| `no_evidence` | no evidence check passed | **success alone is never evidence** |

Otherwise `resumable: true`, with no code.

Four things make this fail closed rather than open:

- **`resumable` is a boolean whose safe value is `false`.** There is no third
  state to be optimistic about, and the absence of the field on an older verdict
  reads as `false`.
- **Unknown outranks evidence that did pass.** A change proved by a later
  assertion, whose own node's declared state the host could not evaluate, is
  `verified` and **not** resumable. That is the sharpest divergence between the
  two answers and the reason they are computed separately — under the old
  single-answer shape it was verified, and therefore resumed.
- **Success alone never resumes.** A changed node that ran without failing, with
  a perfectly well-defined continuation, is `unverifiable`, carries its
  `resumeFrom`, and is not resumable (`no_evidence`).
- **An inert seam reads as unknown, never as a pass.** See below.

### `records.minimum`, left inert but no longer optimistic

The seam is untouched as instructed: `capturedRecords` in `trial.ts` still
returns `{ captured }` only, and the real signal lands with extraction X4.

What changed is how a pass resting on it reads. `recordsCheck` now emits
`{ status: "passed", code: "records_minimum_undeclared" }` when no attempt
declared a minimum. For `basis` that is still a pass — rows captured are a real
observation, and the existing test that a change is verified by captured rows
alone still holds. For the resume decision, `resumeStatus()` maps that code to
`unknown`, so a records-only change reports `resumable: false` /
`check_unknown` until something declares how many rows the extraction owed.

Chosen deliberately, and it is the most debatable call here: it means a recovery
that changed an extraction node cannot be declared resumable before X4 lands.
That is the fail-closed direction, and the alternative — "1 row captured where
50 were owed, carry on" — is exactly the optimistic default this phase exists to
remove.

### The fail-open one layer below, now closed

`trial.ts`'s `observedHostRuntime` read only `evaluation.passed`. The downstream
domain returns `{ passed: true, checkedConditionCount: 0 }` for "nothing I was
asked could be looked at" — its own documented contract, and the common answer
when a model authors a condition naming something the page cannot be asked. The
chain ran: `passed: true` → recorded `"passed"` → `expectedState: "passed"` →
`check("expected_state", "passed")` → `basis` → `verified` → resumable. A
recovery whose required evidence was never looked at reported as proved and safe
to continue, without any condition being wrong.

Now:

```ts
const judged = conditions.length > 0 && (evaluation?.checkedConditionCount ?? 0) >= conditions.length;
record(context, evaluation?.passed === true && judged ? "passed" : evaluation?.passed === false ? "failed" : "unknown");
```

`expectedStateCheck` already mapped anything but `"passed"` to `unknown` /
`expected_state_unevaluated`; it simply was not being fed. A rejection
(`passed: false`) still counts as a rejection whatever the count, because a host
that rejected did look at something.

One deviation from the line the coordinator supplied: `conditions.length > 0 &&`
is mine. A host asked about nothing and answering `passed: true` has judged
nothing, so that is unknown too rather than vacuously true. It cannot arise on
the transition-comparison path (`expectationRequest` wraps a bare expected state
into a one-element list) but can on the policy-node path, where the node's
`conditions` may be an empty array.

## Mutation results

Each mutation was applied alone, the suite run, then the file restored from a
byte copy and the suite re-run green.

| Mutation | Observed |
| --- | --- |
| make an `unknown` required check resumable (drop the `check_unknown` clause in `resume.ts`) | **12 failed / 136 passed** — 5 in `resume.test.ts` (each unknown kind, and the inert records seam), 2 in `trial.test.ts` (the unjudged-host pair), 5 in `verdict.test.ts` |
| emit `resumeFrom` only on `verified` again (drop it from the three non-verified returns in `verdict.ts`) | **6 failed / 142 passed** — the unverifiable, contradicted, route-repeats-failure and merely-succeeded cases, in both `verdict.test.ts` and `trial.test.ts` |
| drop the subflow from the resume point (drop `...inSubflow`) | **2 failed / 146 passed** — `names the Subflow the trial ran in on either shape of resume point`, and the end-to-end `names the Subflow the run's options put it in on the resume point` |
| revert the `judged` guard in `trial.ts` (the coordinator's probe) | **2 failed / 146 passed** — `is unknown, not a pass, when the host judged none of what it was asked` and `… judged only some of what it was asked` |

The `live-patch.test.ts` mutation pair the brief said to keep passing is green
throughout: 23/23 in every run above, including all four mutations. None of the
four touched `expectedRouteCheck` or `failedDeclaredRoute`.

## What was validated, with observed output

All Core commands were run from inside
`F:\fxwork\t004\!FluxIQ\packages\fluxiq`, never a repository root.

`npx tsc --noEmit` — exit 0, no output.

`npx vitest run src/programs/automation-studio/runtime/flow-change src/programs/automation-studio/runtime/tests/live-patch.test.ts`:

```
 ✓ .../flow-change/tests/resume.test.ts (14 tests) 4ms
 ✓ .../flow-change/tests/contracts.test.ts (12 tests) 6ms
 ✓ .../flow-change/tests/confidence.test.ts (20 tests) 7ms
 ✓ .../flow-change/tests/trial.test.ts (25 tests) 27ms
 ✓ .../flow-change/tests/verdict.test.ts (54 tests) 19ms
 ✓ .../runtime/tests/live-patch.test.ts (23 tests) 28ms

 Test Files  6 passed (6)
      Tests  148 passed (148)
```

`npx vitest run src/programs/automation-studio` — **2120 passed, 1 skipped, 1
failed (2122)** in 123s. The one failure was
`deepseek-bootstrap-exploration.test.ts > … asks again after a malformed
decision …`, failing with `flow_bootstrap.provider_transport_unknown` against a
3,000 ms deadline. Rerun alone, that file passed 8/8 in 46s, with the same test
taking 3,017 ms — a deadline missed under full-suite load. It is a provider
transport test that touches no flow-change code. Called environmental on the
strength of one clean solo rerun, per this machine's known fault.

`npx vitest run` (the whole `packages/fluxiq` suite) — **2487 passed, 1 skipped,
1 failed (2489)** across 285 files in 139s, exit 1. The one failure was again in
`deepseek-bootstrap-exploration.test.ts`, but a *different* test of it:
`asks again after a decision that runs past its deadline`. That file passed 8/8
alone both times it was rerun (46s and 58s), and the test that failed under load
differed between the two loaded runs — a deadline-driven file missing deadlines
under load, not a defect this change introduced. It imports nothing from
`flow-change/`.

`node scripts/structure-audit.mjs` (from the Core worktree root) — exit 0:

```
structure-audit: passed (161 warning(s), 361 baselined).
```

No finding names any file in `flow-change/` except one new advisory:
`flow-change/tests/verdict.test.ts: 513 lines is past the 400-line advisory
threshold` (hard limit 800; `live-patch.test.ts` is 640, and `tests/` files of
400–750 lines are the norm here). Left as is rather than scattering the resume
story across two files for the sake of 28 lines.

`npx biome check` on the directory reports that the path is ignored by
`biome.json`, so the repository's `quality:check` does not cover these files.

## Files changed (Core worktree only)

- `AS/runtime/flow-change/resume.ts` — **new**, the resume decision (51 lines,
  one export).
- `AS/runtime/flow-change/tests/resume.test.ts` — **new**, 14 unit tests over
  hand-written checks.
- `AS/runtime/flow-change/contracts.ts` — resume point, resume decision,
  `resumable` / `notResumableCode`, input `subflowId`, v2, evidence-kinds
  constant moved in.
- `AS/runtime/flow-change/verdict.ts` — resume point on every outcome,
  `resumable` filled from the resume decision, subflow on the resume point,
  `records_minimum_undeclared`.
- `AS/runtime/flow-change/trial.ts` — `subflowId` from
  `options.currentSubflowId`; the `judged` guard.
- `AS/runtime/flow-change/index.ts` — barrel.
- `AS/runtime/flow-change/tests/{verdict,trial}.test.ts` — updated invariants,
  new resumability, subflow and unjudged-host cases.
- `docs/architecture/automation-studio.md` — new section "What a trial proved,
  and whether the run may continue".

## Not verified

- **No live browser validation, and no live provider run.** Everything here is
  Core unit-level. The claim that the domain returns
  `{ passed: true, checkedConditionCount: 0 }` for unjudged conditions is taken
  from the sibling worker's report and the coordinator's confirmation; I did not
  read `domain/src/runtime/expectation/evaluate.ts` myself and did not exercise
  the two sides together.
- **Nothing consumes `resumable` yet.** `resumeFrom` had no consumer before this
  task (grepped: only `live-patch.ts`, which passes the verdict through) and
  still has none. The contract now answers the question; no caller acts on the
  answer, so the end-to-end property "the run actually stops" is unproven — only
  "the verdict refuses to say it may continue".
- **A persisted v1 verdict was not migrated or read back.** Nothing reads the
  schema string today, so the bump is untested against stored data.
- **`pnpm check`, `pnpm test` and `pnpm build` at either repository root were
  not run.** The narrowest relevant checks, the whole automation-studio program,
  the full Core package suite and the structure audit were run instead.
- **The downstream repository was not built or tested.** No downstream file
  references the verdict contract (grepped).

## Open questions and contradictions found

1. **The resume answer has no caller.** The phase now produces a trustworthy
   `resumable`, but the recovery path does not consult it: `live-patch.ts`
   returns the verdict and the adaptive orchestrator decides what to do next
   without reading it. Until something refuses to continue on
   `resumable: false`, the fail-closed property lives only in the contract. That
   is the natural next brief, and it is not in this one.
2. **`records` is fail-closed for resumption until X4 lands.** Deliberate, and
   flagged because it changes behaviour for extraction recoveries specifically:
   they report not-resumable with code `check_unknown` until a minimum is
   written. If that is too strict before X4, the one-line relaxation is to drop
   `records_minimum_undeclared` from `INERT_CHECK_CODES` in `resume.ts` — but I
   recommend against it.
3. **A verdict can be `resumable: false` with a perfectly good resume point, and
   nothing in the type stops a caller reading `resumeFrom` and resuming anyway.**
   The doc comments say plainly that presence is not permission and that
   `resumable` is the permission, but the two fields are structurally
   independent. Folding the point inside a discriminated `resume` field would
   make misuse impossible rather than merely documented; it would also change
   the shape a second time, so it is raised rather than done.
