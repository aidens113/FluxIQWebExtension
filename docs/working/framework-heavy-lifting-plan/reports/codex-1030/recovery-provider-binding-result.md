# t819 recovery and result-check binding

Outcome: Done (implementation ready; checks intentionally deferred to the lead while sweep 2 owns validation).

Changed in MAIN Core `C:/Users/osrs_/FluxStuff/!FluxIQ`:

- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/annotate.ts`: removed policy-ID provider fallback; explicit configured provider/model and key metadata reach the resolver.
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`: caller-paid judging receives canonical Flow provider/model/key metadata instead of a hardcoded host provider.
- `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-settings/adaptation-policy.ts`: preserves the Flow's model and named-key reference in recovery policy metadata.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/session-key-provider.ts`: interprets only legacy `host` as unspecified; explicit concrete selections still undergo the existing strict binding validator before key access.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/session-key-provider.test.ts`: added three legacy-host variants, a nondefault Claude model with a chosen key competing with a newer key (native adapter with fake JSON response), and four invalid-provider/mismatch cases proving no key snapshot/reveal/fetch occurs.
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/caller-paid-result-check.test.ts`: captures resolver inputs; added service tests for configured Claude provider/model/key reaching both in-run recovery and result judging, and absence of invented provider/model choices for default Flows. Existing behavior assertions remain intact.

No edits to frozen t818, manifests, versions, model defaults, documentation owned by the lead, runtime data or the two original failing tests. No git operations, provider calls, test runs or checks.

Lead acceptance, from MAIN Core with the sweep-safe environment/fresh runtime root and `FLUXIQ_TEST_GROUP` unset:

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/deepseek-recovery-requests.test.ts src/programs/automation-studio/runtime/tests/refuted-result/tests/repair-replay-chain.test.ts src/programs/automation-studio/runtime/llm/tests/session-key-provider.test.ts src/programs/automation-studio/runtime/tests/service-adaptation/tests/caller-paid-result-check.test.ts --maxWorkers=1 --minWorkers=1
pnpm --filter fluxiq check
pnpm structure:check
```

The frozen-source sweep already supplies the seven fail-first integration results. The new regression assertions were authored before any local run; the lead must observe their actual results and the narrow task gate before integration. No full sweep is needed in this worker's acceptance.

Validation: not run, as the written brief reserves checks for the lead during the full sweep. Read back the edited production/test blocks for static review.

Not verified: compilation, tests, structure audit, rebuilt artifacts, browser/live-provider behavior. No claim of passing checks is made.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/recovery-provider-binding-result.md`.

Notes: Shared cause and pre-call failure distance are recorded in `sweep-recovery-failure.md`. Unknown providers, provider/model mismatches, named-key custody and spending checks were not relaxed.
