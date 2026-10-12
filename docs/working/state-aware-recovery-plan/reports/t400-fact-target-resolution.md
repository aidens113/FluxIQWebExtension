# t400: fact target resolution (worker report)

## Outcome

Done. The domain's plan resolver now resolves a `fluxiq.fact.target` node's `{ handle }` target the same way it resolves a step's target.

## What changed and why

- `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`
  - Added the constant `FACT_TARGET_NODE_ID = "fluxiq.fact.target"`, not exported. Its doc comment names the Core owner (the state-aware recovery plan, C9) and the contract: no control, press or permission check.
  - Added the id to `SELECTOR_NODE_IDS` and `ELEMENT_NODE_IDS`. The `target`, `selector` and `element` slots therefore resolve exactly as on a click. The result carries `selector` and `element`, plus `browserFrameId` / `browserFrameUrlPath` when the element is not in the top frame, and the `target` key is dropped.
  - In `resolveWebPlanNode`, a fact target returns its resolution before `webPlanStepPermission`. No step is gated, and `permission` is never called.
  - Why the other checks do not apply: `actsOnTheWrongControl` only covers the select and type/clear nodes, and the `not_a_control` press check only covers `web.dom.click` under `view_history`. Neither applies to this id, so plain text resolves.
- `domain/src/runtime/llm-evidence/plan-resolution/tests/fact-target.test.ts` (new). Copies the runtime-over-snapshot setup used by `resolve-plan-node.test.ts`. It covers:
  - selector + element, with a check that the result equals a click's;
  - a child-frame element, which gets `browserFrameId: 7` and `browserFrameUrlPath: "/embed/form"`;
  - a plain `<p>` resolving both with and without `view_history`, with a permission callback that throws, while a candidate click on the same handle is still refused;
  - an unknown handle refused `web.handle.unknown:target`;
  - a let-go handle refused `web.handle.stale:target`;
  - the resolved parameters read back through `webAutomationFactQuery` (imported from the `facts` barrel) as an `exists` claim with that selector and element.

## Commands run and observed results

All commands run in the worktree, from `domain/` except the audit:

- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `npx tsc --noEmit -p tsconfig.test.json`: exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t400 node scripts/test-domain.mjs plan-resolution/tests runtime/facts`: `# tests 119`, `# pass 119`, `# fail 0`. That includes the 5 new tests (ok 18-22).
- `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`, run from the repo root.
  - First run: 2 FAILs in the new test. One was a reach-in import of `facts/query`; the other was a conditional spread under `contract-spread`. I fixed both.
  - Final run: `structure-audit: passed (184 warning(s), 651 baselined)`. The only warning on a changed file is the existing file-lines advisory: `resolve-plan-node.ts` is now 778 lines, up from 762.

## Not verified

- Core's t392 side was not checked, since Core was off limits. I took the node id and the `{ target: { handle } }` shape from the brief.
- No full domain suite and no live run.
- A `$state`-bound fact target also resolves through the existing bound path, but no test covers it.

## Open questions or contradictions found

- `webPlanStepPermission` with an empty declaration still calls Core's check, and it treats any node it does not own as `mutate`. To follow "no action checks apply", fact targets skip the gate entirely. If Core wants the empty declaration recorded against facts, that would need to change.
- The test spells the id as the literal `"fluxiq.fact.target"`, written once as Core's wire string. I left the source constant unexported, because exporting it would add a public export to a module with several already. Exporting it through the barrel is an option if the supervisor prefers.
