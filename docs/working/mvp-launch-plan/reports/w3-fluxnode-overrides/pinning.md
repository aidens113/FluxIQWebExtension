# W3 t899: FluxNode pinning enforced (plan N8)

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t899/!FluxIQ`. Nothing committed.
`svc` = `packages/fluxiq/src/framework/automation-service/service/fluxnode`.

## Outcome

Done. A pin now changes runs:

- A pinned FluxNode replays exactly the pinned version, even when a newer one exists (a waiting proposal).
- A pinned run still replays, repairs and explores until it has its result or its budget is gone. No new ending.
- A run that would change the pinned Flow leaves the pinned Flow alone. Its change is kept as a proposal and
  recorded on the result as `pinned.held` with code `fluxnode.pinned_change_held`. The proposal's identity
  (`proposalId`, `flowId`, `stepsDigest`, `runId`, `path`, `proposedAt`) is included. The run also emits a
  `step` event with `stepId: "fluxnode.pinned_change_held"`, `state: "skipped"`.
- Exporting with `pin: true` adopts a proposal: the one named in `proposal`, otherwise the newest waiting.
  `fluxiq pin` adopts the newest. After adoption, the next replay runs the adopted version.
- The pin is stored in the Flow's own `fluxNode` metadata. It survives a restart of the FluxNode service.

No W1 file (`answer-first/**`, `flow-bootstrap-commands/**`) or `engine/**` file was edited. No UI was
needed for the Core part (see "UI needs").

## The seam chosen and why

What a later run replays is the task memory's `best` saved Flow. That memory is keyed by the run's caller
task key (`answer-first/route/route.ts`, `attempt/opening.ts`). An attempt also writes to its own Flow by
`flowId`: attempt rows, the act record, the candidate draft, the Flow instruction, and `apply-proven`
(which writes a proven Flow into the Flow artifact).

The seam has two parts and is entirely in svc:

1. **A separate key.** A pinned FluxNode's `auto` run uses the caller key `fluxnode:<name>:<hash>:pinned`
   (`svc/caller-key.ts`). Before every run, `FluxNodePins.begin` sets that key's memory `best` to the pinned
   saved Flow. The attempt therefore replays exactly the pinned version. Whatever the attempt saves goes
   under that key, never under the learned key `fluxnode:<name>:<hash>`.
2. **A separate Flow.** The attempt runs on a separate Flow beside the pinned one, named
   `<name> (proposals)` (metadata `fluxNodeProposals`). It is created lazily and its id is recorded on the
   pin. All per-Flow writes, including `apply-proven`, land there, so the pinned Flow artifact is never
   touched by a run. `run.whenStopped` cancellation targets that Flow too.

After the attempt, `settle` reads that key's `best`. If its steps' digest differs from the pinned digest,
it is a proposal: it is stored on the pin and the result carries `held`. The attempt's own `betterFlow`
rule decides whether the Flow changed. Nothing in the attempt was copied or reimplemented.

`run-fluxnode.ts` passes the proposal Flow's id to `generateFlowBootstrapAdaptation`, `instruct` and
cancellation. It also sets `pinned` on the result. For pinned runs it skips the in-memory `learned` record,
because that candidate belongs to the proposal Flow.

**A pin that lands while an unpinned run is going.** `settleUnpinned` runs after every unpinned `auto` run.
If a pin now exists and the learned `best` differs from it, that change is held as a proposal (with the
pinned Flow's id) and the learned `best` is set back to the pinned version. The run's result gets
`pinned.held`. Residual risk: if that run also proved its Flow whole, `apply-proven` may already have
written into the pinned Flow's artifact. Replays read task memory, not the artifact, so what replays is
still the pinned version. Undoing an artifact apply would need a W1 change.

`mode: "explore"` on a pinned FluxNode keeps its own per-run explore key, as it does unpinned. It runs on
the proposal Flow and changes nothing. Its result has `pinned` with no `held`.

### Persistence (how the pin survives a restart)

The pin is stored in the FluxNode Flow's `metadata.fluxNode`, next to `name`/`specHash`/`spec`. It is
written through the new `FluxNodeOwnerFlows.resay`, which shares the registration queue, so a respecified
spec and a pin write cannot overwrite each other. The fields are:

- `versions: string[]`: the steps digests of every pinned version, oldest first. A version's number is its
  position in this list.
- `pin: { flowVersion, stepsDigest, pinnedAt, saved?, proposalFlowId?, proposals[] }`: `saved` is the full
  saved Flow (`AutomationStudioAnswerFirstSavedFlow`) that a pinned replay is seeded from. Each proposal
  holds its contract identity plus its `saved` Flow. The newest 20 are kept, deduplicated by steps digest.

Each run reads the pin from the Flow (`getFlow`), so nothing is held in memory. The in-memory
`pinnedOn`/`pin`/`pinnedOf` were removed from `run-registry.ts`. Adopting a proposal also sets the learned
key's `best` to it, so the learned Flow and the pin agree.

The export's `flowVersion` now comes from the persisted `versions` list, so it survives a restart. A
version that was never pinned shows as `versions.length + 1`. Before, it came from an in-memory count.

### Dynamic imports

`pin/pins.ts` reaches the answer-first task memory and task key through `await import(...)`, as
`service.ts` does. Static value imports created a 20-module import cycle through `runtime/result-verification`,
which the structure audit failed. They also caused a load-order `TypeError` in the tests.

## Codes

- `fluxnode.pinned_change_held`: the code on `result.pinned.held.code` and the stepId of the skipped step
  event. Exported as `FLUXNODE_PINNED_CHANGE_HELD` from `@fluxiq/contracts/fluxnode`. This is not an API
  error code. The run is not refused, and `run/error.ts` was not touched.
- Export refusals use the existing `invalid_request` with an issue at `/proposal`:
  - `export_flow.unknown_proposal`: `pin: true` named a proposal that is not waiting.
  - `export_flow.proposal_without_pin`: `proposal` was given without `pin: true`.

## Contract changes

- `run/result.ts`: new `FLUXNODE_PINNED_CHANGE_HELD`, `fluxNodeFlowProposalSchema` / `FluxNodeFlowProposal`,
  `fluxNodeRunPinnedSchema` / `FluxNodeRunPinned`. `fluxNodeRunResultSchema` gains optional `pinned`.
- `http/export-flow.ts`: the request gains optional `proposal` (an id). The export gains optional
  `stepsDigest` and `proposals` (max 64). `flow` (free JSON) now also carries `saved` (the version's saved
  Flow, including its steps) and `proposals` (each proposal's saved Flow, keyed by `proposalId`).
- `event.ts`: unchanged. The existing `step` event fits, so no new event type was added for the SDK and
  server to handle.
- All additions are optional, so old clients still parse. The server's export handler passes the parsed
  request through unchanged; its test (`{ pin: false }`) is unaffected because `proposal` has no default.

## Tests

New file `svc/tests/pinning.test.ts` (real-sql group), on the scripted library lane:

1. One lane walks through the whole sequence:
   - It learns a Flow, then pins it (v1).
   - The site breaks the old step (`engine.over`). A pinned run still ends `achieved` with the right
     outputs. `result.pinned` = {v1, pinned digest, `held` with code and proposal}. The skipped step event
     is emitted on the proposal Flow, and the proposal's `flowId` differs from the pinned Flow's.
   - The learned Flow's `best` digest still equals the pinned one. The export shows `pinned`, v1, the pinned
     digest, and `proposals: [held.proposal]`.
   - With the site fixed, a pinned replay makes zero model calls and presses only the old step's label. So
     it ran the pinned version although a newer one was waiting.
   - An unknown proposal is refused, and so is a proposal without pin.
   - Pinning the named proposal gives v2. The learned `best` becomes the proposal.
   - `lane.restart()` builds a fresh FluxNode service over the same Core (a new owner-flows read-back and
     an empty registry). The export still shows pinned v2. A replay makes zero calls, has
     `result.pinned.flowVersion` 2, and presses both of the adopted version's steps.
2. A pin lands mid-run. The engine press is gated, the test pins during the run, then releases it. The run
   ends `achieved` with `held` naming the pinned Flow's id. The learned `best` is set back to the pinned
   digest.

Test support in `svc/tests/library-lane.ts`:

- `engine.over`: an async hook on the engine's "Find loans".
- `engineLabels`: which record-output label each engine press used. This shows which version ran.
- `restart()`.
- `fluxNodes` is now a getter, so it follows a restart.

Contract tests:

- `run/tests/result.test.ts`: `pinned` with and without `held`, a wrong code, version 0, a bad digest.
- `http/tests/api.test.ts`: `stepsDigest`/`proposals` accepted, an unknown key in a proposal refused, the
  request `proposal` accepted, a bad id refused.

### An observation for W1, not a pin defect

When a replay breaks and the model fixes the step by hand, the attempt reports `path: "explored"`
(`run_flow_then_explore`), not `repaired`. `repaired` requires a forward run reaching the last step
(`answer-first/attempt/path.ts`). The test asserts the path is not `replayed` and that the proposal's
`path` equals the result's.

The saved repaired Flow kept the broken step (`disposition: "kept"`) and appended the new one:
`[look, find(Loans), look, find(Loans by title)]`. So an adopted proposal still breaks while the site does.
That is the attempt's draft shaping (W1), not pinning. The guide tells developers to read a proposal's
steps before adopting it.

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode` -> `Test Files 7 passed (7)`, `Tests 31 passed (31)`.
- `pnpm exec vitest run src/fluxnode` (in packages/contracts; equivalent to the brief's `--filter @fluxiq/contracts`) -> `Test Files 26 passed (26)`, `Tests 144 passed (144)`.
- `pnpm exec vitest run` (in packages/sdk) -> `Test Files 19 passed (19)`, `Tests 98 passed | 2 skipped (100)`.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (531 warning(s), 969 baselined)`.
  - The only warning on my files is advisory: `[exported-values] packages/contracts/src/fluxnode/run/result.ts: 9 exported values is past the 8-value advisory threshold`.
  - An earlier run failed with 18 import-cycle and `as-never` violations. Both were fixed (dynamic imports; a typed engine hook).
- `pnpm --filter @fluxiq/contracts check` and `pnpm --filter @fluxiq/sdk check` (tsc) -> no errors printed.

## Not verified

- No `tsc` on the `fluxiq` package. Its check is a 4 GB job and the brief rules out heavy jobs. svc types
  were written carefully and the vitest runs pass, but vitest does not typecheck. **The lead should run
  `pnpm --filter fluxiq check` before merging.**
- Server tests (`packages/fluxiq/src/server/fluxnode-api`) were not run. That path is not owned, and the
  service interface is unchanged.
- Not tested: an explore-mode run on a pinned FluxNode; a pinned run that ends `budget_out` and then
  resumes; a pinned pipeline child run; a proposal Flow that a person deleted (it is recreated).
- No live browser or Lab run.

## Rows for the lead to add

### reference/errors.md

Add a "Pin codes" section, or put these rows under the run request codes:

| Code | Cause | Fix |
| --- | --- | --- |
| `fluxnode.pinned_change_held` | Not a refusal. On a run's `result.pinned.held` and as a skipped `step` event: the FluxNode is pinned, and this run's repair or exploration would have changed its Flow. The run still got its result. The change waits as a proposal. | Review it with `POST /fluxnodes/{name}/export` (`proposals`, `flow.proposals`). Adopt it with `fluxiq pin <name>` or `{ "pin": true, "proposal": "<proposalId>" }`. See pinning (Core `docs/fluxnodes/guides/pinning.md`). |
| `export_flow.unknown_proposal` | `POST /fluxnodes/{name}/export` with `pin: true` named a `proposal` that is not waiting (already adopted, replaced, or never made). Answered as `invalid_request` with this issue at `/proposal`. | Export without `pin` and take a `proposalId` from `proposals`. |
| `export_flow.proposal_without_pin` | `proposal` without `pin: true`. Answered as `invalid_request` with this issue at `/proposal`. | Add `"pin": true`. Only a pin adopts a proposal. |

### reference/http-api.md, "POST /fluxnodes/{name}/export"

Replace the body line and the closing paragraph, and add these rows to the field table:

- Body: `{ "specHash": "...", "pin": true, "proposal": "proposal.…" }`, all optional. `pin` defaults to
  false. `proposal` is valid only with `pin: true` and adopts that waiting proposal. With `pin: true` and no
  `proposal`, the newest waiting proposal is adopted. With none waiting, the pinned version is kept, or on a
  first pin the learned Flow is pinned.
- Rows:

| Field | Meaning |
| --- | --- |
| `stepsDigest` | The version's identity: the digest of the steps a replay runs. |
| `proposals` | Changes a pinned FluxNode's runs held, oldest first: `proposalId`, `flowId`, `stepsDigest`, `runId`, `path`, `proposedAt`. Absent when none wait. |
| `flow.saved` | The saved Flow (steps) of this version. |
| `flow.proposals` | Each waiting proposal's saved Flow, by `proposalId`. |

- `flowVersion`: numbered by the order versions were first pinned. A version never pinned shows as the next
  number.
- Replace "A pin is recorded and reported today. Replaying a pinned version exactly, and holding repairs
  back as proposals, is not enforced yet." with: "A pinned FluxNode replays exactly the pinned version. A
  run's repair or exploration is held as a proposal (`result.pinned.held`, code
  `fluxnode.pinned_change_held`) until you pin again. See pinning (Core `docs/fluxnodes/guides/pinning.md`)."
- Run result table (wherever result fields are listed): `pinned`, present when the FluxNode is pinned:
  `flowVersion` and `stepsDigest` of the version replayed, and `held` (`code`, `message`, `proposal`) when
  the run's change was held.

## UI needs

The Core part needed no UI. A review screen would need:

- A list of pinned FluxNodes with their pinned version (`flowVersion`, `stepsDigest`, `pinnedAt`) and the
  count of waiting proposals. Today this comes from `POST export {pin:false}` per FluxNode. A list endpoint
  would be new API work.
- A side-by-side diff of `flow.saved.steps` against `flow.proposals[<id>].steps`, using each step's
  `position`, `actionId`, `input.parameters` and `words.target`. It should mark steps kept from the pinned
  version and steps added.
- The run that made each proposal (`runId`), linking to its events and result.
- Actions: "Adopt" (`export {pin:true, proposal}`) and "Keep pinned" (dismiss). Dismissing a proposal has
  no API yet. It would be a new export field or endpoint.
- The SDK client's `exportFlow(name, { specHash, pin })` cannot pass `proposal`. That needs
  `packages/sdk/src/client/fluxiq.ts` (not owned here). After that, a one-line `--proposal <id>` flag in
  `pin-command.ts` and `help-text.ts`.

## Open questions or contradictions found

- **Secrets in the reviewable file.** The export now writes the saved steps (`flow.saved`,
  `flow.proposals`) into a file meant to be committed. Steps hold node inputs as the attempt saved them.
  Input-bound values are parameters, but a literal typed value would be written verbatim. The Flow
  artifact was already exported before this change, but steps make it more likely. Should the export
  screen step inputs, or only show steps bound to the spec's inputs?
- **The `exported-values` advisory on `run/result.ts`** (9 values, threshold 8). Moving the pin schemas into
  `run/pinned.ts` would clear it, but that needs a new contracts file and a `run/index.ts` line, neither
  owned here.
- **Repeated repair cost.** While a pinned Flow keeps breaking, every pinned run repairs it again and pays
  model calls each time, because each run starts from the pinned version. This follows from "replays
  exactly the pinned version". Using the waiting proposal as the starting point for the repair would save
  the cost but bends that rule. Left as is, and documented in the guide.
- **Not every proposal is kept.** The newest 20 per pinned FluxNode are kept, deduplicated by steps digest.
  This keeps the Flow metadata small (the same bound task memory uses for `flowBases`).
- Other lanes' uncommitted edits are in the same tree, including in owned files:
  - `create-fluxnode-service.ts` and `events/person-sink.ts` in svc (pipeline overrides refusal, person
    wait).
  - In contracts, `run/error.ts` and `http/error-status.ts` show changes. I did not touch those two.

  I made targeted edits around them and reverted nothing.
