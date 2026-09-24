# Permission gate narrowing — the instruction is the authority

Worker report. Repository: `F:\!FluxIQ` (FluxIQ Core), branch `dev`, no commit made.

## Outcome

Done. The permission gate now refuses only a **destructive** consequence the
person's instruction did not ask for. Creating something new and sending what
the instruction said to send are no longer the gate's to refuse, on the
authoring path **and** on the repair path. The gate, the request type, the
conversation ask and the cross-check are all intact; the escalation path is
unchanged and still verified end to end.

Direct answer to the question the coordinator is holding a Lab change on:
**yes — after this change a repair running under `explore_and_adapt` can press a
control the instruction asked it to press**, with no grant at all and with the
production default policy (`allowExternalSideEffects: false`,
`requireApprovalForExternalSideEffects: true`, nothing authorized). Two new tests
prove it, one of them through the full recovery-annotation path. The
qualification is below under "What is still gated on the repair path".

## What changed and why

### The rule, as implemented

`packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/destructive.ts`
(new, 81 lines) names which of the five consequence classes a person is still
asked about:

| Class | Gated? | Why |
| --- | --- | --- |
| `move_money` | yes | completing a purchase or checkout, a charge, a refund |
| `delete` | yes | removing something so it is gone |
| `modify_existing` | yes | editing or overwriting what already exists |
| `send_or_publish` | **no** | sending what the instruction said to send destroys nothing |
| `create_new` | **no** | making something that was not there destroys nothing |

The classification is a complete `Record<AutomationStudioActionConsequence, boolean>`,
not a list, so a sixth class added to `AUTOMATION_STUDIO_ACTION_CONSEQUENCES` is
a compile error here until somebody decides whether a person has to be asked
about it.

### The gate

`runtime/action-permissions/gate.ts` — one expression changed. `missing` was

```ts
const missing = automationStudioConsequencesInOrder(consequences.filter((consequence) =>
  !this.permitted.has(consequence) && !instructed.some((entry) => entry.consequence === consequence)));
```

and is now

```ts
const missing = automationStudioDestructiveConsequences(consequences.filter((consequence) =>
  !this.permitted.has(consequence) && !instructed.some((entry) => entry.consequence === consequence)));
```

The instruction's authority (`instructed.ts`) and the grant still both satisfy
the gate exactly as before; what changed is that a non-destructive class never
needed either. The derivation is still run at the same moment (the first action
that declares anything lasting), so what the instruction asks for is still
derived once and still stored with the Flow — narrowing what *stops* a run
narrowed nothing about what is *known*.

`automationStudioActionPermissionDenied` — the check for an action with no run
behind it — narrowed the same way: a non-destructive class is permitted (there
was never anyone to ask about it), a destructive one is refused with no request
(there is no instruction that could have authorised it).

### Why the `instructed` derivation alone was not enough

The brief asked whether the existing cross-check/derivation already covered
this. It does not, and this is the core of the fix. Authorising a create/send act
through `instructed.ts` requires **three** things to go right: a provider call
must succeed, the model must name that exact class, and Core must find the
model's quote word for word in the person's own instruction text. Any one of
those missing dropped the claim, and the run then stopped at a question nobody
was there to answer — for adding an item to a basket. A new test pins this:
`goes ahead even when reading the instruction claimed nothing at all` runs three
gates (derivation returns nothing / derivation throws / no derivation bound) and
all three now proceed.

### The second door: the repair path

The coordinator's extra evidence was correct, and the same change closes it,
because the repair path already routes through this gate. The chain:

1. `runtime/recovery/annotation/patches.ts` asks the recovery's gate about each
   acting patch (`temporary_target_override`, `temporary_action_sequence`).
2. A permitted patch executes with `sideEffectPermission: "permitted"`.
3. `runtime/live-patch.ts` computes
   `policyJudgesSideEffects = sideEffecting && input.sideEffectPermission !== "permitted"`,
   so **both** policy side-effect lines — `allowExternalSideEffects` and
   `requireApprovalForExternalSideEffects` — are skipped for a permitted patch.

Before this change, a repair that pressed a control to make or send something
was refused by the gate, therefore carried no `sideEffectPermission`, therefore
hit `"External side effects are disabled by adaptation policy."` at preflight —
which is what the Lab recorded as `runtime_patch.side_effect_not_authorized`
(`run-mu7gfuph-a57c6b18`) and why it pinned created-Flow repairs to the
proposal-only `diagnose_and_adapt` grant. That refusal is gone.

I did not need to change `live-patch.ts`, `runtime-session-grant.ts` or the
policy defaults. Two other things I checked and found already clear:

- `automationStudioRuntimeSessionGrantRefusal` no longer refuses
  `authorizedExternalSideEffects` for an acting purpose, so the Lab's original
  "a granted run may never authorize an external side effect" is doubly gone —
  and the Lab does not even need to pass that flag now.
- `allowModifyActionTargets` defaults to `true`, so a target override under
  `explore_and_adapt` is not refused by that line either.

### What is still gated on the repair path

A repair whose patch declares a **destructive** class is still asked about. Its
authority on that path comes from the run's grant `permittedConsequences` or
from the Flow's stored `metadata.bootstrapInstructedConsequences` — the set the
*build* derived from the person's instruction, kept only while that instruction
is active and its text unchanged. A recovery deliberately never asks a model to
re-read the instruction mid-run ("authority a model derived mid-recovery would
be authority nobody reviewed",
`runtime/recovery/annotation/permissions.ts`). I did not overturn that decision;
it is Core's, documented, and outside the brief.

The practical consequence for the Lab: if a repair's model declares a Save
button as `modify_existing` and the Flow's build never stored an instructed set
covering it, that repair still escalates rather than pressing. It escalates as a
`permission` ask in the run's own thread where a parking port is bound, and as
`metadata.permissionRequest` + `llmGate.patchHeldCode` where none is — never a
silent preflight refusal. If that turns out to bite live, the fix is either a
grant carrying `modify_existing`, or making the repair re-derive the
instruction, which is a design decision for the supervisor.

### Boundaries respected

- No change to input mapping or registration. `sideEffectAllows` in the
  harness-option registry is untouched: an option labelled `destructive` is
  still never offered, and a `mutate` option still needs
  `mutationsGovernedByPermission`, a policy, or an explicit opt-in.
- No change to redaction. The evidence rule that withholds a control name the
  model was never shown (`gate.carriedName`) is untouched and still tested.
- Nothing committed.

### Files changed

| File | Change |
| --- | --- |
| `runtime/action-permissions/destructive.ts` | **new** — the policy and its rationale |
| `runtime/action-permissions/gate.ts` | narrowed `missing`; narrowed `automationStudioActionPermissionDenied`; header comment |
| `runtime/action-permissions/index.ts` | barrel export |
| `runtime/action-permissions/tests/destructive.test.ts` | **new** — 11 tests |
| `runtime/action-permissions/tests/declared.test.ts` | three rows that used a create/send declaration to prove refusal now use a destructive one |
| `runtime/recovery/annotation/tests/patches.test.ts` | same, plus a new row for the live repair |
| `runtime/recovery/annotation/tests/recovery-permissions.test.ts` | same, plus a new row for the live repair |
| `docs/architecture/automation-studio/llm-flow-bootstrap.md` | new paragraph on the authoring path |
| `docs/architecture/automation-studio.md` | new paragraph on the recovery path and the preflight interaction |
| `docs/reference/framework-reference.md` (+ the `packages/fluxiq` copy) | regenerated; it was already stale before my change |

### New tests

In `action-permissions/tests/destructive.test.ts`:

- the classification itself, and that the non-destructive remainder is exactly
  `["send_or_publish", "create_new"]`;
- **an instruction that plainly asks for a create/send act proceeds unasked** —
  no grant, no request, signal not aborted, declaration still recorded in full;
- the same act proceeds even when the derivation claimed nothing, threw, or was
  never bound (three gates in one row);
- **a destructive act the instruction did not ask for is still gated** — full
  request asserted field by field, including `authority.instructed` carrying the
  person's own quoted words for the classes it *did* ask for;
- **the escalation still carries its request** — it round-trips
  `parseAutomationStudioActionPermissionRequest`, the strict parser a person's
  copy is read back through;
- a mixed declaration asks only about its destructive part while the request and
  the declaration record still carry the whole declared set;
- a grant, or the instruction itself, satisfies a destructive act;
- the no-run-behind-it check permits create/send and refuses destructive.

In `recovery/annotation/tests/`:

- `runs a repair that only makes or sends something, with no grant and the
  policy withholding side effects` (patches.test.ts) — `permissionOutcome:
  "permitted"`, `preflightOk: true`, `issues: []`, `traceStatus` not `not-run`,
  one adaptation saved.
- `runs a repair that only makes something new, with nothing granted and nobody
  asked` (recovery-permissions.test.ts) — the same through the full recovery
  annotation path: no `permissionRequest`, no `patchHeldCode`, adaptation saved.

The pre-existing end-to-end escalation test
(`runtime/tests/service-bootstrap/tests/permission.test.ts`) needed no change: it
uses `move_money` + `modify_existing`, and still asserts
`flow_bootstrap.permission_required`, the request on the stored adaptation, and
approval refused until the ask is answered.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `pnpm --filter fluxiq exec tsc --noEmit` | clean, no output, exit 0 (run twice: after the source change and after the test changes) |
| `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/action-permissions` | `Test Files 5 passed (5)`, `Tests 56 passed (56)` |
| `pnpm --filter fluxiq exec vitest run` over action-permissions + recovery + conversations + parking + service-bootstrap permission + permission-ask + api llm-permission + harness-options | `Test Files 49 passed (49)`, `Tests 606 passed (606)` |
| `pnpm --filter fluxiq test` (whole package, run 1) | `Test Files 3 failed \| 374 passed (377)`, `Tests 3 failed \| 3338 passed \| 1 skipped (3342)` |
| the three failures above, re-run individually | all pass: `8 passed` and `4 passed` |
| `pnpm --filter fluxiq test` (whole package, run 2) | `8 failed \| 368 passed (377)` with `EBUSY`/`EPERM` on sqlite `-shm` files, an `rmdir` refusal, a 15s timeout and `Worker exited unexpectedly`; duration 235s vs ~60s |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (184 warning(s), 359 baselined)` |
| `node scripts/docs-reference.mjs --check` | failed (stale) before, `Deterministic framework reference is current.` after `pnpm docs:reference` |

Two things about the whole-package runs, reported plainly rather than as a
verdict. **Run 2's eight failures are contention, not code**: they are file locks
on temp sqlite files and a crashed vitest worker, in storage and service-scale
tests, with another worker editing and validating the same checkout at the same
time — the exact failure mode `AGENTS.md` describes for concurrent validation in
one tree. **Run 1's three failures are deadline and budget tests** (a provider
deadline, a 100-item page, a 10,000-summary budget) and every one passes when run
alone. None of the eleven is in the permission area, and none names a file I
touched.

One retry was needed for the environmental crash the brief warned about: a
targeted vitest invocation exited `3221225477` after one test file; the identical
command re-run immediately completed normally.

Separately, two failures I saw mid-session in
`flow-bootstrap/authoring/tests/plan-shapes.test.ts` and
`flow-bootstrap/plan/tests/issue-feedback.test.ts` belong to the **other worker**
— `git status` shows those files plus `authoring/json-plan.ts` modified by them,
and the brief told me to stay out. They passed again on a later run while that
worker was between edits.

## Not verified

- **No live run.** Nothing here was exercised against a real provider or a real
  page. Every claim about the repair path is from Core's own tests, which fake
  the domain's target check and its execution. Whether a live
  `explore_and_adapt` repair now completes end to end on a realistic site is not
  something this change can prove; it is the next live run's job.
- **Which class a model actually declares for a given control.** The whole
  benefit hangs on a "Save for later" or "Add to basket" press being declared
  `create_new` rather than `modify_existing`. I did not measure that. If models
  routinely reach for `modify_existing` on a Save button, this change will help
  less than it looks.
- **The whole-package suite has not been observed green in one run** on this
  machine during this session, for the contention reasons above. I verified the
  permission-relevant 606 tests green and every non-permission failure green in
  isolation, which is not the same thing.
- I did not run `pnpm check` at the repository root (it runs `pnpm -r check`
  across every package, and another worker was validating concurrently); I ran
  the package-scoped type check and the structure audit instead, as the brief
  asked.
- I did not run `pnpm structure:baseline`, though the audit reports "2 baseline
  entries can be lowered". That rewrites a shared file while another worker is
  editing; the supervisor should run it after both land.

## Open questions or contradictions found

1. **`AUTOMATION_STUDIO_CONVERSATION_CONSEQUENTIAL_CLASSES`**
   (`runtime/conversations/ask.ts`) still lists `send_or_publish` among the
   classes that make answering an ask something a person must do deliberately,
   with the standing rule quoted in its doc comment as "completing a purchase,
   deleting, and editing existing data". That list governs *how* an ask is
   presented, not *whether* one is raised, so it is not a refusal and I left it
   alone — but it now describes a set the gate can no longer produce for
   `send_or_publish` alone. Worth a supervisor decision.
2. **The recovery never re-derives the instruction.** Described above. It is the
   one place where "the instruction is the authority" is weaker on the repair
   path than on the authoring path, and it is a deliberate Core decision I did
   not overturn on my own.
3. **`docs/reference/framework-reference.md` was already stale before my change**
   — it was missing `AUTOMATION_STUDIO_RESULT_REAUTHOR_METADATA_KEY` and
   `AUTOMATION_STUDIO_RESULT_WRONG_ANSWER_CODE` from an earlier commit. I
   regenerated it, so the regenerated file also reflects whatever the concurrent
   worker had in the tree at 15:20. If that worker changes a public export or a
   public doc comment, `pnpm docs:reference` needs running again before commit.
