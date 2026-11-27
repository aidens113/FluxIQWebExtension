# Brief t1088: a replay stop is told as the page is at handoff

**Goal.** In live kestrel run-mwz2jc4w, attempt 2's replay stopped at the search. Its effect check had looked only
while the site's bot check stood between the search and the results. The results arrived by themselves about 2.5 s
after the stop. The handoff note then told the model "The page is where it left it. Fix that step", which was false
by then. The model re-explored ($0.36).

t1083 fixes the effect check itself (K1). This task fixes the stop: before handing over, Core looks at the page as
it is now.
- Where the stopped step's effect now holds, the replay continues from the next step.
- Otherwise the note says what the page shows.

No waits are added or raised. This is one observation at the moment of handoff, not a retry loop.

**Read first.**
- `docs/working/page-diff-delivery-plan/reports/run-mwz2jc4w-kestrel.md`, sections "Q1" and "K2".
- Core `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/round-note.ts`.
- The flow-run stop path the report names: `graph-run.ts:554` and `continuation.ts:44`.
- How the router already continues when an effect holds. The domain answers through
  `webAutomationRouteEffectHolds(effect, observed)`. Find the port Core already calls it through, and use that one.

**Change.**
1. **Before handing over, observe once.** At a replay stop whose failure is a not-seen effect, observe the page once
   and ask the stopped step's effect again through the existing port.
2. **Where it holds,** take the router's existing "effect holds" way on and continue the replay from the next step,
   in the same attempt. The attempt records that it did.
3. **Where it does not hold,** the note describes the observed page, never "The page is where it left it".
4. **A lasting act is never repeated.**

**Proof.** A unit test: the stop of 0044 with the observation of 0045 (trace seq 123), or a fixture of the same
shape.
- Today the replay stops.
- After the fix, the replay resumes at position 4.
- A second case, where the effect does not hold, gives a note that names the observed page.

**Owned.** Core (`C:/Users/osrs_/FluxStuff/fxwork/t1088/!FluxIQ`):
- `framework/automation-service/service/answer-first/attempt/**`;
- the flow-run stop and continuation files the change needs (name each in the report);
- their tests.

**Must not touch.**
- `engine/automation/state-routing/**` and `domain/src/**` (t1083).
- `answer-first/task-memory/**` and `runtime/flow-authoring/**` (t1085).
- `runtime/result-verification/**` and `runtime/models/**` (t1084, t1087).
- `packages/test-runner/**`.

If the stop path you need lives in a state-routing file, stop and tell the lead which file. Do not edit it.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1088-<label> -- <cmd>`.
- The tests beside the changed files: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dirs>` from
  `packages/fluxiq`.
- `node scripts/structure-audit.mjs` (Core).
- `node scripts/check/model-text.mjs` (downstream tree), if note wording changed.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1088.md` in the downstream tree
(`C:/Users/osrs_/FluxStuff/fxwork/t1088/!FluxIQWebExtension`), ending with the return contract.
