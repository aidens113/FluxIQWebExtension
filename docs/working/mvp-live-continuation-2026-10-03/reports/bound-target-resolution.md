# Bound target plan resolution

Status: owned source frozen;75 focused tests pass; direct domain types await coordinated Core freeze. Worker resume-cd. Brief bound-target-resolution, 2026-10-03 local. Supervisor independently reviews/integrates; no live acceptance claimed.

## Confirmed contracts

Initial7 owner reads: domain plan-resolution/{resolve-plan-node,step-permission}.ts and tests/resolve-plan-node.test.ts; output-nodes/{definitions,targets/targets}.ts; paired Core public nodes/parameter-bindings.ts and runtime/llm/harness-options/plan-parameter-resolution.ts. Supervisor approved four additional read-only owners: downstream native-runtime.ts, targets/tests/targets.test.ts; Core runtime/io-policy.ts and model/action-element-target.ts. Core remains read-only. Own B4 debug/Current State/root ledger read earlier; downstream AGENTS applies.

Core's public resolveAutomationNodeParameterValues resolves a state binding to the supplied runtime value directly, otherwise its fallback; supplied state data is not traversed as another binding. Missing binding with no fallback is recorded missing rather than executable. The public isAutomationNodeParameterStateBinding guard accepts extras, so it is insufficient to authorize nested handle resolution.

Downstream currently accepts concrete handle objects only at root selector/target/element slots. Nested fallback handle hits misplaced. Concrete resolution validates current project/Flow-issued unique target, node/control compatibility, duplicate slot agreement and frame; output parameters contain selector/identity without handle. Permission runs afterward using parameters.element, so merely preserving a bound target would lose the concrete fallback identity used to ask about the step.

Proposed runtime-valid retained representation:

```text
target: {$state: {path: <unchanged state path>, fallback: {selector: <resolved selector>, element: <resolved observed identity>}}}
```

No global selector/element is synthesized from the bound fallback. Core io-policy normalizes resolved parameters.target first. normalizeAutomationStudioElementTarget explicitly reads element inside that adapted target and merges its identity with target's selector. Downstream outputTargetFromPayload selects adapted selector/element; native-runtime forwards actual context.parameters rather than resolving bindings itself. This verifies the fallback shape against both owners. A runtime supplied alternate adapted target replaces fallback entirely; its own identity is used, never fallback's global recorded identity. Existing targets fixtures exercise actual Core normalization and stale-recorded precedence.

## Proposed bounded implementation

1. Recognize only exact state-binding grammar at supported target slot: outer {$state}, inner {path,fallback}; nonblank string path, supported concrete handle fallback {handle,location?}. Enforce exact keys before allowing a nested handle. Do not recursively bless handles in arbitrary objects or other slots. Unsupported selector/element nested binding handles remain refused unless their runtime representation can be independently proved; literal/state bindings with no handle stay existing unchanged behavior.
2. Reuse existing concrete resolveTarget checks for the fallback, at its exact nested path. Keep unresolved/malformed/unknown/stale/ambiguous/not_unique/wrong_control/frame refusals. Replace only fallback with adapted selector+identity; preserve state path. No execution or performed-proof changes.
3. Build a separate permission-only concrete view from that supported resolved fallback. Existing permission gateway sees observed identity/control and declared consequences; retained output remains dynamic target binding without global identity. Existing caller-gated exception unchanged. Absent declaration versus empty declaration remains unchanged; refused permission returns needs_permission.
4. Keep frame authority from the concrete observed fallback with existing explicit frame mismatch checks and derived child-frame ID/path. A runtime replacement may change control within that authorized frame, not silently cross to another frame. No new per-target frame interpretation or global identity introduced. Cross-frame fallback disagreement or explicit conflicting frame stays refused. Need fixtures to confirm exact derived frame payload and alternate same-frame target behavior.
5. Duplicate slot agreement must still compare fallback concrete selector/frame. Mixed static and bound slots must not create a fixed global identity that shadows the runtime target. Decide exact preserved/deleted slot behavior before source edit if existing duplicate-slot rules are insufficient; do not arbitrarily select one of competing targets.

## Open design point before edit

The small owner can preserve target binding and gate its fallback separately, but selector/element state-binding slots have different runtime value contracts (string versus fingerprint). Do not adapt every nested binding to the target shape. Proposed first scope supports only adapted target binding; negative fixtures retain selector/element refusal. Existing root fail-first expected target-only preserved binding matches the dispatch contracts above.

Supervisor approved compare-then-keep boundtarget-only for agreeing target references, including no global old identity. Literal conflicts must refuse rather than be discarded. Exact additional frame-path.test.ts read approved to derive frame capture attributes/path rather than guess. Total13source/test owner reads plus one bounded import-line discovery for loader diagnosis.

## Implementation and validation ledger

- Owned changes only resolve-plan-node.ts, tests/resolve-plan-node.test.ts and tests/plan-step-permission.test.ts. No helper module/barrel or Core change needed. Private boundTargetState validates exact outer/inner grammar before nested fallback handle enters existing target resolution. Malformed/foreign/unsupported nested binding handles never become general accepted handle slots.
- Concrete resolved fallback becomes adapted {selector,element} inside retained target state binding. Agreeing target/selector/element handles and exact agreeing literal identity are compared (key order immaterial), then only dynamic target remains. Conflicting literals/observed references refuse through ambiguity. Other action arguments remain intact. No raw handle in accepted node.
- Permission-only parameters contain fallback identity. Real Core gate denies delete and names the observed Schedule post button; permitting gate accepts dynamic target without global element/selector. Undeclared/empty/instructed rules stay owning gate behavior. No action or execution proof created by resolution.
- Observed child-frame ID/path remain authoritative; invalid/conflicting explicit frame declarations refuse, URL path excludes origin/query. Alternate runtime adapted target tested in same top frame via actual public Core state resolver+normalizer and downstream target reader. Runtime cross-frame replacement and live browser behavior not exercised; no new frame API introduced.
- First in-memory loader invocation failed module loading before tests because trailing directory slash generated doubled paths; corrected URL normalization. No fail-first claim from that invocation.
- Actual fail-first before source edit:6cases/5FAIL/1PASS. Root preserved-fallback fixture plus alternate runtime target, duplicate agreement, child frame and real permission naming failed on existing misplaced rejection; negative malformed/foreign grammar fixture already passed.
- Initial implementation6cases:5PASS/1FAIL from test mistakenly expecting placement hint on ambiguous refusal; corrected fixture to existing ambiguity code/position contract. No source weakening.
- Final four exact focused owner/dispatch files **75/75PASS**, heavy wrapper b1, exit0,4796.816ms Node duration. Added stale/foreign project/Flow negative case after implementation (not separately fail-first). No full suite/build/provider/browser/workspace/env/key/guard/shared-doc/commit changes. Scope diff/line budgets checked separately; direct domain typecheck deferred until supervisor confirms all Core source owners frozen.

Exact test command uses in-memory Node22 TypeScript registerHooks loader: resolve relative .js to .ts and extensionless file/directory to .ts/index.ts; normalize trailing directory slash before appending index; transpile ESNext/ES2022 without generated files. Supervisor can use retained loader invocation from root's original fail-first; four files:

```text
node --import <in-memory TypeScript loader URL> --test domain/src/runtime/llm-evidence/plan-resolution/tests/resolve-plan-node.test.ts domain/src/runtime/llm-evidence/plan-resolution/tests/plan-step-permission.test.ts domain/src/runtime/llm-evidence/plan-resolution/tests/frame-path.test.ts domain/src/output-nodes/targets/tests/targets.test.ts
```

Wrap with `C:/Program Files/Git/bin/bash.exe C:/Users/osrs_/FluxStuff/build-slots/heavy.sh <label>`. Direct touched-domain type command after coordinated Core freeze: `pnpm --filter @fluxiq-web-extension/domain exec tsc -p tsconfig.json --noEmit`. Supervisor owns fresh linked runtime build, structure/type integration and next separately authorized live test. No paid retry/replay requested.
