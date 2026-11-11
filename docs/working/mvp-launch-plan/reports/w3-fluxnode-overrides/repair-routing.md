# W3 repair routing (t899)

## Outcome
Done (checks listed below; see the Not verified section).

## What changed and why
- `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/round.ts`: the round's `runAutomationStudioLlmEvidenceLoop` call runs inside `runWithAutomationStudioLlmModelRole("repair", ...)` when `run.path === "run_flow_then_repair"`. That path is set by `flow-stage.ts` only when the saved Flow's replay went out and stopped broken, and `rounds.ts` already resets it to `run_flow_then_explore` before any fresh round, so only the round that continues from the failed replay is a repair. Rounds that explore fresh, and attempts whose Flow never ran, stay `explore`. Routing provider returns the explore provider when no `models.repair`, so no models means no change.
- `service/fluxnode/tests/repair-routing.test.ts` (new): learns a Flow, breaks its saved press (`engine.over`), reruns.
- `docs/fluxnodes/guides/choosing-models.md`: repair caveat replaced; `docs/fluxnodes/README.md`: "Repairs on their own model" item removed.

## Commands run and observed results
- `FLUXIQ_TEST_GROUP=real-sql npx vitest run --pool=threads .../fluxnode/tests/repair-routing.test.ts` (from packages/fluxiq) -> 2 passed. With models {explore, repair}: first run's decisions all by explorer, repairer never priced; the repair run's decision calls all served by repairer, priced at it, result cost equals the sum charged. No models: all calls `lane-default`.
- `pnpm docs:check` -> structure-audit passed, framework reference current.
- `node scripts/structure-audit.mjs` -> passed (0 warnings).
- Broader narrow run: see the final line of the return message.

## Not verified
- fluxiq tsc (lead runs it).
- Tests need `FLUXIQ_TEST_GROUP` set and `--pool=threads` on this low-memory machine (default forks pool: "Worker exited unexpectedly" at ~2 GB free). A first combined run of fluxnode + attempt dirs showed 11 files failing, e.g. `pipeline/tests/pipeline-secrets.test.ts` ("secret" format unsupported); that was without the group variable and unrelated to this edit.

## Open questions or contradictions found
- A `repair`-kind route (`run.route.kind === "repair"`, steps did not assemble) is not wrapped: its first round is a repair by the route but the path is `explore`. Say if it should route to `repair` too (one more condition in round.ts).
- A repair that spans several rounds: only the first (path-marked) round is repair; later rounds are fresh by the existing path rule.
