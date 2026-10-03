# t252-w7b: confirm-requests proof (P3 proof, part 2)

## Outcome

Done. One new test file covers the main case and variants (b), (c) and (d). All four cases pass. The main case fails when the service passes no `nodeOf`. No source fix was needed: the proof turned up no defect.

## What changed and why

New file (Core tree, untracked):
`packages/fluxiq/src/programs/automation-studio/runtime/tests/service-authoring/tests/confirm-requests-build.test.ts`
(400 lines, new feature directory, imports `../../service-bootstrap/tests/fixtures.ts`).

It runs a provider-free build through `AutomationStudioService.generateFlowBootstrapAdaptation`, set up the way `judged-build.test.ts` and `extend.test.ts` set theirs up:
- The provider is scripted. The instruction-authority read answers `instructed: []`. The judge answers yes, yes, because a finishing yes is confirmed by a second call.
- A native runtime registers two nodes:
  - `domain.example.friend-requests`: outputs `records` (array) and `success`; parameter `where`.
  - `domain.example.confirm-request`: inputs `in` and `item`; parameter `person`.
- The stand-in domain has:
  - a free look that shows all 8 requests;
  - `core.run_node` live: the list returns the 3 kept rows on `outputs.records`, and the Confirm asks `permission` before it presses;
  - `write: true`, answered with `core.run_node.written` and `draft.written`;
  - replays: reset; a list step that returns the kept rows on `outputs.records` and their labels on `readRows.rows`; a Confirm `verify` that asks the gate for a check declaring `[]` (as the web domain does) and answers `verified`; and a Confirm `step` that answers `replayed`;
  - `resolvePlanNodeParameters`, which puts the Confirm's declared consequences to the plan-time gate.

The data is 8 requests and 3 kept (Ana Ruiz, Aisha Khan, Mateo Silva). The explored row is Aisha Khan.

Cases:
1. **Main case.** Decisions: list with `where` (add); Confirm run live on Aisha Khan with `["modify_existing"]` and `act: a1`; `repeat` 3 over 2; `bind` `person` to `{"$row":"name"}`; complete. Asserts:
   - The status is `proposed`.
   - The only press is the exploration's (`pressed == [Aisha Khan]`).
   - The test sent the Confirm 3 times, all `replay: "verify"`, with `item` equal to each kept row in order and `parameters.person` resolved to that row's name.
   - No non-look call names any of the 5 excluded rows.
   - The request order is 5 decisions, then 2 judge calls.
   - The judge's Confirm line has `runs {repeat, over 2, through 3}` and `passes [{pass 1, row "Ana Ruiz", outcome "verified"}, ...]` for all 3 rows.
   - No judge request names an excluded row.
   - The stored topology has exactly one `builtin.control.for-each`, with edges list `records` → forEach `items`, forEach `body` → Confirm `in`, and forEach `item` → Confirm `item`.
   - The Confirm's `parameterValues.person` is `{"$state":{"path":"item.name"}}`.
   - "Aisha Khan" appears nowhere in `record.topology`.
   - `metadata.declaredConsequences` is `["modify_existing"]`.
   - After approve and apply, `getFlow` shows the same: one For Each, the bound Confirm, and no explored name.
2. **(b) Written.** The Confirm is written with `{"$row":"name"}` (no `bind`). Same test calls, judge passes and stored shape; `pressed == []`. `record.declaredConsequences` contains `{action {kind "flow_step", id confirm}, consequences ["modify_existing"], permitted true}`, and the domain's plan resolution received `person: {$state item.name}` with `declaredConsequences ["modify_existing"]`.
3. **(c) Non-lasting (`consequences: []`).** The test sent 3 calls, each `replay: "step"` with its row and name, never `verify`. The judge shows 3 passes with outcome `replayed`. Same stored shape, with `declaredConsequences: []`.
4. **(d) Zero kept rows, written Confirm.**
   - The test sent no Confirm call, and no judge was asked.
   - The 5th model request carries `core.dry_run {ok:false, code:"llm_evidence_loop.full_run_required", steps:[{step 3, actionId confirm, replayed:"not_reached"}]}`.
   - No topology is stored.
   - The build then ends `flow_bootstrap.provider_transport_unknown`. That ending is a test artefact: the script has no decision after the refusal, so the provider throws.

## Commands run and observed results

- `npx vitest run .../tests/service-authoring/tests/confirm-requests-build.test.ts` (from packages/fluxiq), after the final edits: `Test Files 1 passed (1)` with all 4 tests passed.
- **Without nodeOf.** I removed `nodeOf: nodeDescriptions.definition` at `service.ts:1574` and `:1621`, then ran `-t "recorded Confirm"`. It failed with:
  `AssertionError: expected [] to deeply equal [ 'verify', 'verify', 'verify' ]` at `expectSentPerRow` (`confirm-requests-build.test.ts:294`). The test sent the Confirm zero times.
  I restored service.ts from a scratch backup: `git diff --stat -- .../service.ts` is empty, and `grep -c "nodeOf: nodeDescriptions.definition"` gives 2.
- `bash heavy.sh "t252 w7b vitest" npx vitest run R/tests/service-bootstrap R/llm/node-tools R/flow-bootstrap R/tests/service-authoring`: exit 0, `Test Files 120 passed (120)`, `Tests 1444 passed (1444)`. This ran with w7a's untracked replay-parity.test.ts present, before the last trim of my file. The trim only removed a redundant length assertion and merged timeout constants, and the file passed again on its own afterwards.
- `bash heavy.sh "t252 w7b tsc" npx tsc --noEmit -p .` (packages/fluxiq): exit 0, no output. Run twice; the second run was after the final edits.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (239 warning(s), 349 baselined).` My file draws no warning: it was at 402 lines with a file-lines advisory, which I trimmed to 400.

## Not verified

- No live browser or Lab run. The stand-in domain mirrors the web domain's replay and verify contracts as read from Core's `replay.ts` and the domain's `node-run/verify.ts` header, not from running the web domain.
- I did not run the full `pnpm check` or any other suites. Per the brief, no source was fixed, so there was no source directory to rerun.

## Open questions or contradictions found

- **Without `nodeOf`, the main build is still proposed with its Confirm never tested.** `status === "proposed"` passed before the call-count assertion failed. The walker plans no span, and the bound straight step resolves against nothing (`core.replay.unresolved_binding`, so nothing is sent). That step is then excused as a span member, as D6 specifies for "no rows known".

  This is by design for hosts that cannot describe nodes, and the service does pass `nodeOf`. Still, a bound loop body tested on no row is excused rather than refused. The supervisor may want a host without `nodeOf` refused for steps holding a `$row` binding, as the zero-rows written case already is (`not_reached`).
- The brief's "build's permission gate records" are what `record.declaredConsequences` stores. In (b), the record carrying the declared class comes from the plan-time `flow_step` resolution, because writing a step raises no gate call (D1). It works only because the stand-in implements `resolvePlanNodeParameters`. Without it, `plan-parameter-resolution.ts:167` answers `needs_permission` for any declared class.
- Edges in stored graphs are flat (`sourceNodeId`/`sourcePortId`/`targetNodeId`/`targetPortId`) and node parameters live in `parameterValues`. Noted for anyone writing similar assertions.
