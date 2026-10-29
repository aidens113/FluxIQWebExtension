# t787 fix 4: per-pass witnesses and a direction for proof

## Outcome

Partial. Everything in my owned files is done and tested. Two things still need edits outside my files:

- **The build's start is not wired into the trial-change port yet.** `site-reset/trial-change-port.ts`,
  `site-reset/ledger.ts` and `site-reset/project-reset.ts` must expose the control tracker's `start(place)`. Until they
  do, `start` is absent in production. Direction is then never computed, and nothing is ever `contradicted`. That is
  safe, because behaviour stays as before, but it means the 0126 false yes is not yet caught live. The exact edits are
  below.
- **The judge path does not honour `contradicted` yet.** `result-verification/site-change/held.ts` (`NOT_PROOF`) does
  not list it, and the judge's words in `llm/diagnosis-instructions.ts` do not explain it.
  - Both gates I own already turn a contradicted yes into a no, so a contradicted trial can never pass or complete.
  - Without the `held.ts` edit, though, a yes from the verification agreement path is not held as unsure before it
    reaches the gate.

## What changed and why

All paths below are under `C:/Users/osrs_/FluxStuff/fxwork/t787/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

### `trial-change/contracts.ts`

- `AutomationStudioTrialReading.source` gains `"step_diff"`.
- The control `AutomationStudioTrialDelta` gains `returned?: true`.
- `AutomationStudioTrialProof` gains `"contradicted"`.
- `AutomationStudioTrialChangeAct` gains `control?: AutomationStudioTrialActControl`. The new type is
  `{ place, location?, before, after }`.
- `AutomationStudioTrialChangeLedgerPort` gains an optional `start?(place)`.
- The finding union gains `{ code: "result.change_contradicted"; part; witness }`.

### `trial-change/acts.ts`

A landed act carrying `spot.place` and `controls` maps to `control`. This is the same per-pass data `landed-acts.ts`
already returns, and `run.ts` already passes those acts in, so `landed-acts.ts` and `summary.ts` did not need changes.

### `trial-change/pass-witnesses.ts` (new)

`automationStudioTrialPassWitnesses` is new. Each changed act with a `control` is attributed to the control witness at
its own place:

- When the place is the stamp's own, the act joins the stamp's witness, which keeps the trial's readings.
- Otherwise it gets a new witness at the act's location, which serves the act's step parts.
- A new witness is read from the act diffs at its place (`step_diff`): before from the first act, after from the last.
  A stamp witness with an unread side also gets that side from the diffs.
- Other acts are attributed by stamp, then by definition, as before.

### `trial-change/session.ts`

`finish` uses the pass witnesses. It asks `port.start` for every control place the witnesses and acts name, and it does
this before the after-looks. A look's read reaches the ledger, and a place first reported by that look would otherwise
seed the trial's own end as the build's start. Each control delta then gets its start.

### `trial-change/delta.ts`

When given a `start`, a changed control is `returned` if every token whose count changed ended at its start count (a
missing token counts as 0). Tokens that did not change are not compared, so extra tokens in a read do not affect the
result.

### `trial-change/proof.ts`

A `change` part with `direction: "adds"` is `contradicted` (checked before `shown`) when any of its control witnesses
changed and was `returned`. `removes` parts and `end_state` parts are unchanged.

### `trial-change/findings.ts`

Adds `result.change_contradicted` once for each returned control witness of a contradicted part.

### `trial-change/contradicted.ts` (new)

`automationStudioTrialChangeContradictedNo(answer, outcome)` turns a `yes` into a `no` when the session's outcome
proves a part `contradicted`. It adds `feedback.changeContradicted`, which holds:

- the code `trial.change_contradicted`;
- the parts;
- the places, as witness, `where` and steps;
- `said`, generic words naming each act by trial step and pass.

### `trial-change/index.ts` and `trial-change/witnesses.ts`

The barrel exports the two new files. The `witnesses.ts` header now points to `pass-witnesses.ts`; that is a comment
change only.

### The two gates

`candidate/trial-gate.ts` and `subflow-candidate/subflow-trial-gate.ts` wrap `change.finish` in `ask()` to capture the
outcome, then pass the answer through `automationStudioTrialChangeContradictedNo`.

- In the subflow gate this happens before the row check and the weighing.
- The gates end at 790 and 800 lines; the limit is 800, so the subflow gate has no headroom left.

### Tests

- `trial-change/tests/witnesses.test.ts` (new): three-pass loop, contradicted pass, shared place.
- `trial-change/tests/proof.test.ts`: four new cases.
- `candidate/tests/contradicted/tests/trial-gate-contradicted.test.ts` (new).
- `subflow-candidate/tests/contradicted/tests/subflow-trial-contradicted.test.ts` (new).

The two gate tests sit in subfolders because each flat `tests/` folder was already at the 25-file limit.

## Commands run and observed results

All commands ran from `C/packages/fluxiq` unless marked "from C".

### Fail first

| Command | Result |
| --- | --- |
| `npx vitest run src/.../flow-bootstrap/trial-change` (new tests, before the code) | 5 failed, 31 passed. These are the three witnesses tests and the proof tests "reads ... returned" and "is contradicted". The "stays shown" and "removes" cases already passed. |
| Gate tests with the gate guard temporarily removed | Whole-candidate gate: 1 failed, 1 passed. Subflow gate: 1 failed, 1 passed. The `never passes` test is the one that failed. The guard was then restored (`grep -c` showed 1). |

### Pass

| Command | Result |
| --- | --- |
| `npx vitest run .../trial-change` | 7 files, 36 tests passed. |
| `pnpm test .../flow-bootstrap/trial-change .../flow-bootstrap/candidate .../flow-bootstrap/subflow-candidate` | 67 files, 417 tests passed (after the final edits). |
| `pnpm test .../flow-bootstrap/site-reset .../service/candidate-trial .../service/subflow-trial .../result-verification/site-change`, first run | 30 files failed at suite level with no assertion failures. |
| Same set, run with `npx vitest run` and then with `pnpm test` again | 70 files, 697 tests passed both times. `landed-acts.test.ts` alone also passed (20 tests). |
| `pnpm check` | Exit 0 (tsc stored). |
| `pnpm structure:check` (from C) | First run: 4 violations, all from my changes. Two `tests/` folders were at 26 files, and the gates were at 804 and 805 lines. After the fixes: `structure-audit: passed (448 warning(s), 1152 baselined)`. |
| `pnpm docs:reference` then `pnpm docs:check` (from C) | `Deterministic framework reference is current.` The regenerated `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` also contain other workers' in-flight exports. |

The suite-level failures on the first dependent run did not reproduce. They look transient, most likely another worker
editing `run.ts` or `contracts.ts` at that moment.

### Replay of the run evidence

I replayed both trials through the real `session.ts` and `acts.ts`. The script is
`C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/t787fix4/replay.mts`,
run with `node --experimental-strip-types`.

- It read the per-pass diffs of objects `81/25/81252ec4…` (rev 7, step 0119) and `cc/45/cc454a53…` (rev 8, step 0126).
- I assumed each post's start was unliked when the build first read it.
- 0126 gave three witnesses (A at step 11, B at step 16, C at step 21), proof `contradicted`, and the finding
  `result.change_contradicted` on w2 (B) only.
- 0119 gave `contradicted`, with findings on w1 (A) and w3 (C).

The direction per pass, read from those objects:

| Trial | A | B | C |
| --- | --- | --- | --- |
| rev 7 (0119) | Unlike to Like | Like to Unlike | Unlike to Like |
| rev 8 (0126) | Like to Unlike | Unlike to Like | Like to Unlike |

## Not verified

- **The real tracker's starts for this run.** I did not check what `start()` actually held for places A, B and C, which
  would take reconstructing the ledger. The replay assumes every post was unliked when the build first read it.
  - A naive replay that took rev 7's own before-states as starts wrongly said all three were contradicted.
  - So this fix is only as right as the tracker's start rule: a place's first report while it has never been pressed.
- **Live or Lab behaviour.** Not run, per the brief.
- **The packet the judge sees.** It now shows `step_diff` sources, extra witnesses and the `contradicted` proof. No
  judge was run.

## Edits needed outside my files

### Wiring the build's start (site-reset, not owned)

1. `flow-bootstrap/site-reset/trial-change-port.ts`:
   - In the constructor's `ledger` deps, add
     `controlStart: (place: string) => Readonly<Record<string, number>> | undefined;`
   - In `port()`, add `start: (place) => this.ledger.controlStart(place)` beside `carried`.
2. `flow-bootstrap/site-reset/ledger.ts`, line 336: add `controlStart: (place) => this.tracker.start(place)` to the
   object passed to `new AutomationStudioSiteResetTrialChange({...})`.
3. `flow-bootstrap/site-reset/project-reset.ts`, `sessionOver`: add
   `start: (place) => ports.map((entry) => entry.start?.(place)).find((counts) => counts !== undefined)` to `port`.

### Honouring `contradicted` on the judge path (lane t785 / result-verification, not owned)

4. `result-verification/site-change/held.ts`, `NOT_PROOF`: add
   `contradicted: "it asks to add, and the trial put one of its places back to how this build found it, taking away what an earlier act had added"`,
   so a judged yes is held unsure before it reaches the gate.
5. `llm/diagnosis-instructions.ts`, line 171:
   - In the "Of the other proofs" sentence, explain that `contradicted` means a place the part's change shows went back
     to how this build found it, which is the opposite of what the part asks.
   - In the `siteChangeFindings` sentence, add `result.change_contradicted`.
   - The words must stay generic.

## Open questions or contradictions found

- **Stale architecture doc sentences.** `C/docs/architecture/automation-studio/llm-flow-bootstrap.md`:
  - Around lines 210-213, "A trial reads each witness twice ... from the ledger's latest read ... otherwise by a second
    look" is now stale. Witnesses for a loop's passes at other items are read from their own step diffs, and each pass
    has its own witness.
  - Around lines 230-238, the "Proofs" bullet is missing `contradicted`. Also, "`shown` (a witness changed as declared)"
    is now wrong for an adds part where a control went back to the start.
- **Choice of `no` over `unsure`.** On a contradicted yes the gates set `no`, as the debug note's "judged no" says.
  That differs from `held.ts`'s policy for `no_change`, which is "never a no Core made". I chose `no` because the
  evidence is a positive reading of the opposite change. The supervisor may prefer `unsure`, which is a one-word change
  in `contradicted.ts`.
- **A case direction still misses.** For an adds part, a pass that removes a state the site had before the build began
  (a pre-existing like, un-liked) moves away from the start, so it is not caught. The brief defines direction against
  the build's start, so I left this alone.
- **Packet direction.** The packet does not carry `returned` per witness. The judge sees only the `contradicted` proof
  and the finding.
