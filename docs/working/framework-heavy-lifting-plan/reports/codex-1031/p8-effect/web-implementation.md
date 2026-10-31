# P8 web implementation

Outcome: Partial ? implementation and focused tests prepared; compiled SDK validation held by lead instruction.

## Changed

All implementation edits are in `C:/Users/osrs_/FluxStuff/fxwork/t824/!FluxIQWebExtension`.

- `domain/src/actions/action-effect/{table,submit-parameter,resolve,index}.ts`: one total trusted floor table, shared false-default submit parameter and parameter-aware resolver through the pure public `fluxiq/automation-studio/action-effect` subpath. No heavy nodes runtime value import enters the extension bundle.
- `domain/src/output-nodes/definitions.ts`: canonical native actionEffect field; shared submit default. Legacy metadata.effect and consequence-declaration metadata preserved.
- `domain/src/client/interrupted-action/commits.ts` and `runtime/lasting-act-statement.ts`: same canonical floor, including download/tab/next_page and unresolved submit. Known unacted statements remain unacted.
- `domain/src/runtime/llm-evidence/node-run/retries/dispatch.ts`: passes resolved actionEffect separately into Core retry input. Gateway exceptions become a typed unknown acknowledgement result without exception details; Core applies the trusted floor and keeps uncertain commits from repeating. No generic retry policy copied.
- `runtime/llm-evidence/{permission,press}.ts`, `node-run/{run,replay,verify}.ts`, and `plan-resolution/step-permission.ts`: actual permission declarations carry canonical resolved actionEffect. Unknown/model-authored fields are never read for authority. Declaration-required predicate is unchanged, and a commit alone invents no consequence classes or permission prompt.

## Tests prepared

- `actions/action-effect/tests/resolve.test.ts`: every kind, native definition/helper parity, unchanged permission requirement on newly covered commits, false/default/explicit/bound submit, metadata spoof, no invented consequences, actual Core native SDK manifest serialization/register/getDefinition parity.
- `client/interrupted-action/tests/commits.test.ts`: every action and parameter variant drives actual interrupted reading; commits remain ambiguous.
- `runtime/tests/lasting-act-statement.test.ts`: new commit kinds and bound submit remain ambiguous, target refusals remain unacted.
- `runtime/llm-evidence/node-run/retries/tests/lasting-act.test.ts`: actual SDK dispatch handoff for bare timeouts and thrown acknowledgements despite model spoof/legacy observe/empty declarations; new commit kinds retry only when unacted/not_landed. Existing landed/unknown tests preserved.
- `runtime/llm-evidence/plan-resolution/tests/plan-step-permission.test.ts`: actual projection of trusted floors with empty consequences, no new prompt for absent declarations on download/tab/Next.
- `runtime/llm-evidence/node-run/tests/unwritten-consequences.test.ts`: declaration retains commit independently of legacy observe and empty model consequences.

## Observed validation and pending commands

`git diff --check` -> exit 0; only existing working-copy CRLF conversion warnings, no whitespace errors.

No types, generated tests or builds run: lead explicitly held these until rebuilt Core 0.17 libraries are ready. No API/browser/panel/full suite calls; no git mutation.

Once the lead rebuilds Core, from the task worktree:

```powershell
pnpm.cmd --filter @fluxiq-web-extension/domain check
$env:DOMAIN_TEST_BUILD_LABEL = 'p8-web-effect'
pnpm.cmd --filter @fluxiq-web-extension/domain test actions/action-effect/tests client/interrupted-action/tests output-nodes/tests/definitions output-nodes/tests/native-runtime runtime/tests/lasting-act-statement runtime/llm-evidence/node-run/retries/tests runtime/llm-evidence/node-run/tests/unwritten-consequences runtime/llm-evidence/plan-resolution/tests/plan-step-permission
Remove-Item Env:DOMAIN_TEST_BUILD_LABEL
```

Lead also owns structure audit and browser bundle check (the pure value subpath must be built/exported by Core). Test/type compatibility is unverified until those commands run; full suites and live browser behavior deliberately unverified. No authored architecture doc changed (not worker-owned); lead should document the new trusted floor and preserve distinction from consequence declaration requirements.

## Lead-audit corrections (source frozen)

Fixed all five findings named by the lead from `test-runs/2026-10-31-t824-web-audit.log`:

- Extracted the coherent packet-store control-word lookup from `node-run/run.ts` into new focused `node-run/control-words/{words,index}.ts`; the original lookup and its scope/handle semantics are unchanged. The caller still forwards all existing contracts and referenceNow. This avoids adding a 26th file to node-run's already full directory. run.ts is now below 800 lines.
- Browser regression imports fixture board classes and scenario through their existing public barrels.
- Expanded each newly packed callback/statement in retry, unwritten-consequence and plan-permission tests. No baseline changes, removed tests or padded line tricks.

`git diff --check` -> exit 0 (working-copy CRLF warnings only). Full structure re-audit remains lead-owned; types/generated tests/builds/browser launch still held until final Core libraries. Source is now frozen for lead acceptance.

## Cycle correction and freeze

Removed the helper's plan-resolution value import: run.ts now passes its already-parsed target handle into the packet-store lookup. `control-words/words.ts` imports only WebNodeRun as a type and cannot reach run.ts at runtime. No baseline change.

`node scripts/structure-audit.mjs --help` -> the CLI has no help-mode exit and ran the full audit instead: passed (238 warnings, 615 baselined), exit 0. This was a read-only structural audit, no generated build or test.
`node scripts/structure-audit.mjs --rule import-cycles` -> passed (0 warnings, 73 baselined), exit 0, after browser public-adapter correction too.

Types/generated tests/builds remain held. Source frozen again for lead acceptance.

## Trusted repeat-safety regression correction (source frozen)

Root reproduced 6 failures in the existing `node-run/retries/tests/uncertain-outcome.test.ts`: new trusted state floors caused Core to treat deterministic replacements as lasting mutations at its ambiguous/verification gates. The six original assertions and their source file remain unchanged.

After root released the downstream validation hold, added the frozen Core `repeatSafe?: true` field only to inspected canonical state setters:

- type: `keyboard/type-text.ts` calls `deleteAllContent` before sending the whole requested text. `actions/type.ts` only presses Enter when submit is true, so conditional commit still dominates.
- check: `checkable-state/checkable-state.ts` reads requested checked/chosen state, returns without a gesture if already correct, and otherwise sets the desired state once. It does not blindly toggle on repeat.
- same-tab navigate: `runtime/action-runner.ts` / `automation-tab.ts` drive the requested address on the selected automation tab (same-address navigation reloads). `newTab` forces a new tab, so the canonical native contract now has commitWhen newTab and the actual shared false-default native parameter; raw true, explicit undefined or unresolved bindings raise to commit.
- clear (additional root-requested inspection): `content/actions/clear.ts` lines around 57 assigns the empty value through setElementValue and reads it back; no append/toggle.
- select (additional root-requested inspection): `content/actions/select.ts` lines around 140 assigns `selectedIndex = option.index` after resolving the requested offered option, then reads back the selected value; no append/toggle.

All event-producing setters can have page-defined lasting consequences, so a declared lasting class must still override their repeat promise. Added actual outside-graph dispatch tests for that across all five setters. Upload carries no safety promise; no file-event/duplicate assumption was made.

Changed: action-effect table/helper/barrel/new shared new-tab parameter; native definitions use that same parameter. Helper now chooses the corresponding predicate schema rather than always passing submit. Tests cover safe defaults, newTab true/unresolved commit without a safe flag, actual registered native resolver/serialization parity and interrupted reading, existing permission declaration expectations, clear/select ambiguous and verification retries, and declared-lasting dominance.

Observed source-only checks:
`node scripts/structure-audit.mjs --rule statement-packing` -> passed (0 warnings, 375 baselined).
`node scripts/structure-audit.mjs --rule imports` -> passed (0 warnings, 3 baselined).
`git diff --check` -> exit 0, working-copy CRLF warnings only.

No types, generated tests/builds, API, browser/panel calls or git mutations. Root owns Core rebuild and re-run of the named tests (include original uncertain-outcome.test.ts, actions/action-effect/tests, client/interrupted-action/tests, retries/tests/lasting-act.test.ts, and plan-step-permission.test.ts). Source frozen for lead acceptance; safety behavior remains unverified against rebuilt Core until those run.
