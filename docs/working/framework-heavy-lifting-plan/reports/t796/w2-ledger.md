# t796 / w2-ledger: Core's per-pass act ledger

Worker: worker-heavy (Opus). Tree: `C:/Users/osrs_/FluxStuff/fxwork/t796/!FluxIQ`, branch `task/t796-fhl-per-pass-act-ledger` (no git mutations).
RT = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Core now keeps a per-pass act ledger for every trial and uses it in two places:

- **Feedback:** the trial feedback has a new top-level `notRun` key.
- **Proofs:** a part whose acting steps never ran on any pass is proved `not_run`, with the steps named.

Both shapes are exactly the fixed shapes in the brief. The brief's three test directories pass (48 files, 373 tests). The structure audit passes. The package typecheck shows two errors, both in other workers' in-flight files and none in mine (see below).

## What changed and why

### Ledger (pure): `RT/service/candidate-trial/act-ledger.ts`, `automationStudioTrialActLedger(trace, graph)`

**Inputs:** the folded steps (`executed-steps.ts`) and the graph.

**Tracked steps:**
- every step whose act lasts by `automationStudioNodeActLasts`, except Core nodes whose side-effect class is `none` (the same exclusion `landed-acts.ts` makes);
- every step of an optional step's guarded group, lasting or not.

**Passes:**
- A loop node's `body` attempt starts that loop's next pass. Passes are numbered per loop node across the trial, and nested loops are handled with a stack.
- A step belongs to the innermost loop whose graph body contains it. The body is computed the way `zero-pass-loop.ts` does it: reached from `body` without passing back through the loop, minus whatever the loop's way on also reaches.
- A loop with no body pass (zero passes, or never reached) adds nothing to the ledger.
- A step outside every loop has one pass, with no pass number.

**What each pass records** (the step's last attempt on that pass, numbered as the feedback numbers steps):

| Status | Detail |
| --- | --- |
| `ran` | A lasting step also says its act: `changed` (in the landed acts), `already_in_state` (`stateHeld`) or `no_change_seen`. |
| `skipped` | Why: `absent`, `already_in_state`, `already_done` or `state_routed`. The row is kept where the trace gives one. |
| `refused` | Why: `other_row` (`resolution.refusedBecause === "other-record"`) or `covered` (code ends in `target_covered` / `blocked_by_dialog`). |
| `failed` | With its code. |
| `not_run` | `guarded` when the guard was reached on that pass and not done, with `after` set to the guard's label. Otherwise `unreached`. |

Types are in `candidate-trial/contracts.ts`:
- `AutomationStudioTrialActLedgerPass`
- `AutomationStudioTrialActLedgerEntry`
- `AutomationStudioTrialNotRunStep`

### Projection: `candidate-trial/not-run.ts`, `automationStudioTrialNotRun(ledger)`

- Produces one entry per step and reason.
- Guarded steps are listed whether lasting or not. Unreached steps are listed only when lasting, so a failed run does not list every later wait.
- Outside a repeat, `passes` is `[1]` and there is no `of`.

### Guarded group: `RT/executor/step-skip/guarded-group.ts`, `automationStudioOptionalStepGuardedGroup(flow, node)`

- This is the success-path walk from `optional-step.ts`, now exported and returning the guarded steps and their join.
- `optional-step.ts` now calls it, so one rule decides "optional" for both the run and the ledger. Behaviour is unchanged, and the existing step-skip tests are green.

### Sentence: `RT/executor/step-skip/not-run-said.ts`, `automationStudioStepNotRunSaid`

- Example: "Not run on passes 1, 2 and 3 of 3: it runs only after \"<label>\", which was skipped, so what it does was not done."
- The "so what…" clause is dropped when the step is not lasting.
- A run of four or more consecutive passes reads as a range ("1 to 21").
- Unreached reads "the run never reached it on those passes / on that pass". Outside a repeat there are no pass words.
- `act-not-done.ts` holds no wording (it is a predicate), so it was not the source of this sentence and is unchanged. The run's source for the sentence is this new module, exported from the step-skip barrel.

### Feedback: `feedback.ts`

- `steps()` now adds `notRun` (at most 20 entries, with `notRunLeftOut` for the rest).
- The key is absent when every step ran, and when no step ran at all.
- A header paragraph was added.

### Trial change: `RT/flow-bootstrap/trial-change/`

- **`contracts.ts`:**
  - `"not_run"` added to `AutomationStudioTrialProof`.
  - New `AutomationStudioTrialNotRun`.
  - `notRun?` added on `AutomationStudioTrialPartProof` and on the packet's `proofs` element.
  - `AutomationStudioTrialChangeAct` is now a union: `AutomationStudioTrialChangeMadeAct` (the old shape, renamed) or `AutomationStudioTrialChangeNotRunAct` (`{ outcome: "not_run", definitionId, key?, lasting, notRun }`).
  - `AutomationStudioTrialChangeStep` gains `key?` (the plan node key; the graph node carries it as `bootstrapSymbolicKey`).
- **Why a union:** the ledger has to reach `session.finish`, and the only channel through the trial gates I do not own (`candidate/trial-gate.ts` and `subflow-trial-gate.ts` pass `acts` through unchanged) is the acts array.
- **`acts-split.ts`:** `finish` splits the array straight away.
- **Only proofs read the `not_run` entries.** Witnesses, `packet.acts`, findings and the unwitnessed gap never see them. `pass-witnesses.ts` and `unwitnessed-outcome.ts` now take `MadeAct`.
- **`part-acting.ts`:** a part's acting steps are the plan steps that serve it and declare any consequence. Each is matched to lasting not-run entries by definition, by key where both sides name one, and by label where the plan gives one.
- **`proof.ts`:** `acting` is a new input. `not_run` is checked first, before contradicted or shown, when every acting step's entries cover every pass (outside a repeat, any entry is enough). Otherwise the computed proof stands and `notRun` is attached.
- **Wiring:** `session.ts` and `unwitnessed-session.ts` (both its paths) pass `acting`. `packet.ts` bounds `notRun` (10 steps, 60 passes, labels 200 characters). `steps.ts` records `key`. `after-read.ts` takes an optional 4th argument (the not-run steps) and appends them as `not_run` entries.

### Run wiring: `candidate-trial/run.ts`

- `automationStudioTrialChangeAfterRead(..., automationStudioTrialNotRun(automationStudioTrialActLedger(executed.trace, frames.graph)))`.
- Header paragraph added.

## Final shapes

**Feedback, top-level key:**
```ts
notRun: Array<{ nodeId: string; label: string; reason: "guarded" | "unreached"; after?: string; passes: number[]; of?: number; lasting: boolean; said: string }>
notRunLeftOut?: number   // only when more than 20 entries
```

**Proof:**
```ts
type AutomationStudioTrialProof = "none" | "shown" | "no_change" | "already_in_end_state" | "carried" | "unproven" | "contradicted" | "not_run";
type AutomationStudioTrialNotRun = { nodeId: string; label: string; reason: "guarded" | "unreached"; after?: string; passes: number[]; of?: number };
// AutomationStudioTrialPartProof and AutomationStudioTrialSiteChange["proofs"][number]: notRun?: AutomationStudioTrialNotRun[]
```

## Tests (generic library example: a loop placing a hold on each of 3 books, the hold and its wait written `only after:` an optional banner close)

The fixture `candidate-trial/tests/act-ledger/tests/library-holds-loop.ts` runs the real executor (`runAutomationStudioGraph`) with the banner shown on chosen passes. It sits in a subfolder because `candidate-trial/tests/` is at the 25-file limit.

- **`candidate-trial/tests/feedback.test.ts`:**
  - "a guarded act step passed over on every pass is listed as not run, with its act not done"
  - "names only the passes a guard went past when the act step ran on another, and says nothing when every step ran"
- **`candidate-trial/tests/act-ledger/tests/act-ledger.test.ts`** (one test per outcome):
  - guarded on every pass, for the hold and the wait;
  - ran/changed on the shown pass;
  - ran: changed, no_change_seen, already_in_state;
  - skipped: absent, already_in_state with row;
  - refused: other_row, covered;
  - failed;
  - unreached outside a loop;
  - unreached on a pass cut before its guard;
  - nothing for a zero-pass loop.
- **`candidate-trial/tests/act-ledger/tests/not-run.test.ts`:** grouping, the non-lasting rule, the outside-repeat rule.
- **`trial-change/tests/proof.test.ts`:**
  - "a part whose act step never ran is `not_run`, naming the step"
  - not_run is checked first, and passes are covered across reasons;
  - the proof is kept and `notRun` attached when the step ran on some passes or another acting step ran.
- **`trial-change/tests/session.test.ts`:**
  - key carried on each step;
  - not_run reaches the packet proofs with no act and no finding;
  - a key mismatch does not match.
- **`executor/step-skip/tests/not-run-said.test.ts`:** sentence forms, range, unreached, outside a repeat, label cut.

## Commands run and observed results

Each check ran under the lock, as `until mkdir …/heavy-check.lock; do sleep 20; done; <cmd>; rmdir …`.

1. **Fail-first.**
   - Setup: HEAD versions of `feedback.ts`, `proof.ts` and `session.ts` swapped in with `git show HEAD:… >` (backup in the scratchpad, then restored).
   - Command: `pnpm test …/feedback.test.ts …/proof.test.ts …/session.test.ts`
   - Result: `Test Files 3 failed (3)`, `Tests 6 failed | 51 passed (57)`. These are the 6 new behaviour tests. For example: proof expected `"not_run"`, received `"no_change"`; expected `not_run`, received `contradicted`; feedback had no `notRun`.
2. **Brief check, first run.**
   - Command: `pnpm test src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/flow-bootstrap/trial-change src/programs/automation-studio/runtime/executor/step-skip`
   - Result: 64 failed.
   - Cause: `TypeError: Cannot read properties of undefined (reading 'filter')`, from `chooseAutomationStudioEdge` reached through the ledger. Older test graphs carry no `edges`.
   - Fix: the ledger reads absent `nodes`/`edges` as empty.
3. **Brief check, rerun.** Same command: `Test Files 48 passed (48)`, `Tests 373 passed (373)`.
4. **Typecheck and structure audit.**
   - Typecheck: `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (packages/fluxiq).
   - First run: 1 error, in `service/project-build-ending/tests/ending-truth.test.ts(91,124)`. That is another worker's in-flight file (must-not-touch), not mine.
   - Audit: `node scripts/structure-audit.mjs` found 3 violations.
     - Mine: `as-never` at `feedback.test.ts:442`. Fixed with a typed `AutomationStudioBuildTestVerdict` stub.
     - Not mine: two in `flow-bootstrap/authoring/` (must-not-touch).
5. **Final rerun.**
   - feedback.test: `Tests 37 passed (37)`.
   - tsc: 2 errors, both outside my paths:
     - `flow-bootstrap/authoring/assemble.ts(70,53)`: cannot find `./repeat-order.ts`;
     - `service/project-build-ending/tests/ending-truth.test.ts(91,124)`.
   - Structure audit: `exit 0`.

## Not verified

- **No live or Lab run, and no full-suite run.**
- **The subflow trial path is not wired.** `RT/service/subflow-trial/run.ts:248` calls `automationStudioTrialChangeAfterRead(..., acts, already)` without the new 4th argument, so subflow trials get the feedback's `notRun` only if their feedback is built by `feedback.ts` (not checked), and their proofs never become `not_run`. That file is outside my owned paths. The fix is one line: add `automationStudioTrialNotRun(automationStudioTrialActLedger(executed.trace, frames.graph))`, both exported from `service/candidate-trial/index.ts`. The debug run's build was probably a project or subflow build, so this matters for the live case.
- **The project-build entry-preparation path** (`service/project-build/entry-preparation.ts`) was not inspected.
- **Proof matching is not exact.** It matches by definition, key and label, not node id, because plan steps carry no graph node id. Two identical lasting steps (same definition, key and label) in different subflows could cross-match.
- **Loop pass numbering** counts per loop node across the whole trial. An inner loop re-entered on each outer pass is numbered cumulatively.

## Open questions or contradictions found

- **Lane t795 (judging), the proof union.** `result-verification/site-change/held.ts` maps proofs through `Partial<Record<Proof, string>>`. It compiles with the new member, but `not_run` is not in `NOT_PROOF`, so a judge's yes over a `not_run` part is not held. t795 should add it there; it stays out of my scope.
- **Lane t795, other consumers.** `count-claim.ts` and `count-differs.ts` read only `"shown"`, so they are unaffected. The judge instruction text in `llm/diagnosis-instructions.ts` does not describe `not_run` or `notRun` (must-not-touch).
- **No other user of `AutomationStudioTrialProof` breaks.** In RT, its readers are `trial-change/contradicted.ts` (`=== "contradicted"`) and `unwitnessed-outcome.ts` (its `OPEN` set excludes `not_run`, so `not_run` stands over an unwitnessed step).
- **Lane t795, findings.** No finding is added for a `not_run` part; `result.change_not_seen` stays `no_change`-only. Whether a `not_run` part should raise a Core finding (for example `result.act_not_run`) is t795's call.
- **Unwitnessed trials.** `automationStudioTrialChangeBegin` returns no session when a trial has no witness and nothing left from earlier. There is then no proof at all, `not_run` included, unless the unwitnessed wrapper is used (it is wired).
