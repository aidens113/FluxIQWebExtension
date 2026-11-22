# t983 fixed-model discovery

2026-11-22, read-only discovery while t979 final tests wait. No implementation permitted until lead integrates t979 and syncs t983. This tree currently has pre-t979 routing code; inspect the incoming delta before editing.

## Remaining production escalation paths

1. `runtime/llm/role-routing/resolution.ts`: resolves all stronger Claude providers in advance, permits separate explore/judge/repair models from run overrides, and constructs the ladder. `provider.ts` dispatches requests according to active ladder level. `judge-model.ts` separately selects the judge model. `ladder/` owns mutable state, frame, climb logging and attempt identity.
2. `runtime/llm/decision-handlers/model-decision.ts`: executable escalate_model handler. `loop-check.ts`: automatic climbs for no progress or detected loops. Additional OUTSIDE-BRIEF path `decision-handlers/loop-signal.ts`: automatically climbs on change_approach.
3. Additional OUTSIDE-BRIEF path `runtime/llm/attempt-loop/run.ts`: automatically climbs after a failed repair round, preserving shared frame for nested loops.
4. Additional OUTSIDE-BRIEF path `runtime/llm/anthropic/panel-command.ts`: independent provider retry path selects the next stronger Claude model.
5. `runtime/llm/loop-decision/{tool-id,tool,ask,read}.ts` advertises/parses escalation; `options.ts` withholds ask_person until changed approach AND climbed/top. Additional OUTSIDE-BRIEF `decision-handlers/decision-options.ts` supplies those ladder facts. `repeat-guard/loop-detection/watch.ts` and completion/refused-words.ts mention escalation as a recovery option.
6. Additional OUTSIDE-BRIEF `repeat-guard/loop-detection/attempt-record.ts` persists optional version-1 ladder data and decisions; restore reconstructs live ladder from persisted seed. Removing only the obvious call handler leaves automatic escalation and restored-level routing executable.

## Defaults and compatibility

`runtime/models/catalog/default-model.ts` owns generic engine default `deepseek-flash`, explicit FLUXIQ_LLM_DEFAULT_MODEL, and provider-specific default fallback; `catalog/anthropic.ts` owns supported Claude models. Automation role-routing currently falls back to Haiku only when an unnamed engine default resolved to a stronger Claude. P4 should make the automation starting-model selection explicit while preserving an explicitly selected nondefault model. Confirm whether generic catalog default or automation-only default should change before editing that global behavior.

`runtime/run-overrides/frame.ts` exposes optional models.explore/judge/repair, while role-routing/index.ts reexports ladder APIs. Persisted attempt records have version 1, optional ladder base/escalations and decision history. Preserve old records as readable historical data; ignore old escalations for serving calls and reject obsolete live escalate_model instructions with actionable feedback. Avoid gratuitously deleting compatibility exports or changing record versions. Distinct role overrides must no longer cause switching within one automation task; document handling rather than silently choosing a stronger judge.

Attempt identity is currently tied to ladder frame by ladder/attempt-key.ts. Keep a stable attempt identity seam for Anthropic cached continuation when ladder mutation disappears; otherwise judge continuation breaks even though model routing is fixed. t979 adds semantic standalone fallback metadata that must remain same-model after sync.

## P3 follow-up owners

Initial guidance owner is `runtime/llm/evidence-loop-decision.ts`, whose instruction currently tells the model to call core.set_result_processing and describes row conditions. Related tool guidance lives in `runtime/llm/node-tools/result/` and authoring/result-processing. Follow-up should explain broad collection and all-column retention only after P1/P2 contracts land, and must not claim automatic processing already exists. Keep every example generic.

## Requested scope extension

Need approval for decision-handlers/loop-signal.ts and decision-options.ts; attempt-loop/run.ts; anthropic/panel-command.ts; repeat-guard/loop-detection/attempt-record.ts and directly owning tests. These are executable paths or persisted restore owners, not optional cleanup. Model catalog/default and run-overrides configuration need a concrete compatibility choice and any required related type/test scope.

Validation: read-only searches and named source reads only. No heavy command, paid call, code edit, or git mutation for t983.
