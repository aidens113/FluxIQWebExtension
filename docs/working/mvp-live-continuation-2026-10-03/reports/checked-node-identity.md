# Checked rerun node identity

Worker resume-ab, 2026-10-03. Status: implemented, owning tests pass; source frozen; supervisor integration/verification pending. Own Core rerun-check.ts and its nearest test only. No live/build/full suite/runtime/provider/store/profile/key/env/guard/commit changes.

Read downstream Current State/written brief/A5 debug and Core AGENTS. Initial eight source owners: llm/node-tools/{rerun-check,run-node}.ts; flow-draft/{step,draft,dry-run}.ts; llm/{evidence-loop,evidence-loop-decision}.ts; llm/evidence-loop/call-record.ts. Additional bounded assembly reads approved by root (up to four; exact discovered paths recorded below).

Current checked() parses strict execution metadata, updates argument/resolved form, clears current execution evidence and preserves priorExecution/lasting history, but never updates actionId/toolId. Normal callRecord derives actionId from parsed execution.draft.actionId, uses declared input over raw request, and distinguishes shared tool versus executed action. A5 normalized candidate0060 dom-type/check-only versus later0069 dom-click playback matches this code-level omission; no stored public Flow export was available and none invented.

Proposed smallest owned repair: when authoritative parsed draft declares actionId, synchronize candidate actionId/toolId; prefer parsed declared input and resolved ranWith over raw request, never infer action from arbitrary input.node. Preserve performed identity solely in priorExecution, current effectAppliedfalse and no current callId/instance/proof; unchanged/generic tools and refused checks must stay compatible. Add fail-first changed/unchanged action, generic raw node, authoritative input and refusal regressions plus actual loop propagation.

## Established assembly contract and fail-first

Root approved four extra read-only files: flow-bootstrap/authoring/{assemble-draft,index,draft-bindings}.ts and llm/node-tools/draft-step.ts. The generic assembler delegates write(step); canonical node writer emits node:step.actionId and parameters from ranWith.parameters before input.parameters. It never guesses node from raw input.node. Thus stale actionId after checked acceptance directly maps to stale executable node, even when candidate invocation used a different node. No assembly edit required.

Heavy-wrapper owning rerun-check command before source edit: exit1, 18 tests, 4 failed/14 passed. Failures were exactly changed action verified/present, same-action redundant tool identity, and real-loop changed action. Direct diff also showed raw input overriding authoritative normalized declared input. Generic no-metadata and refused-check compatibility passed. No dependency symptom fixed.

Owned implementation now synchronizes candidate actionId/toolId ONLY from strict parsed execution.draft metadata; prefers declared input and declared effect/proposes when present. No arbitrary value.node inference. Prior execution captured before updating identity; lasting guard remains separate; no new live effect or current execution proof granted. Remaining verification below.

## Validation and exact reproduction

After fix, same owner command: exit0, 1 file / 18 tests passed (8.93 seconds). Core owning diff check passes. Six new cases (verified/present parameterization included) cover authoritative changed identity/input, resolved argument, prior identity and no current proof; generic tool without draft metadata cannot infer identity from raw node; unchanged action/tool normalization; refused metadata changes nothing; actual loop retains checked action. Existing tests still cover lasting-effect guard on subsequent reruns, stale following replay marks, ordinary calls and done-act checks.

From paired Core C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ, exact command:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 checked-node-identity owner' pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/node-tools/tests/rerun-check.test.ts
```

Modified exactly Core llm/node-tools/rerun-check.ts and llm/node-tools/tests/rerun-check.test.ts. No other source/test edit. Final diff 100 insertions/3 deletions; no helper/barrel expansion needed. Own source frozen after observed pass.

Not performed: package typecheck, root integration union, structure audit, builds, provider/live/browser tests, accepted Flow export/replay. Root will run independent union/types once all workers freeze. Fix establishes checked candidate identity consistency; it does not create a missing cart action, run bound candidates, remove retained bindings, loosen quantity guards, or prove A5 would succeed. Stored A5 full executable export remains unavailable; diagnosis is corroborated by normalized artifacts and authoritative source/real-loop regression.
