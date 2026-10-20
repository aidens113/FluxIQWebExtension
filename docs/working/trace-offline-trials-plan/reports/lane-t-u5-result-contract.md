# Lane T U5: offline trial result contract (report)

## Outcome

Done. All three checks named in the brief pass. Work is in the Core lane worktree `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQ`. Nothing is committed.

## What changed and why

New directory `packages/fluxiq/src/programs/automation-studio/model/offline-trial/`, plus one export line added to the end of `model/index.ts`:

- `vocabulary.ts`: the closed, frozen lists for verdicts (`pass|fail|inconclusive`), evidence origins (`recorded|pure_computation|live|modeled`), scopes (`supplied_state|segment|full_recorded_path|full_live_run`), assertion outcomes (`satisfied|violated|unverified`), provenance (`original|derived`) and the 14 reason codes, spelled exactly as the brief gives them.
- `types.ts`: `AutomationStudioTrialEvidenceResult` and its parts (`...Assertion`, `...Gap` = missing-evidence entry `{reasonCode, scope, operation|null, detail}`, `...Support` = `{observations, operations}`). It also holds the validation answer type, the gate subject type, and the export envelope type.
- `validate-trial-evidence-result.ts`: `validateAutomationStudioTrialEvidenceResult(unknown)`. It returns `{ok:true, result}` with a normalized copy that shares no objects with the input (origins and episode ids deduplicated), or `{ok:false, issues}` using the existing `AutomationStudioValidationIssue` shape with `trial_evidence.*` codes. It refuses:
  - a pass that carries missing evidence or reason codes, checks no assertions, or has any assertion that is violated or unverified (T18);
  - an inconclusive result with no reason, or with no missing evidence;
  - a fail with no reason;
  - a missing-evidence entry whose reason is not in `reasonCodes`;
  - a live origin with no `liveEpisodeId`, and a `liveEpisodeId` with no live origin;
  - a `full_live_run` whose origins are anything other than exactly `["live"]`;
  - a `full_recorded_path` without the `recorded` origin;
  - a `recorded` origin with no `sourceEpisodeIds`;
  - any unknown verdict, origin, scope, reason, outcome or provenance, and malformed identity fields.
- `live-success-eligibility.ts`: `isAutomationStudioTrialEvidenceLiveSuccess(unknown)`. True only for a valid result that passed, has scope `full_live_run`, has origins exactly `["live"]`, names a live episode, and has provenance `original`.
- `whole-run-gate-eligibility.ts`: `satisfiesAutomationStudioWholeRunGate(unknown, {candidateRevision, candidateDigest, goalContractVersion})`. A live success counts only for that exact candidate and goal contract. An offline pass never satisfies the gate.
- `live-episode-tally.ts`: `tallyAutomationStudioLiveEpisodes(iterable)` returns `{liveEpisodes, liveSuccesses}`. It counts each distinct `liveEpisodeId` once, and only from original `full_live_run` results. Offline results, live segments, derived copies and invalid input are ignored (T19).
- `derived-provenance.ts`: `exportAutomationStudioTrialEvidenceResult` and `ingestAutomationStudioTrialEvidenceResult` (T24). Export wraps the result in the `fluxiq.trial-evidence-result` envelope and marks it `derived`. Ingest always forces `derived`, whatever the input says. A derived result is never a live success and never enters the tally, so editing an exported offline result to claim a live whole run creates nothing.
- `index.ts` barrel. Tests are in `tests/`: one test file per source file, plus a test-only builder `tests/trial-evidence-builders.ts`. There are 47 tests in total.

Naming follows existing Core vocabulary:
- The candidate is named by `candidateRevision: number` plus `candidateDigest: string`, the same `revision`/`digest` pair that `runtime/flow-bootstrap/candidate/contracts.ts` uses to bind trial verdicts.
- Episode ids are live run ids (strings, like `trialRunId`).
- The `AutomationStudio` prefix follows the convention for model exports.
- Validation issues reuse `AutomationStudioValidationIssue` (type-only import from `../validation/index.ts`).
- No name collides with the existing `AutomationStudioCandidateTrialResult`/`...Verdict`.
- Nothing in Core already used "goal contract", so `goalContractVersion: string` is new.

Every contract value writes its fields by name. The only spreads copy a named value of the same type and override one field (`{ ...answer.result, provenance: "derived" }`, and the test builders).

## Commands run and observed results

- `pnpm exec vitest run src/programs/automation-studio/model/offline-trial` (run in `packages/fluxiq`; same as the brief's `pnpm --filter fluxiq exec ...`):
  `Test Files  5 passed (5)` / `Tests  47 passed (47)`
- `pnpm --filter fluxiq check`: printed no tsc errors. The build cache printed `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store (0 file(s), 0 bytes)","ms":73281,"source":"command"}`. The command ran through `| tail`, so the `EXIT 0` I saw is the exit code of `tail`, not of the check. I am inferring success from "no errors printed" plus the cache storing the result.
- `node scripts/structure-audit.mjs` (Core worktree root): `EXIT 0`, `structure-audit: passed (407 warning(s), 1152 baselined).` None of the warnings mention `offline-trial`.
- Core's `build` was not run, and `packages/fluxiq/dist` was not touched.

## Not verified

- Tests-first was followed in the order of writing (tests, then implementation). I never ran the tests before the implementation existed, so they were never observed failing.
- Nothing consumes the contract yet: no runtime, trial gate, accounting or storage is wired to it. That wiring belongs to P4 and P6.
- The non-browser fixture adapter from P1 is not part of this brief.
- The reason code `offline_not_allowed_in_phase` exists, but no function checks the phase (Decision 2). Enforcing the phase belongs to P6.

## Open questions or contradictions found

- The brief's "inconclusive without a reason or missing evidence" can be read two ways. I implemented the stricter reading: an inconclusive result needs **both** a reason code and at least one missing-evidence entry, and every entry's reason must also be in `reasonCodes`.
- I added a `provenance: original|derived` field and a `liveEpisodeId` field that the source contract does not list. `liveEpisodeId` separates the live episode this result observed from the `sourceEpisodeIds` its recorded evidence came from. `provenance` is how T24 is enforced. Without signatures a forged envelope cannot be detected, so the guarantee is only that nothing ingested can count as live.
- A pass with reason codes is refused. If later lanes want informational reasons on a pass (for example `live_effect_blocked` on a segment), this rule needs relaxing.
- The whole-run gate also requires the exact candidate digest and goal contract version, which goes further than the brief. That is the supervisor's call to keep or relax.
