# g-core-target-gate: a truthful trace and the right fingerprint (B.1, B.2, item 3; Core)

Worker report. Core `F:\!FluxIQ` at `267a2ca`, uncommitted. Nothing in this
repository was edited except this report.

## Outcome

**Done**, with one ownership widening the supervisor must accept or reject
(Open question 1). B.1, B.2 and item 3 are landed in Core. Each has a probe row
that failed before its fix, and each guard has a mutation that was seen failing
the right row and restored byte-identical. Core `pnpm check`, `pnpm docs:check`
and `pnpm structure:check` exit 0. The Core test sweep's result is under
Commands.

Readers of the status union in this repository, as the brief asked:
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts:47-55` (type, with
  `minimumConfidence: number` required, and `TARGET_RESOLUTION_STATUSES`) and
  `:164-179` (`targetResolutionOf` returns `undefined` unless
  `minimumConfidence` is a finite number).
- `packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts:92-95`
  builds the old `unresolved_no_candidates` shape with `minimumConfidence 0.55`.
- `packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts:219` uses the
  `matched` shape, which is unchanged.
- None in `domain/src` or `apps/extension/src`.

**Consequence:** after this change the Flow lane silently drops every
no-candidates resolution, which is every web dispatch today, as "absent". It
does not fail. See Open question 2.

## What changed and why

All paths below are under
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\` unless given in
full.

### B.1: the trace no longer claims a floor that was never applied

- **`nodes/contracts.ts`:** `AutomationNodeTargetResolution` is now a
  discriminated union.
  - `{ status: "unresolved_no_candidates"; candidateCount: 0 }` has no
    `minimumConfidence`.
  - `matched`, `no_match` and `below_confidence` keep it.
  - The JSDoc says why.
- **`runtime/io-policy.ts` `resolveElementTarget`**, the no-candidates branch:
  - The resolution drops `minimumConfidence`.
  - The diagnostics `reason` now reads "No runtime element candidates were
    supplied, so Core applied no confidence floor and left resolving the
    element to the output adapter."
  - The ladder, the other branches, and `elementTargetMinimumConfidence` are
    untouched. B.3 is not wired.

### B.2: the mapper's target comes from the recorded element

**`model/action-element-target.ts`:**
- When the value normalized carries an `element` object,
  `normalizeAutomationStudioElementTarget` builds the fingerprint with a new
  private `actionParametersFingerprint`. It merges
  `normalizeFingerprint(element)` with `normalizeFingerprint(parameters, false)`.
- The parameters' own signals win where both name one. That keeps the recorded
  `selector` and `statePath` exactly as before, which matters because domain
  `output-nodes/targets.ts:12-17` reads the dispatched selector from
  `adaptedFingerprint.selector` first.
- `normalizeFingerprint(value, readsText = true)` promotes `value.text` only
  when `readsText` holds. This is the mutation site: `?? (readsText ?
  safeString(value.text) : undefined)`.
- `role` falls back to `value.implicitRole`.
- A canonical `{kind:"element"}` target is still returned as-is. Parameters
  without `element` normalize exactly as before (a test row pins this).
- No export was added. Line 74 (`normalizeAutomationStudioElementTarget`) and
  line 89 (`validateAutomationStudioElementTarget`) did not move.

**`runtime/service.ts` `normalizeRecordingCandidateElementTargetParameters`:**
- When `parameters.element` is present, it normalizes the whole parameters, so
  the element is read beside a bare locator target. Otherwise it keeps the old
  order: `parameters.target`, then `parameters`.
- It went from 4 lines to 3 lines to pay for item 3's line.
  - `service.ts` is 6919 lines, exactly its `file-lines` baseline, before and
    after.

**Effect downstream, read and not run:**
- **Element sent to the page:** with no `selectedCandidate`, domain
  `output-nodes/targets.ts:60-67` and `client/gateway-mapping.ts:211-216` still
  put `payload.element` first, so the page receives the same element and
  selector as before.
- **Other callers:** the normalizer's `io-policy.ts:201-202` fallback, used for
  parameters with no explicit target, gets the same element-aware fingerprint
  at dispatch.
- **Storage:** storage normalization (`runtime/service/object-documents.ts:237-261`)
  reads only `parameters.target` and `entry.target`, so it is unaffected.

### Item 3: a late domain event is refused, and reported as discarded

- **`runtime/service.ts` `appendRecordingDomainEvent`:** inside the recording
  lock, `if (recording.endedAt !== undefined) throw new Error("Finalized
  recordings are immutable.");`. This is the same refusal as `:1017` and
  `:1267`.
- **`client-gateway/bridge.ts` `appendRecordingEvent`, the domain-event branch
  (about `:363-383`). This file is outside my Owns.**
  - The `appendRecordingDomainEvent` call is wrapped in `this.appendOrDiscard(active,
    [{ session, message: { kind: "recording event", label, domainId, inputId } }], ...)`.
  - The follow-up check became `if (result && !result.accepted)`.
  - Without this wrap, the refusal escapes and fails the gateway receive,
    reintroducing CS1b′. Mutation M6 below shows it.
- **HTTP:** the handler `api/handlers/runtime-execution.ts:96-102` now surfaces
  a thrown error for a finalized recording where it used to return `ok: true`
  and write the event, as the other appends already do.

### Tests (Core)

- **`runtime/tests/io-policy.test.ts`:** a new row, "claims no confidence floor
  on the trace or the run record when no candidates were supplied for one to
  apply to". This is probe b1.
  - The attempt's `targetResolution`, and the persisted run detail's
    `actionAttempts[0].metadata.targetResolution` (what the test-runner reads),
    equal `{status:"unresolved_no_candidates", candidateCount:0}`.
  - `outputs.elementTargetResolution` has no `minimumConfidence`.
- **`model/tests/action-element-target.test.ts`:** three rows.
  - A type action's identity comes from its element and never from the typed
    text. This is probe b2.
  - A click carries the element's text, identifiers and implied role.
  - An authored role beats the implied one, and parameters without an element
    read as before.
- **`runtime/tests/service.test.ts`:** the existing "normalizes mapper element
  targets in recording Flow proposals" test became a three-case loop.
  - The first case is the original explicit-target case.
  - "Typed text beside an element".
  - "Bare locator target beside an element".
  - The file shrank from 4789 to 4787 lines. A separate new test file would
    have made `runtime/tests/` hold 26 source files, over the 25-file limit.
- **`client-gateway/tests/bridge.test.ts`:** a new row, "discards a domain event
  that reaches Core while Stop is finalizing, instead of writing it into the
  finalized recording".
  - It uses the existing `recordingHeldAtFinalization` and registers a
    recording domain.
  - It expects: receive resolves, empty timeline, no `server.error`, exactly
    one `recording.event_discarded` with `executable:false`.
  - **This file is outside my Owns.**

### Docs (Core)

- **`docs/architecture/automation-studio.md`:** the `targetResolution` paragraph
  says a no-candidates attempt records no threshold.
- **`docs/architecture/automation-studio-native-nodes.md`:** the dispatcher
  paragraph gets the same fact. The Element Matching section gets the
  mapper's element rule: `implicitRole` counts as `role`, and `text` never
  becomes `visibleText`.
- **`docs/architecture/package-boundaries.md`:** a new migration note under
  "Migration Notes", headed "Unreleased: the element-target trace claims only
  what Core applied". It covers the union change, the mapper and dispatch
  fingerprint change, and the domain-event refusal.
- **`docs/reference/framework-reference.md`** and
  **`packages/fluxiq/docs/reference/framework-reference.md`:** regenerated by
  `pnpm docs:reference`, because a public export changed shape. The diff is
  line numbers for four `nodes/contracts.ts` types, plus the longer
  description of `AutomationNodeTargetResolution`.

## Commands run and observed results

All from `F:\!FluxIQ\packages\fluxiq` with
`npx vitest run <file> --no-file-parallelism` unless noted. Outputs are in the
scratchpad as `gct-*.txt`.

**Baseline at `267a2ca`, before any edit:**
- `pnpm structure:check` (root) exited 0: "structure-audit: passed (120
  warning(s), 256 baselined)".
- `pnpm docs:check` exited 0: "Deterministic framework reference is current."
- `io-policy.test.ts` 9 passed; `action-element-target.test.ts` 5 passed;
  `bridge.test.ts` 15 passed.

**Probe rows before the fix (tests written first):**
- io-policy: 1 failed, "expected { …(3) } to deeply equal { …(2) }". The third
  key was `minimumConfidence`.
- action-element-target: 3 failed.
  - "expected { visibleText: 'Ada Lovelace', …(2) } to deeply equal { selector:
    '#display-name', …(6) }"
  - The click row lacked the identity.
  - "expected undefined to be 'tab'".
- bridge: 1 failed, "expected [ { type: 'domain_event', …(9) } ] to have a
  length of +0 but got 1". The late event was written into the finalized
  recording.
- The mapper probe (at that point a separate file): 2 failed, both "expected {
  kind: 'element', …(2) } to match object".

**After the fixes:**
- io-policy 10 passed, action-element-target 8 passed, bridge 16 passed.
- The mapper probe passed 2/2. After it was folded into `service.test.ts`, `-t
  "normalizes mapper element targets"` gave 1 passed, 107 skipped.

**Mutations.** Each was restored, then `cmp` against a copy taken before
mutating printed "identical" for all four source files, both after rounds 1-2
and at the end.

| Mutation | Result |
| --- | --- |
| M1: `io-policy.ts` resolution gets `minimumConfidence` back | io-policy exit 1. Only the new row failed: "expected { …(3) } to deeply equal { …(2) }". |
| M2: `?? safeString(value.text)` restored | action-element-target: only the type row failed. Mapper type row: "expected '{"kind":"element","fingerprint":{"acc…' not to contain 'Ada Lovelace'". Re-run after the move into `service.test.ts`: "typed text beside an element: expected '{"kind":"element","fingerprint":{"acc…' not to contain 'Ada Lovelace'". |
| M3: `?? safeString(value.implicitRole)` removed | action-element-target: the type and click rows failed. Mapper: both rows failed. |
| M4: mapper order back to `parameters.target` first | Only "reads the recorded element beside a bare locator target" failed, missing `accessibleName`, `id`, `role`, `tagName`. Re-run after the move: "bare locator target beside an element: expected { kind: 'element', …(2) } to match object". |
| M5: the service `endedAt` refusal removed | bridge: only the new row failed, "to have a length of +0 but got 1". |
| M6: the bridge call made directly instead of through `appendOrDiscard` | bridge: only the new row failed, "promise rejected "Error: Finalized recordings are immutable." instead of resolving". |

**Structure, check, docs:**
- **Scratch-index audit with the new test file staged:** exit 1, "FAIL
  [directory-files] packages/fluxiq/src/programs/automation-studio/runtime/tests/:
  26 source files exceeds the 25-file limit." I folded the rows into
  `service.test.ts` and deleted the file (`runtime/tests/` is back to 25).
- **`pnpm structure:check` (root) afterwards:** exit 0, "structure-audit: 1
  baseline entries can be lowered ... passed (120 warning(s), 256 baselined)".
- **`pnpm check` (root):** exit 0 both before the fold and after it. The final
  run printed `tsc --noEmit` "Done" for `packages/client-gateway-websocket`,
  `packages/fluxiq` and `apps/web`.
- **`pnpm docs:reference`:** exit 0.
- **`pnpm docs:check`:** exit 0, twice. The final run was on the final tree.
- **The final `pnpm structure:check` on the final tree:** exit 0.

**Core test sweep on the final tree:**
`npx vitest run src/programs/automation-studio/runtime src/programs/automation-studio/model src/programs/automation-studio/client-gateway src/programs/automation-studio/nodes --no-file-parallelism`
-> exit 1: "Test Files 1 failed | 51 passed (52)", "Tests 4 failed | 554 passed
(558)". All four failures are in `runtime/executor/tests/node-execution.test.ts`,
under "a rejected expected state fails the attempt", for example "expected
'succeeded' to be 'failed'" at `:160`. None of them is in a file I changed.

**The four failures follow another writer's edits, not mine:**
- **What changed under me:** during the sweep, `git status` began showing
  `runtime/executor/tests/node-execution.test.ts` (+125/−25 across both files)
  and `runtime/executor/transition-comparison.ts` as modified. I did not touch
  either. Their modification times are 00:42:19 and 00:44:03, both after my
  sweep started at 00:38:39.
- **Reruns of that one file alone, over time:**
  - Current tree at 00:42-00:43: 4 failed, 7 passed.
  - With the `HEAD` versions of my four runtime sources swapped in, then
    restored (`cmp` "restored identical" for all four): 11 passed.
  - My sources again at 00:44:24: 1 failed, 10 passed ("gives Core's record,
    and its comparison status, in place of a host record that does not parse").
- **The results move with the other writer's edits.** The failing group drives
  `runAutomationStudioGraph` through a stub `effectDispatcher` (`:139-146`),
  which never reaches `io-policy.ts`, the mapper, the normalizer or the bridge.
- **What it proves:** these runs do not isolate the cause while those two files
  keep changing. That needs a rerun once the other writer is done.

A first sweep was started and stopped by me before it printed results, to
avoid racing the test move. It is not evidence either way.

## Not verified

- **Lab: a generated Flow's nodes carry the recorded identity and no typed text.**
  - **Click node:** `parameters.target.fingerprint` should carry the recorded
    identity the wire delivers: `visibleText`, `tagName`, `testId`, `id`,
    `classNames`, `attributes`. It should also carry `role` from
    `implicitRole` and `accessibleName`, once `g-recorder-signals` puts them on
    the wire. `selector` and `statePath` should be as before.
  - **Type node:** its `parameters.target.fingerprint` should contain no typed
    text.
  - Both are read off the generated Flow (as `L-replay` did at its line 151).
- **Lab: the Flow lane's `targetResolution` for a no-candidates dispatch.** It
  will now be absent from the lane outcome, because of the test-runner reader,
  until that reader is changed. Nothing was run to see it.
- **Lab and live:** no page behaviour change was exercised. That the page
  receives the same element and selector is read from domain code, not run.
- **A late domain event from the real extension** was not exercised. Whether
  the Lab's web inputs ever take the domain-event route (unregistered input) was
  not checked.
- **Not run:** Core `pnpm build`, root `pnpm test`, Core tests outside the four
  directories swept (for example `apps/web`), and any gate in this repository.
  Nothing in this repository was edited except this report.
- **Candidate scoring:** the effect of `implicitRole` becoming `role` on
  runtime candidates in Core's matcher was not measured. Web supplies no
  candidates today.
- **Single observations:** every run above was observed once. The mutations
  were observed once each, M2 and M4 twice (before and after the move).

## Open questions or contradictions found

1. **Ownership widening.** The brief's Owns omits `client-gateway/bridge.ts`
   and `client-gateway/tests/bridge.test.ts`, but item 3 says the refusal must
   be audited by "the bridge's `appendOrDiscard`". The domain-event call at
   `bridge.ts:364` was not wrapped at `267a2ca`. M6 proves that the service
   refusal alone makes `gateway.receive` reject with "Finalized recordings are
   immutable.", which is CS1b′ again. The dispatch message said `bridge.ts` was
   free, so I made the minimal wrap and one test row there. If that is not
   accepted, item 3 must be reverted as a whole: the service line without the
   bridge wrap is a regression.
2. **The test-runner reader needs a follow-up in this repository.**
   `persisted-flow-run.ts:47-55,164-179` requires a finite
   `minimumConfidence`, so it now treats every `unresolved_no_candidates`
   record as absent. The smallest change: make `minimumConfidence` optional
   for that status in `PersistedTargetResolution` and `targetResolutionOf`,
   and update `persisted-flow-run.test.ts:92-95`. That file shows as modified
   in this repository's working tree, so its owner should take it.
3. **Stale domain comments, for a doc-truth pass.**
   - `domain/src/output-nodes/targets.ts:42-53` says Core's normalization
     "never looks inside `parameters.element`", and that the adapted
     fingerprint "comes back as `{ selector, statePath }`" with "1" signal.
   - `domain/src/client/gateway-mapping.ts:201-209` says the same.
   - Both are now false for parameters that carry `element`, though their
     ordering rule still holds.
4. **Baseline entry that can be lowered:** `file-lines` for
   `packages/fluxiq/src/programs/automation-studio/runtime/tests/service.test.ts`,
   4789 to 4787. I did not run `pnpm structure:baseline`.
5. **Version.** The `package-boundaries.md` note is headed "Unreleased". The
   union change can break a TypeScript host that reads `minimumConfidence`
   unconditionally, so by that page's own 0.3.0 reasoning a minor increment
   seems due. The version choice is the supervisor's.
6. **Commit together:** the two regenerated reference files must be committed
   with the source. `g-core-late-event` open question 5 (a stale reference) was
   already settled at `267a2ca`: `docs:check` passed at baseline.
8. **Someone else is editing Core while this brief runs, which contradicts the
   dispatch** ("nobody else edits Core while you run"). The files are
   `runtime/executor/transition-comparison.ts` and
   `runtime/executor/tests/node-execution.test.ts`, both uncommitted and both
   modified after 00:38. That is W19's expected-state area, though
   `i-w19-expectation` was described as read-only. The supervisor should:
   - find the writer;
   - keep those two files out of this brief's commit;
   - rerun `node-execution.test.ts` and the sweep once that work settles.
7. **Behaviour beyond the mapper, recorded in the migration note.** The
   element-aware normalization also applies at dispatch in
   `io-policy.ts:201-202`, for parameters with no explicit target. The domain's
   source ordering means this changes no command today; it does change the
   `parameters.target` Core writes back and persists in the trace.
