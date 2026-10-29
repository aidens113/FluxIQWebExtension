# t792 fix3: other-record refusal as its own outcome

## Outcome
Done. A press refused because its only match belongs to another row now carries `refusedBecause: "other-record"` from the extension through the domain to Core. Core no longer calls it a near miss and does not say "the step itself is right ... test again".

## What changed and why
Downstream (`fxwork/t792/!FluxIQWebExtension`):
- `apps/extension/src/content/action-runtime/resolve-target.ts`: `resolveIn` records when a match was refused as another row's control. That covers all matches in another record, and the lone-match veto refusal `other-record`. `notFound(..., otherRecord)` puts `refusedBecause: "other-record"` on the error's resolution, and `results.ts` already passes the whole resolution. It stays at exactly 800 lines, the audit limit, so I compacted my lines. The `misses.push(...), otherRecord = true` comma form is deliberate for that reason.
- `domain/src/actions/types.ts`: additive field `refusedBecause?: "other-record"` inside `WebAutomationTargetResolution` only. `apps/extension/src/content/types.ts` re-exports this type, so it needed no edit.
- `domain/src/client/gateway-mapping.ts`: `carriedResolution` keeps `refusedBecause` only if it is the closed word and drops anything else, so no page text can ride that path. The docblock is updated.
- `domain/src/runtime/llm-evidence/node-run/missing-target.ts`: new optional `refused` argument and `webNodeRefusedBecause(result)`. A refused replay answers `core.replay.failed` with "the step's target matched another row's control ...", on any page. It never answers `remembered` or `unreproducible`.
- `domain/src/runtime/llm-evidence/node-run/replay.ts`: NOT in the owned list and NOT in must-not-touch. A one-import, two-line wiring edit was needed, otherwise the new outcome is unreachable. It passes `webNodeRefusedBecause(result)` and skips the "named control shown" branch when refused. Please review it.

Core (`fxwork/t792/!FluxIQ/.../runtime/service/candidate-trial`; the files are CRLF and I preserved that):
- `target-on-page.ts`: reads `resolution.refusedBecause === "other-record"` before the scores. The step then carries `targetOtherRecord: true`, `retryable: false`, `happened` "The step's target matched another row's control, not the control of the row this pass is on.", and `advice` saying a step inside a repeat must name each pass's own row's control, from the row's value or from a control inside what the pass opened. It carries no `targetOnPage` and no test-again wording.
- `absorbed.ts` and `feedback.ts`: the absorbed tries say the same `happened` (new `targetOtherRecord` input).

Tests:
- Core `candidate-trial/tests/target-on-page.test.ts`: new describe including "a well-scored candidate refused in another record is not targetOnPage", plus absorbed wording, a refusal with a weak or absent measurement, and an unrelated word being ignored.
- Extension `action-runtime/tests/wrong-row-resolution.test.ts`: the refusal word survives into the thrown error's resolution, and a plain miss carries no such word.
- Domain `client/tests/gateway-mapping.test.ts`: the word is carried, and any other value is dropped.
- Domain `node-run/tests/other-record/tests/replay-other-record.test.ts`: a refused replay is `core.replay.failed`, and the same miss without the word is still `remembered`. It sits in a new subfolder because `node-run/tests/` was at the 25-file limit.

Generic examples are used (order-table rows); there is nothing about likes, posts or photos.

## Commands run and observed results
All heavy runs were under the shared lock.
- Core `pnpm test src/programs/automation-studio/runtime/service/candidate-trial` (in `packages/fluxiq`) -> parallel group "Test Files 30 passed, Tests 235 passed"; real-sql group ran; "[vitest-groups] all groups passed: parallel, real-sql".
- Domain `node scripts/test-domain.mjs client/tests node-run/tests actions/tests` (before the file move) -> pass 364, fail 0. After the move and the `as never` fix: `client/tests other-record node-run/tests/replay-remembered` -> pass 71, fail 0.
- Extension `node scripts/test-extension.mjs action-runtime/tests identity/tests` -> pass 352, fail 0. A first run failed my new "no refusal word" test with "ReferenceError: CSS is not defined"; I stubbed `CSS` inside the test.
- `tsc --noEmit -p tsconfig.json` in `domain` and `apps/extension` -> no output (clean).
- `node scripts/structure-audit.mjs` downstream -> after fixes, no FAIL lines. Before fixes it flagged `as never` (gateway-mapping test), the node-run/tests directory limit and the 800-line limit; all fixed.
- Core `tsc --noEmit` in `packages/fluxiq` -> one error: `service/project-build/toggles-record.ts(1,48): TS2724 ... no exported member 'AutomationStudioExploredToggle'`. That file is in the must-not-touch `project-build/**` area, so it is another worker's work in flight. None of my files appear in the output.

## Not verified
- No live or Lab run, and no model calls.
- The Core trial gate (`flow-bootstrap/candidate/trial-gate.ts`, off limits) does not know `targetOtherRecord`. A step carrying it falls to the gate's generic not-found handling. I checked this by reading only; there is no test of the gate with this flag.
- The replay path is tested through the runtime stub. The real extension's `payload.resolution` shape on a failed result is assumed to match what `results.ts` attaches.
- Domain tests were run as the touched directories only, not the full suite.

## Open questions or contradictions found
- `replay.ts` was edited though not owned (see above).
- Core's tsc error in `project-build/toggles-record.ts` is outside this brief.
