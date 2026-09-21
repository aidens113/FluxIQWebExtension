# w2-arbitrary-js-node-live report

## Outcome

Partial. The registered privileged browser JavaScript node is implemented, the hand-authored real-browser path and direct `result` port passed, and focused package checks/builds pass. The two authorized real-provider attempts were made exactly once each, but neither produced a recoverable acceptance oracle, so the brief's two provider journeys remain unverified and no additional provider call was made.

## What changed and why

- Downstream registers `web.dom.run_javascript` as a visible executable output node with bounded literal source, JSON-object inputs, timeout, a declared `result` data port, privileged safety, and mandatory operator approval.
- The gateway and extension execute only the registered command. The background executor independently rechecks source bytes, recursive JSON input shape, input bytes, timeout, and output bytes without logging values.
- Chrome/E2E request `userScripts`; Firefox declares it optional and currently has no permission-request path. Missing API, missing grant, or a browser without one-shot `userScripts.execute` fails closed.
- Availability uses the official no-argument `userScripts.getScripts()` probe. Reviewed source runs in `USER_SCRIPT`, which removes extension-API access but still allows page reads/mutations and possible page-context network activity.
- Timeout bounds how long FluxIQ waits. It cannot forcibly terminate a still-running user script, particularly synchronous non-termination.
- Downstream declares `metadata.resultPath: "result.extracted"` only for this node. Core's generic IO policy projects that bounded path for both direct and runtime dispatch, withholds missing/invalid paths, and preserves ordinary output envelopes and existing `recordsPath` behavior.
- Core's node contract marks the exact source parameter as executable. Definition validation rejects executable source unless the node is executable, privileged, and requires operator approval (`node.executable_source_requires_privileged_review`).
- LLM output validation permits executable text only for the exact registered parameter object/key using path/object identity. Copying identical text under unrelated `code`/`script` data is rejected; ordinary nested data such as `metadata.source` remains valid.
- Provider guidance prefers purpose-built catalog nodes and names JavaScript only as a reviewed escape hatch. Proposal planning classifies this node on the strongest existing high-risk/manual-review path.
- Architecture docs now cover the projection contract, review invariant, browser permissions/support, page-level power, and timeout limitation.

Owned product files changed are under downstream `domain/src/actions`, `domain/src/client`, `domain/src/io`, `domain/src/output-nodes`, `apps/extension/src/runtime`, runtime status, the three extension manifests, and downstream architecture docs; paired Core changes are confined to Automation Studio node contracts/validation, bootstrap catalog text, LLM prompt/output validation, IO policy, focused tests, and architecture docs. No test-runner, Scenario Lab, flow-lane, live-instruction, or provider-harness diff remains.

## Live evidence

### Hand-authored journey — passed

- Browser: disposable Playwright Chromium 151 profile, real unpacked extension, disposable Lab page, real panel API/gateway/extension path.
- The browser's per-extension **Allow user scripts** toggle was initially off. Enabling it and restarting the browser made the no-argument availability probe and one-shot execution available.
- A canonical parent/router/subflow Flow executed `web.output.dom-run_javascript`. The first JavaScript node returned a bounded object with numeric sum `7` and marker `js-live`.
- Core exposed that object directly on the node's declared `result` port, not as the gateway envelope. A downstream Set Variable consumed it, and a second JavaScript node consumed the direct object and set an independent page marker. Flow status, node statuses, result-port oracle, and page oracle all passed.
- The installed Chrome 134 build exposed registration/query APIs but not one-shot execution; it failed closed. Chromium 151 provided the needed API.
- The visible Create Project controls appeared enabled in the DOM, but Playwright clicks did not invoke their handlers. The cause was not established. The proof therefore used the authenticated real panel API to author the canonical Flow; it did not bypass Core, the gateway, the extension, or the browser runtime.
- No source, returned payload, page data, token, or browser profile is reproduced in this report beyond the bounded structural oracle above.

### Real-provider purpose-built choice — not recovered

- Planned task: fill the disposable Basic form with a name and team and submit, using purpose-built nodes; oracle required zero JavaScript nodes.
- Exactly one outbound provider attempt produced a validated/persisted proposal. A temporary diagnostic harness then incorrectly treated `automationStudioCall`'s already-unwrapped value as an envelope and reported `lab.generation_http_undefined`. The isolated topology was removed before node inspection, and the finalized run retained no project/adaptation closed projection from which the zero-JavaScript oracle could be recovered.
- Run identifier: `run-muanst5s-357f6e55`. It was not applied or executed. All temporary harness edits were restored.

### Real-provider escape-hatch choice — failed closed

- Planned task: use purpose-built form nodes, then propose reviewed JavaScript to set a page marker, append a marker, and return bounded JSON; oracle required visible literal source plus strongest manual review before apply.
- Exactly one outbound provider attempt was rejected categorically as `flow_bootstrap.provider_output_invalid` before proposal persistence. No raw provider output is retained here. It was not applied or run.
- Run identifier: `run-muanxhdv-83179903`. The runner's settlement counter remained zero because rejection preceded settlement accounting, but this was an actual outbound call and was treated as the second and final allowed attempt.

## Commands run and observed results

- `pnpm exec tsx --test domain/src/output-nodes/tests/definitions.test.ts domain/src/output-nodes/tests/parameter-contracts.test.ts domain/src/io/tests/manifest-definitions.test.ts apps/extension/src/runtime/tests/run-javascript.test.ts` -> 34/34 passed.
- `pnpm exec vitest run packages/fluxiq/src/programs/automation-studio/nodes/tests/canonical-registry.test.ts packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/output-validation.test.ts packages/fluxiq/src/programs/automation-studio/runtime/tests/io-policy.test.ts packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/plan.test.ts` -> all passed; 54 unique tests, with Vitest also discovering two compiled temporary copies for 162 reported passes.
- `pnpm --filter @fluxiq-web-extension/domain check` -> passed.
- `pnpm --filter @fluxiq-web-extension/extension check` -> passed after adding the new action to the exhaustive runtime-status test map.
- `pnpm --filter fluxiq check` -> passed.
- `pnpm --filter @fluxiq-web-extension/domain build` -> passed.
- `pnpm --filter @fluxiq-web-extension/extension build` -> passed for background, content, page-world, popup, and sidepanel bundles.
- `pnpm --filter fluxiq build` -> passed.
- `pnpm structure:check` -> source checks produced only existing advisories, but the separate working-doc rule failed because supervisor-owned `docs/working/README.md` is stale relative to current document headers. I did not modify that shared index or update the structure baseline.
- `git diff --check` in both worktrees -> passed (Core emitted line-ending warnings only).
- Final downstream name audit found no diff under test-runner, Scenario Lab, live instructions, run-scenario, build-proposal, or flow-lane.

## Not verified

- The purpose-built real-provider task did not reach the zero-JavaScript proposal oracle.
- The escape-hatch real-provider task did not produce a reviewable proposal, so literal-source visibility, approval UI, apply, execution, and page/result oracle were not exercised for model-authored source.
- Firefox execution was not live-tested. With `userScripts` optional and no request path, ungranted Firefox is intentionally unsupported/fail-closed rather than claimed as parity.
- Chrome/Edge beyond the two Chromium/Chrome versions above were not live-tested.

## Open questions or contradictions found

- The Create Project control's click-handler failure needs separate UI diagnosis; its exact cause is unknown.
- Provider call 1 proves provider acceptance/persistence but not the required node-choice oracle because the temporary diagnostic harness destroyed the isolated topology. Call 2 proves categorical output rejection only. These are genuine definition-of-done gaps, not reasons to broaden beyond the explicitly capped two provider calls.
- The supervisor-owned working-document index needs regeneration at the task integration boundary; no structure baseline change is warranted.
