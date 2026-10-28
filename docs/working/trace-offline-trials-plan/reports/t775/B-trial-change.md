# t775 phase B: the pure trial-change module (Core)

## Outcome

Done. New Core directory `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/trial-change/`
with contracts, delta, proof, findings and packet, plus four test files (20 tests, all pass). The module is exported
from `flow-bootstrap/index.ts`. Nothing reads a page or a ledger yet: phase D wires it into the trial gates.
Tree: `fxwork/t775/!FluxIQ`, branch `task/t775-minimal-reset-judging`. Nothing was committed.

## What changed and why

Files (all new except the barrel line), under `runtime/flow-bootstrap/`:

- `trial-change/contracts.ts`: every type the module shares (one directory-wide contracts file, as the structure
  rule allows for shared types).
- `trial-change/delta.ts`: `automationStudioTrialDelta`.
- `trial-change/proof.ts`: `automationStudioTrialPartProof`.
- `trial-change/findings.ts`: `automationStudioTrialChangeFindings`. This is a separate file because of the
  one-export-per-file rule.
- `trial-change/packet.ts`: `automationStudioTrialSiteChangePacket`.
- `trial-change/index.ts`: the barrel.
- `trial-change/tests/{delta,proof,findings,packet}.test.ts`.
- `index.ts`: one line added, `export * from "./trial-change/index.ts";`. Before adding it I checked that none of
  the new names already exist anywhere under `packages/`.

The only import outside the directory is a type-only import of `AutomationStudioSiteResetCollection` from
`../reset-settlement/index.ts`. Because it is type-only, it adds no runtime edge and no barrel cycle.

### Exported names and signatures (for phase C)

```ts
type AutomationStudioTrialReading = { source: "latest_read" | "core_look" | "end_view"; location?: string;
  collections?: AutomationStudioSiteResetCollection[]; controls?: Record<string, Record<string, number>>;
  lines?: { gone: string[]; added: string[] } };
type AutomationStudioTrialWitness = ({ id; kind: "list"; group } | { id; kind: "control"; place })
  & { where?: string; steps: number[]; parts: string[] };
type AutomationStudioTrialPartEffect =   // structurally identical to project-agents' AutomationStudioProjectTaskEffect (checked against A's task-effect.ts)
  | { kind: "change"; direction: "adds" | "removes"; count: number | "each_match"; what: string }
  | { kind: "end_state"; state: string };
type AutomationStudioTrialActOutcome = { step: number; pass?: { number: number; of: number }; row?: string;
  outcome: "changed" | "already_in_state" | "no_change_seen"; witness?: string; parts: string[] };
type AutomationStudioTrialDelta =
  | { witness; kind: "list" | "control"; status: "unread" }
  | { witness; kind: "list"; status: "changed" | "unchanged"; added: string[]; removed: string[]; changed: string[]; unchanged: string[] }
  | { witness; kind: "control"; status: "changed" | "unchanged"; before: Record<string, number>; after: Record<string, number> };
type AutomationStudioTrialProof = "none" | "shown" | "no_change" | "already_in_end_state" | "carried" | "unproven";
type AutomationStudioTrialPartProof = { part: string; effect?: AutomationStudioTrialPartEffect; proof: AutomationStudioTrialProof; steps: number[] };
type AutomationStudioTrialChangeFinding =
  | { code: "result.change_not_seen"; part: string }
  | { code: "result.unasked_change"; witness: string; where?: string };
type AutomationStudioTrialLeftAct = { did: string; where?: string };
type AutomationStudioTrialSiteChange = { witnesses: [...]; acts: [...]; leftFromEarlier: [...]; proofs: [...]; omitted?: {...} };
// plus AutomationStudioTrialSiteSide, AutomationStudioTrialSiteLines, AutomationStudioTrialSiteWitnessChange (packet parts)

function automationStudioTrialDelta(witness, before: Reading | undefined, after: Reading | undefined): AutomationStudioTrialDelta;
function automationStudioTrialPartProof(input: { part: { id: string; effect?: Effect }; deltas: readonly Delta[];
  acts: readonly ActOutcome[]; carried: boolean }): AutomationStudioTrialPartProof;
function automationStudioTrialChangeFindings(input: { witnesses; deltas; acts; proofs }): AutomationStudioTrialChangeFinding[];
function automationStudioTrialSiteChangePacket(input: { witnesses; readings: Record<witnessId, { before?: Reading; after?: Reading }>;
  acts; leftFromEarlier?: AutomationStudioTrialLeftAct[]; proofs: AutomationStudioTrialPartProof[] }): AutomationStudioTrialSiteChange;
```

### Behaviour

**delta, list witness.**

- The subjects of the group are matched across every scope they were read in. If a subject appears in several
  scopes, its sorted set of states is compared.
- Each subject is classed as added, removed, changed or unchanged. Each class is returned as a sorted array of
  subject tokens.
- A reading with no collection of the group counts as unread. A group read with no subjects counts as an empty
  list, which is a valid reading.

**delta, control witness.**

- A missing state token counts as 0.
- A reading that reports controls but not this place counts as `{}`, following the control tracker's semantics.
- A reading with no `controls` at all counts as unread.

**proof.**

- A part with no effect gets `none`.
- If any witness changed, the proof is `shown`.
- Otherwise, if there are no witnesses or any witness is unread, the proof is `unproven`.
- Otherwise a `change` part gets `no_change`, and an `end_state` part gets `carried` (when `carried` is true) or
  `already_in_end_state`.
- `steps` holds the sorted unique steps of the acts that list the part.

**findings.**

- `change_not_seen`: raised for each `change` proof that is `no_change`.
- `unasked_change`, list witness: raised when the witness has `steps: []` and its delta changed.
- `unasked_change`, control witness: raised when its delta changed and no act is at that place. An act is at the
  place when its `act.witness` equals the witness id, or when it has no witness and its step is in `witness.steps`.
- An unread witness never raises a finding.

**packet, what it shows.**

- A list side is `{ source, rows }`, where `rows` is the count of distinct subjects.
- A control side is `{ source, state }`. The state is keyed by the labels "state 1", "state 2", and so on, assigned
  in token order across both sides, so a token keeps the same label before and after.
- A side that was not read is `"unread"`.
- A list change is counts (added, removed, changed, unchanged). A control change is `{ from, to }` in the same
  labels. Either carries the after reading's `lines` when it has any.
- The change is `"none"` when the witness is unchanged and has no lines, and `"unread"` when either side is unread.
- Proofs with `none` are left out of the packet.

**packet, limits.**

- Every free text is cut to 200 characters, ending in `…`. This covers where, row, did, effect what/state and lines.
- At most 20 lines are kept per side, with `cut: { gone, added }` saying how many were left out.
- At most 30 witnesses, 60 acts and 20 left-from-earlier entries are kept, with `omitted` counts.
- No group, scope, place, subject or state token is ever emitted. A test asserts this.

## Commands run and observed results

- Fail-first, run from `packages/fluxiq` with the tests and the barrel written but no implementation:
  `node ../../scripts/vitest-groups.mjs --groups=parallel src/programs/automation-studio/runtime/flow-bootstrap/trial-change`
  printed `Test Files 4 failed (4)` and `Error: Failed to load url ./delta.ts ... Does the file exist?`.
- The same command after implementing printed `findings.test.ts (5 tests)`, `proof.test.ts (5 tests)`,
  `delta.test.ts (6 tests)`, `packet.test.ts (4 tests)`, `Test Files 4 passed (4)`, `Tests 20 passed (20)` and
  `[vitest-groups] all groups passed: parallel`.
- `pnpm check` in `packages/fluxiq`:
  - Before the barrel line was added, it ended with no `error TS` lines (the build-cache line said `not stamped,
    because inputs changed while it ran`; other workers were editing).
  - After the barrel line, it exited 2 with one error, which is not mine:
    `src/programs/automation-studio/runtime/service/project-build/tests/project-build-task-checklist.test.ts(179,52):
    error TS2304: Cannot find name 'scope'.` That is phase A's file, edited concurrently. No error names
    trial-change or `flow-bootstrap/index.ts`.
- `pnpm structure:check` at the Core root exited 1 with one violation, which is not mine:
  `FAIL [statement-packing] .../project-agents/contracts/tests/task-spec.test.ts: 1 line holds more than one
  statement, line 144` (phase A). The audit output has no line naming trial-change.
- Read-only check: phase A's new `project-agents/contracts/task-effect.ts` `AutomationStudioProjectTaskEffect` has
  exactly the shape of `AutomationStudioTrialPartEffect`.

## Not verified

- A clean `pnpm check` for the whole package. It is blocked by phase A's in-progress test error above.
- Any consumer. Phases C and D do not exist yet, so the packet's fit with `AutomationStudioRunResultSummary` and
  t752's cached-prefix rule is untested.
- Readable `lines` come from the domain. This module trusts them and never screens them for opaque tokens or secrets.
  Screening like `build-test/observation.ts` (design section 2) is not done here; phase C should apply it if needed.

## Open questions or contradictions found

1. **The brief and the design disagree on a mix of unread and unchanged witnesses.**
   - The brief says: "change: any witness changed -> shown, all unread -> unproven, else no_change". By that
     wording, a part with one unread witness and one read-unchanged witness would get `no_change`.
   - Design section 3 says `no_change` applies only when every witness shows `change: none`.
   - I followed the design: any unread witness, with nothing changed, gives `unproven`. The reason is that
     `no_change` raises `result.change_not_seen`, a grounded no, and a change may sit exactly where nothing was read.
   - `end_state` is handled the same way: if any witness is unread, the proof is `unproven`, not `carried` or
     `already_in_end_state`. The lead may overrule this.
2. **A part with no witnesses at all gets `unproven`**, because "all unread" is vacuously true. Phase D's
   `candidate.trial_step_unwitnessed` refusal should keep this case rare.
3. **The design's packet shows `changed: [{ row, from, to }]` and `before.rows` as rows**, but rows are opaque
   tokens. As the brief asks, the packet carries counts plus the readable lines instead.
4. **The design's `carriedFrom?` is not modelled.** The brief gives `carried` as a boolean. Phase C/D can widen it if
   the judge needs to see where the change was carried from.
5. **Proofs of `none` are left out of the packet**, because the design's packet lists only the five other values.
   They are still returned by `automationStudioTrialPartProof` for phase C's agreement.
