# Production parameter recovery audit

Status: Complete — read-only audit frozen for supervisor review
Owner: wait_gaps
Date: 2026-10-01
Scope: Read-only inspection of the seven exact paired Core source/test paths in the downstream written brief. Extension source remains frozen during supervisor gates. This report is the only write.

## Actual inspected contract

- `packages/fluxiq/src/programs/production-runner/types.ts:33–41` defines target metadata as optional `JsonObject`; there is no typed parameterSchema, schema dialect/version, required-property promise or default-application contract here. Run metadata is likewise optional `JsonObject` (`:24`).
- `api/handlers.ts:35–38` checks Start's name and passes the payload to the service. The runtime `service.ts:35–69` accepts optional metadata, verifies a target exists when type/id are supplied, then stores supplied metadata on the run. It does not validate parameterSchema, apply defaults or enforce required/enum/integer/range constraints. The dispatcher receives the run (`:96–103`); consumer-level semantics beyond that point were not inspected and are not assumed.
- The current UI constructs the Start payload with target name/type/id, loops and delays, and **direct `metadata: { fieldName: value }`** (`production-runner.tsx:68–76`). No `parameters` wrapper or target schema is sent. Preserve this envelope and target identity; adding a wrapper or assuming server schema enforcement would change behavior without evidence.
- Loop count is separately bounded/truncated by runtime `boundedInt` (`service.ts:208–211`), whereas parameter numbers are not. The UI loops/delay controls and their empty-input fallback are distinct from target parameters; do not mix their policies in the next parameter-only brief.

## Confirmed UI defects and gaps

1. **Silent first-30 truncation loses parameters.** `productionParameterFields():183` slices the property list to30. The same truncated descriptor list feeds both rendering and submission (`:187–188`), so property31 onward is omitted even when it has a default. There is no parameter-limit notice or launch refusal. An oversized declaration can look ready while producing only a subset of metadata. This is a source-confirmed omission; whether a downstream consumer requires the omitted values is unknown.

2. **Blank and invalid numeric drafts are silently converted.** Number/integer use `Number(raw)` (`:188`). Empty/whitespace becomes0; arbitrary text becomesNaN; `Infinity` or overflow such as `1e999` becomes non-finite. No inline error or pre-submit check exists. Integer accepts fractional values. A cleared field with a default becomes0 instead of an explicit missing/error/default policy. Non-finite numbers enter the constructed metadata object; if JSON serialization is applied, standard JSON serializes them as null, but the exact program-api serializer is outside this seven-file inspection. Do not report a captured wire payload or execution failure.

3. **Complex/unknown declarations are presented as ordinary text.** Any object declaration is accepted; unknown or object/array types render an input. Defaults are coerced by `String`, so an object becomes `[object Object]` and an array becomes comma-joined text. Missing/malformed property declarations silently become string fields. Submission preserves these coerced strings rather than nested values. The UI thus suggests support that the implementation does not provide. No raw-JSON escape hatch or nested-schema contract is established here.

4. **Required, enum and bounds are ignored.** Only title/type/default are retained in descriptors. Top-level `required`, property `enum`, `minimum`/`maximum` and integer constraints have no rendering or validation effect. These are confirmed ignored declarations, **not evidence of an existing guaranteed JSON Schema dialect**. Supporting a deliberate primitive subset requires a documented local UI policy; enforcing arbitrary keywords as if the backend promised them is unjustified.

5. **Defaults are not type-checked and optional absence has no explicit semantics.** Every represented property is always emitted. An untouched string becomes an empty string, number/integer becomes0 and boolean becomesfalse. A malformed boolean default outside the select options can display an unmatched value and still convert tofalse; malformed numeric defaults can produceNaN. Untouched valid primitive defaults are currently emitted and existing tests depend on that. The next brief should distinguish no user edit from an explicit empty edit and validate defaults with the same supported primitive policy. Omission of optional no-default fields is a proposed policy change, not a current contract requirement.

## Preserved safeguards and owning test coverage

- API replacement remounts the keyed workspace; synchronous `ownerCurrent`, layout mounted state and current action identity guard captured handlers. Parameter drafts are fenced by `[target.type,target.id]`; fallback target/type changes mask old values before effect cleanup. Preserve these boundaries.
- Launch uses the existing synchronous operation lock and awaits the current target's response, with target-key-scoped error presentation. Input edits remain usable during pending launch and are retained on refusal. Workload mutation locks are per run. Snapshot polling/refresh/freshness behavior stays untouched.
- `production-runner.test.ts` has four cases: two primitive descriptor defaults, invalid/null schema, source contract assertions, deterministic bounded log ordering and loading/empty states. It has no numeric draft or property31 coverage.
- `production-runner-operations.test.tsx` has seven cases covering launch/run locks, retry draft retention, type-key defaults, unexpected rejection, refresh coalescing and removed-target fallback. `production-freshness.test.tsx` covers external polling, stale recovery, hidden reads, API ownership, obsolete handlers and target-scoped pending failures. None covers required/enum/range/nested/default validation. All should remain passing without weakened assertions.

## Bounded implementation recommendation

Release one serial UI-only unit; the launch owner and field view need a shared validation result. Leave runtime service, handlers, types, API transport, operational refresh and locks read-only. No schema-library/backend changes or raw JSON editor are needed.

Exact proposed Core ownership (relative to `apps/web/src/features/programs/`):

- Existing `live-views/production-runner.tsx`: integrate parameter preparation before POST and render field errors/unsupported/limit feedback, preserving Start metadata envelope and existing ownership/lock boundaries. Keep current exported descriptor compatibility through a wrapper/reexport or explicitly update its owning import in the next brief.
- New `production-parameters/prepareProductionParameters.ts`: one pure exported preparation function, with narrow exported result types in the same file. Returns supported field descriptors, normalized metadata or fixed field/schema issues; never posts or mutates drafts. Validating on each render may inform controls, but captured submission must validate its own current schema/draft again.
- New `production-parameters/ProductionParameterFields.tsx`: one exported component rendering supported descriptors and keyed controls with field-level accessible errors and unsupported/limit feedback. Values stay externally owned; no effects that reset drafts or steal focus on polling. A first-error focus handoff only after explicit failed Run may be separately specified/tested if needed; no general asynchronous autofocus.
- New `production-parameters/index.ts`: focused barrel.
- New `production-parameters/tests/prepareProductionParameters.test.ts`: pure declaration/value boundary tests.
- New `production-parameters/tests/ProductionParameterFields.test.tsx`: controlled draft, labels/errors/current callbacks/field identity tests using the existing React test style.
- New `live-views/tests/production-parameters-recovery.test.tsx`: actual mounted ProductionRunnerLive, synthetic snapshots/deferred requests; assert invalid/unsupported inputs make zero Start calls and corrected values issue one valid unchanged metadata payload.
- Existing `live-views/tests/production-runner.test.ts`: only truthful moved helper/source ownership expectations if extraction requires it. Existing operations/freshness files are read/run unchanged.

### Explicit policy decisions for the implementation brief

1. Absent parameterSchema keeps the existing empty metadata launch behavior. Malformed declared schema, unsupported property types/composition and >30 declared properties should show a fixed actionable limitation and block parameterized launch rather than silently send partial/coerced metadata. Retain the30-field budget with an explicit count/limit message; expanding to unlimited fields is unnecessary. No automatic target switch or draft clearing.
2. Supported subset: top-level object with own properties; string, boolean, number, integer primitives; finite correctly typed defaults; finite numeric minimum/maximum; type-compatible primitive enums; top-level required names. Accept only well-typed recognized declarations. Missing type may retain legacy string inference only if explicitly authorized; unknown keywords must not imply comprehensive schema support. Reject unsupported structures explicitly rather than pretending their constraints were enforced. The supervisor should define how harmless annotations/unknown assertion keywords are distinguished before coding.
3. Required blank input should give an inline correction message and prevent POST. Optional empty numeric input should omit the property rather than silently invent0; untouched valid default should emit the default. Explicit numeric0 remains0. Optional strings/booleans need stated empty/absence policy to avoid silently changing current behavior. This is frontend normalization, not a claim about backend-required values.
4. Parse numeric text only after trim/nonempty checks; require Number.isFinite and Number.isInteger for integer, then declared finite bounds/enums. Do not truncate, clamp or replace invalid user values. Invalid defaults/schema enum members/bounds should report a declaration limitation, not quietly select a different value. Never display exception/private metadata contents in errors.
5. Same target schema changes on polling must preserve explicit typed drafts and revalidate against current declarations. Removed fields should not be posted; new untouched supported defaults may apply. Current target/API change behavior remains unchanged. Refused valid launches retain all edits and existing retry behavior; validation should not acquire a second lock or add polling/detail reads.

### Exact regressions

- Pure: absent versus malformed schema;30 versus31 fields; missing/malformed declarations; object/array/union types and nested defaults; numeric blank/whitespace/text/Infinity/overflow; zero/negative/decimal/exponent finite numbers; integer fractions; correctly typed versus invalid defaults; required names/empty inputs; type-compatible versus malformed enums; inclusive numeric bounds and malformed contradictory bounds. Own dangerous-looking field names should use safe own-property construction rather than prototype assignment; this is a helper-hardening case, not a reproduced exploit.
- Mounted: no POST for invalid number or unsupported/oversized declaration; fixed accessible field feedback with current typed value retained; correction produces exact Start metadata with target/name and no wrapper; valid defaults/explicitzero/optional numeric omission policy; current enum selection; refusal/rejection keeps draft and retry; schema refresh revalidates without clearing draft; target type/id/API replacement and captured old handlers keep existing fences; no new request count/polling changes; immediate duplicate valid Run still issues only one POST.
- Run the unchanged operations7 and freshness cases alongside the new mounted tests, plus the existing descriptor/source contract file. Scoped types then freeze for supervisor full web/type/build/structure verification. No live run/provider use is needed for this bounded UI contract work; live execution is not certified by these tests.

## Validation ledger

- 2026-10-01: Read downstream Current State and exact Production parameter recovery brief. Read exactly seven named Core source/test files and used targeted `rg` to establish conversion/owner/service paths. No extra contract/serializer/dispatcher file inspected.
- No product/test/shared-doc edit, test/type/build/heavy command, live/browser/provider call, panel management or commit. Findings are source analysis only; proposed policy needs explicit release before implementation.
- Report complete and frozen. The frontend subset/default/optional/limit policies above are recommendations to make the next written brief precise; they are not guarantees inferred from the runtime metadata contract.
