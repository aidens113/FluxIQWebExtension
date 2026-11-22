# t987 smaller-judge progress

## Current implementation boundary

Core is at a coherent source-review freeze on parent `81d96341c70391beb43e3117cee15bcd560e062a` (P6 checkpoint plus P2 `05d61fea4`). The approved capability routing, mixed-effect witness checks, exact source matching, and durable checkpoint/parser/save/restore forwarding are now written with owning regressions. This is unvalidated WIP: no P6 heavy tests, types, builds or payload measurements have run. The lead will checkpoint/sync the separate P2 mode context `c1f42f283` and review before validation. P2's subsequent invalidCount completeness correction is not yet present and is not implicitly accepted by these fixtures.

Explicit `judgeEvidenceVersion?: 1` distinguishes true legacy absence from an own field with unsupported/malformed content, including explicit undefined. The web factory declares 1; all approved Core forwarding callers preserve property presence. Untagged generic bindings retain the old path. Any stored v1 finding/summary/checkpoint enforces semantic handling on resume even if the current capability flag is absent. Missing callback or unknown current privacy policy stays a repairable gap, without raw fallback. An already projected summary is structurally read/rescreened, never sent through the projector again. Current privacy rescreening also covers reused full rows/accounts; the private originals remain untouched.

Required action witnesses now follow Core-owned actual effectApplied:true or ambiguous failure independently of declaration presence, and declared consequences/skips where applicable. A data-role mixed step cannot discard these facts. Before/after absence is explicit. Look suppression requires one unique Core-issued callId match; absent, unmatched and duplicate IDs stay projected or missing. The actual web projector strictly reopens unmatched versioned semantic state, including a JSON found string; opaque legacy page text is a gap. Hidden-leaf/page-container text is excluded from semantic controls/notices; actual status/alert evidence and false/empty named states survive.

Durable attempt metadata is optional `judgeEvidence: {version:1, trail, witnesses?}`. Only validated semantic findings, typed framework facts and semantic witnesses enter it; raw found/asked captures and functions never do. Absent is legacy; explicitly rejected persisted metadata normalizes to null while result/acts, processing declaration, source-page provenance and reference time survive. The journal restores the logical before; its saved after remains historical and never substitutes for a fresh resumed end. The new ordered `saveJudgeEvidence` is metadata-only: it does not publish/process rows. A concurrently older full attempt save cannot erase an already saved longer ordered journal. A failed write preserves the returned execution/effect, reports the lost restart checkpoint, and permits a later record save to retry storage.

The exact frozen P2 five-file additive guard patch was captured read-only at `test-runs/t987-integration/p2-shared-guards.diff`, SHA-256 `5215f810506be029c55136b69b715a5d468ab4bf499cf2b33df5852b989617cf` (ignored source-diff coordination artifact, no runtime data). It contains only `attempt/{flow-stage,round}.ts` and `replay/{draft,forward,span}.ts`. P2 subsequently checkpointed the same frozen work as Core `05d61fea4` (unaccepted WIP; validation queued). Dependencies are its `components/automation/{processing-inputs.ts,index.ts}` and engine parameter-refresh inputs guard. It checks every persisted automatic process against current nonsecret caller inputs before resolution/dispatch, forwards those actual inputs through existing forward-run ports, and leaves P6's separate observation constructor/semantic metadata edits intact. The lead owns git integration; no parser was copied or duplicated by P6.

P1 is fully handed off/frozen. The lead independently passed 218/218 downstream domain and 42/42 reader cases and committed its final downstream unit as `731b2b601`. No t982 source/report edits follow that handoff. P6's later Core checkpoint/integration is named above; the Down parent is `6e52458f895ca1bca492f89f921742345adc59f1`. Both sources include accepted P1 contracts 0.23.0 / fluxiq 0.52.0, without a rebuilt-library claim.

New disjoint downstream source is written in `domain/src/runtime/llm-evidence/judge-evidence/{project,state,state-value,action,read,index}.ts` and `tests/project.test.ts`, with optional runtime-contract property and explicit factory binding in `tools.ts`. The projector reads the actual known call/Flow/build shapes, emits action/read metadata and exact source references, and excludes raw captures/row copies. Row cells and full removal/comparison/processing accounts stay in their existing stores/page evidence; current validated schema/exclusions govern those rows. Schema IDs are validated through the public Core parser before being named; excluded IDs/values are not carried. Historical effect uncertainty stays an action fact, not an eternal gap. Unknown/malformed new schema/state metadata yields explicit missing codes without raw fallback. Actual-binding/public-Core fixtures pin current declared privacy keys, explicit known-empty [] compatibility, unknown reopen refusal, and excluded-field omission; nothing infers [] from undefined.

Approved extra downstream owners now written: `result-observation/observe.ts` + `tests/observe.test.ts`, `page-view/published-page.ts` + `tests/published-page.test.ts`, and `observed-state/{observed-state-keys.ts,tests/observed-state-keys.test.ts}`. One semantic-state projection is computed by the ordinary publisher from the same already sanitized capture and carried with the declared view group, so end/witness readers cannot drop it. The passive observer reuses the published value, making no extra capture. State facts retain full named controls/values/selection/marks/notices and explicit false/empty values; unavailable state remains absent. No selectors, geometry, arbitrary attributes or full page-text alias enters the facts. A provider-free synthetic fixture records publication metadata byte overhead; it has not run. The optional new field preserves old typed published-view callers; old page-only required state becomes honestly missing, while supporting capture omission on complete data is not a gap.

Approved Core replay metadata owners are written: `runtime/llm/node-tools/replay/{observation,draft,span,index}.ts`. One constructor preserves actual optional effectApplied/failure/recordSchema/consequences and original evidence/records for normal steps and repeated passes, with no effect inference from resultCode or old-field invention. A real draft/span-to-projector regression is written at `replay/tests/observation.test.ts`. Value/type imports now use distinct aliases. P2 processing guards/callerInputs remain alongside P6 metadata in the combined source; no parser was copied. The lead has released the save/restore owners in t987 only; P2 has no planned edits to those checkpoint files and will notify before any overlap.

The lead also approved `flow-less/window-fitting.ts` plus owning tests, alongside already owned `run-trail/fitting.ts`: versioned semantic evidence must not be reduced to labels/counts for window fitting. Exact rows/accounts/actions stay whole; legacy fitting remains unchanged, and an actual window refusal must remain existing repairable inability rather than hidden truncation or a new terminal. These guards are written; focused fitting/provider-window regressions and measured acceptance remain pending. This report makes no completed-P6 or universal-cost claim.

## Exact review-freeze additions and validation boundary

Released checkpoint owners now edited (all Core paths relative to `packages/fluxiq/src/`): `framework/automation-service/service/answer-first/{trail/held.ts,attempt-store/record.ts,attempt-store/store.ts,attempt/keep.ts,attempt/ending.ts,attempt/run-attempt.ts,carry-on/carried-opening.ts}`. Existing `attempt/{call-chain,flow-stage}.ts` and `flow-run/{flow-run,ports}.ts` carry ordered async semantic evidence. `service.ts` now has only the approved two callback/capability forwarding literals. `completion/check.ts` adds the approved optional actual callId forwarding only; P2 readiness fields remain untouched.

New cohesive Core helper paths: `runtime/result-verification/judge-evidence/{stored-finding,shown,format}.ts` and `run-trail/checkpoint/{types,read,make,index}.ts`; the owning `run-trail/index.ts` exports checkpoint helpers. `stored-finding.ts` validates a private persistence shape; its explicit universal credential pass does not authorize disclosure or replace an unknown current policy with []. Every final read still requires the current declaration. Authored design updates are in Core `docs/architecture/automation-studio/evidence-window.md` and downstream `docs/architecture/page-evidence.md`.

New/updated owning regression files written for this boundary, not run: `judge-evidence/tests/{summary,finding,project}.test.ts`, `run-trail/tests/semantic-sources.test.ts`, `runtime/llm/node-tools/replay/tests/observation.test.ts`, `answer-first/attempt-store/tests/judge-checkpoint.test.ts`, `answer-first/attempt/tests/looked.test.ts`, `answer-first/completion/tests/looked-evidence.test.ts`, plus actual checked web-factory/public Core composition in downstream `domain/src/runtime/llm-evidence/judge-evidence/tests/project.test.ts`. Summary cases cover all three actual adapters, complete data/proven actions, mixed effects with absent/empty consequences, exact rows/accounts, malformed capability/persisted discriminator, no second projection, current-policy rescreen and missing projector after restart. The real call/store/reopen/carry-on case pins processing/reference/source/result preservation and excludes raw captures from persisted metadata. Other pre-checkpoint helper/state/publisher regressions remain in the earlier source inventory.

Observed only: `git diff --check` in both paired t987 trees -> exit 0 (Core reports LF-to-CRLF notices). No P6 test/type/build/audit command has run, no queued P6 heavy job exists, and every payload-size diagnostic is unmeasured until its owning test runs. Still required after source review/sync: owning tests, affected Core and downstream types/builds, audits, actual request/window compatibility, checkpoint failure/reopen acceptance, cache-prefix byte checks and independent lead acceptance. No paid calls, browser run, full suite, raw campaign output or user database writes occurred.

## Initial read-only intake (historical)

P1 remains the first priority while its final checks drain. No P6 product source has been edited, no heavy P6 job submitted, and no git mutation or paid call made. Read the written brief, main plan Current State/L6/P6, lead intake, paired Core AGENTS/CODEX and the relevant existing composition seams.

The three sources currently copy full findings: `run-trail/of/call.ts` takes execution evidence; `of/attempts.ts` takes traced outputs, changes and views; `of/observations.ts` takes complete build observations. `trail.ts` screens and deduplicates byte-identical views but otherwise promises whole findings. Flow-less `judged-summary.ts` also sends looked/readPages/witness views. Build-test `summary.ts` sends a full trail beside its existing lean `observed` account. Changing one source would leave the other paths sending captures.

Existing domain-neutral declarations are `deniedEvidenceKeys`, `observedStateKeys`, `rowContextKeys` and `readRowsKey`. They describe secrets, views and row locations. They cannot safely distinguish every nested raw capture in a Flow's arbitrary outputs. The web domain deliberately does not deny `snapshot` globally because Core's own state option uses it. Core must not recognize DOM/browser keys or guess a capture from matching URLs. The lead accepted using a domain-owned pure projection seam and leaving private evidence intact.

## Approved stable contract

The lead approved the neutral type and exact paths below, except `service.ts` and `answer-first/attempt/run-attempt.ts`, which remain P2-owned until its frozen handoff. A further approved reuse path is `runtime/result-verification/result-evidence/screen.ts`: widen only its parameter to `AutomationStudioResultEvidenceBundle | JsonObject`, retaining runtime behavior and its return contract. Its privacy-only copy preserves actual row UUID/date/number/array values; trail screening would wrongly strip some of them as bookkeeping. Add those value regressions and retain credential/denied-field enforcement.

Add one optional synchronous callback to `AutomationStudioLlmEvidenceRuntimeBinding`, backed by a neutral type in `runtime/llm/harness-options/judge-evidence.ts`:

```ts
type AutomationStudioJudgeEvidenceProjector = (input: {
  source: "call" | "flow-attempt" | "build-observation" | "state" | "legacy";
  evidence: JsonValue;
  definitionId?: string;
  asked?: JsonValue;
  on?: string;
  phase?: "before" | "after";
}) => {
  role: "data" | "action" | "observation";
  evidence?: JsonValue;
  missing?: readonly string[];
};
```

Name the binding property `projectJudgeEvidence`. It is a host function, never model-authored metadata, a persisted callback or a provider call. It only projects supplied values; no I/O, re-evaluation, parsed sample substitution, clock sampling or mutation. Domain code identifies actual semantic output ownership. Core validates the response shape and screens the result with the existing denied-key/credential rules. Missing callback, malformed response or thrown projector becomes explicit coded missing evidence, with no fallback to the original capture. Partial semantic evidence may coexist with missing indicators. No field, row, step or token cap.

The callback's `role` explains semantic responsibility; it grants no permission and makes no success/effect claim. Original execution status, routing/skips, actual reported effect/failure/uncertainty and source identity remain separate Core fields. A succeeded request is not promoted to proof of its lasting effect. The call adapter can retain the actual execution's `effectApplied`, failure code and result reason; Flow/build adapters retain only what their actual records contain and state missing effect evidence when none exists. Invalid projection must never erase a recorded applied or uncertain effect.

Use one pure `runtime/result-verification/judge-evidence/` module to make the judge's copy. Private traces, stored rows, full summaries used by deterministic checks and repair context remain unchanged. Preserve all answer rows and original values, every processing/removal/comparison account and missing-evidence indicator exactly. Keep every trail entry in order, with its outcome and projected semantic finding. States/looks/witnesses go through the same projector; full views do not bypass it via a different field. Unknown legacy state is missing, not reconstructed success. Preserve allowed read rows even when a build has no stored dataset; a label-only store summary cannot substitute for actual row values formerly present in its read observation.

Flow-less keeps its existing `read` summary for deterministic verdict readers and projects only `sent`. Finished-run/build verification projects a copy after deterministic summary annotations and before provider request/window construction. This does not change P0 same-model recovery, reply parsing, confirmation, receipts or budgets. A small optional `evidenceProjection: {version: 1}` tag distinguishes the new sent copy; old persisted v1 summaries remain readable. Keep existing field order wherever retained (Flow-less question then stable trail before varying results); document intentional removal of raw start/end views and verify cached-prefix ordering. Existing window fitting must not cut answer rows/accounts to compensate for retained data.

## Exact proposed ownership and callers

Initial owned paths from the brief remain `runtime/result-verification/run-trail/**`, `result-summary.ts`, `contracts/run-trail.ts`, their owning tests and result-verification architecture docs. All Core source paths below are relative to `packages/fluxiq/src/`.

Additional cohesive Core paths requested:

- `runtime/llm/harness-options/{judge-evidence.ts,binding.ts,index.ts}` and adjacent tests, for the optional host callback/type only.
- New `runtime/result-verification/judge-evidence/{project.ts,index.ts,tests/}` for the one screened request projection and its neutral fixtures.
- `runtime/result-verification/contracts/run-result-summary.ts` for the optional sent-format tag and missing-evidence description.
- `runtime/result-verification/verify.ts`: optional projector request field and request-copy construction only; no recovery/verification-decision changes.
- `runtime/result-verification/run-outcome.ts`: optional projector port and forwarding only; no processing/readiness/repair changes.
- `runtime/result-verification/flow-less/{types.ts,judge.ts,judged-summary.ts}` and adjacent tests: optional argument and shared sent-copy projection, including looked/readPages/witness paths.
- `runtime/result-verification/build-test/{judge.ts,summary.ts}` and adjacent tests: optional argument and shared projection; replace the duplicate full-capture trail while preserving actual row values/accounts and all action observations.
- Necessary adjacent owning barrels for those exported types/helpers.

Exact Core host composition callers, metadata forwarding only:

- `framework/automation-service/service.ts`: two existing literal constructions (bootstrap build judge near its current line 1607; completed-run result ports near line 2471) obtain the optional function from the bound domain.
- `framework/automation-service/service/answer-first/attempt/run-attempt.ts`: Flow-less judge input near current line 252 forwards the optional function. This is a P2-owned shared path and must be serialized after its handoff/sync.
- `framework/automation-service/service/flow-bootstrap-commands/build-judge.ts`: input/central build-judge factory forwarding.
- `framework/automation-service/service/project-build/{whole-trials.ts,subflow-trials.ts}`: the other two central build-judge factory calls obtain the same function from their existing binding.

These composition hunks need coordinated ownership, especially `service.ts` and `run-attempt.ts`; no edits before approval/sync. No P2 feed/store/data interpreter/task-memory/processing ownership is requested. No changes to P4 model routing or P0 judge recovery.

Additional downstream paths requested (relative to paired downstream):

- New `domain/src/runtime/llm-evidence/judge-evidence/{project.ts,index.ts,tests/project.test.ts}`: web-owned semantic finding construction from actual known domain result variants, with no site/task rules.
- `domain/src/runtime/llm-evidence/runtime-contract/runtime.ts` and `tools.ts`: expose the callback on the existing runtime/binding; `bindWebAutomationLlmEvidenceRuntime` already hands that runtime directly to Core, so no new gateway or wire DTO is needed.
- Owning barrel and authored architecture documentation plus adjacent tests.

The projector will reuse actual outcome/read/change/notice/mark/row evidence, not parse a column sample as row truth or reinterpret arbitrary capture text as proof. Where an old state offers only a full rendered view and no trustworthy semantic finding, preserve the explicit gap. A later meaningful read/repair must resolve it; absence cannot count as success.

Report-only forwarding hunks for the two P2-owned files (do not apply until handoff):

```ts
// service.ts, bootstrap build-judge input and completed-run resultPorts:
projectJudgeEvidence: this.llmEvidenceRuntime?.projectJudgeEvidence,

// answer-first/attempt/run-attempt.ts, existing Flow-less judge input:
projectJudgeEvidence: input.binding?.projectJudgeEvidence,
```

Those internal callback options must not enter any serialized request or persisted metadata; only the resulting validated semantic evidence does. The other approved callers forward the same bound function to their existing judge factory.

## Independent implementation progress

Latest boundary: P1's final handoff is complete and frozen. Its final four checks passed (metadata 1/1, complete domain and extension checks, structure 258 warnings/551 baseline). The lead checkpointed P6 Core as `c0244a44d` and synced accepted P1/current dev to `5eb0e2975`, bringing contracts 0.23.0 / fluxiq 0.52.0 source; no P6 build/type/test acceptance is implied. P6 helper/source work resumed, leaving P2-owned save/restore/composition files untouched.

P1's final fixture/source is frozen while its last checks wait. Started only disjoint P6 source in the t987 trees. Added the optional neutral host callback type/binding/barrel and the approved privacy-screen parameter widening. The new pure `judge-evidence/project.ts` clones and deeply freezes callback inputs, validates role/JSON/missing-code output, preserves full UUID/date/number/array values through the existing privacy screen, and emits coded missing evidence for absent/invalid/throwing projections with no raw fallback. Returned output is separately cloned, preventing a projector's retained mutable reference from changing a later request. Missing-code strings are validated/screened too, so they cannot carry a raw capture or credential in place of a code.

Adjacent unit cases are written for full row preservation, omission of the domain's unselected capture, mutation refusal/private-original preservation, old/non-web missing callback, absent denied-key declaration, privacy filtering, truthful empty data, partial semantic findings, malformed/cyclic/non-JSON output and thrown projection. They have not run yet. End-to-end request-copy integration, domain projector, framework outcome preservation, mechanical missing-evidence yes-hold, all three source adapters and compatibility/cache-prefix/size acceptance remain implementation work. No P6 validation or correctness claim yet; no edits to either P2-owned file.

Read-only trace confirmed that existing `summary.withheld` alone does not hold a model yes. The lead approved exact further paths `runtime/result-verification/verdict/{result-verdict.ts,codes.ts}` and adjacent owning tests for one new explicit semantic-projection-gap hold, using existing unsure/repair semantics with no provider call or terminal outcome. This must be a separate tag from privacy withholding. Deliberately omitting a raw capture from a valid complete projection is not a semantic gap and must not hold complete data/proven action answers forever. Acceptance must prove positive complete-data and proven-action results across all three paths as well as a real gap forcing unsure. Unknown domain evidence from old/non-web bindings without a projector is explicitly missing; typed framework outcomes and stored rows still survive unchanged.

## Resume/source ownership finding (additional scope proposal, not implemented)

The lead correctly rejected relying on non-enumerable symbols through cloning or persistence. No symbol integration was written. `answer-first/trail/held.ts` explicitly holds trails in memory only and emits `core.earlier_calls_not_held` after a Core restart. `attempt-store/store.ts` clones saves and parses only known fields; `carry-on/carried-opening.ts` reconstructs the opening from that record. A transient raw-source envelope would therefore fail new-format resume acceptance.

Proposed durable representation: optional private `judgeEvidence: { version: 1, trail: <ordered screened semantic entries>, ...semantic witness/read findings... }` on the existing attempt record, separate from the unchanged in-memory raw trail and existing row store. Each entry retains its actual source/call/step identity, framework status/failure/effect facts, projector role/finding and explicit missing codes. Only validated, privacy-screened projector output is checkpointed, never the original raw capture or a function. Projection happens once at the actual call/Flow/build adapter before legacy bookkeeping stripping; checkpoint/reopen reads the versioned finding and never projects an already projected finding again. Full answer rows/accounts continue through their current P1/P2 owners. A failed checkpoint must report an explicit recoverable evidence/storage issue, never turn an applied act into a retryable unperformed act.

Exact additional Core paths needed for this proposal (all relative to `packages/fluxiq/src/`), not edited pending lead approval:

- `framework/automation-service/service/answer-first/attempt/call-chain.ts` and adjacent owning tests: project actual answered execution once and await ordered semantic checkpoint after the actual call, while retaining private raw trail and action evidence.
- `framework/automation-service/service/answer-first/{trail/held.ts,trail/tests/held.test.ts}`: maintain the separate versioned semantic trail and restore it from the checkpoint without a restart-only gap for new-format records; old records remain honestly unavailable.
- `framework/automation-service/service/answer-first/attempt-store/{record.ts,store.ts}` plus a cohesive adjacent checkpoint/reopen test: optional validated private metadata, strict old-record compatibility and malformed-new-field refusal.
- `framework/automation-service/service/answer-first/attempt/{keep.ts,ending.ts}` and adjacent tests: persist the same semantic checkpoint at current saves/endings, no lifecycle/readiness changes.
- `framework/automation-service/service/answer-first/carry-on/carried-opening.ts` and owning tests: carry forward the exact validated checkpoint.
- `framework/automation-service/service/answer-first/flow-run/{flow-run.ts,ports.ts}` and `attempt/flow-stage.ts` plus adjacent tests: pass the existing bound projector/denied-key declaration to the actual trace adapter before screening and checkpoint the ordered findings. The exact owning ports filename will be confirmed before any edit.
- The already held P2-owned `attempt/run-attempt.ts` needs the eventual serialized checkpoint restore/save and callback forwarding hunk, in addition to its approved judge forwarding. It remains untouched. No shared lifecycle owner will be edited before P2 handoff.

The lead approved the durable approach in principle and only these additional disjoint owners for immediate editing: `attempt/call-chain.ts`, `trail/held.ts`, `attempt/flow-stage.ts`, `flow-run/{flow-run,ports}.ts` plus adjacent tests. Attempt store/parser/save/ending/carry-on and `run-attempt.ts` are P2-owned and remain untouched. Their exact integration hunks are to be handed off after source sync. Full row cells should reuse exact existing store/page sources rather than be duplicated into the semantic checkpoint; final privacy screening applies current denied-key/credential declarations again, while current validated schema/exclusion policy governs the reused rows. Build observations without datasets retain their actual report records through the existing page-evidence path.

Independent Core checkpoint now adds `AutomationStudioResultTrailStep.judgeEvidence` as an optional JSON `version: 1` finding, plus separate `framework` facts. The three actual adapters can project their immutable raw envelopes before legacy screening when given explicit semantic options. `run-trail/semantic/{options,step,trail,index}.ts` owns those options and the final copy; `framework-outcome.ts` retains actual status/route/applied/skipped and the existing validated failure-control record. Domain projection cannot overwrite those fields. The legacy adapters' default shape remains unchanged until their owning composition opts in. The regular trail builder carries the semantic metadata value separately without stripping semantic UUID/time/number cells; final semantic copy rescreens it and drops raw findings/asked payloads. No symbol or ephemeral-only source is used.

Written, unrun regressions in `judge-evidence/tests/finding.test.ts` cover spread/structuredClone/JSON roundtrip, no second domain projection, current privacy rescreening, explicit gap retention and malformed-version refusal. `run-trail/tests/semantic-sources.test.ts` composes each real call/Flow/build adapter through the regular builder and final semantic copy, with 1,201 exact original rows/UUID/time/array values, complete data/proven-action yes cases, historical uncertainty preserved as a fact, and a throwing projector forcing unsure while framework failure/effect and full rows survive. Large synthetic raw-capture sentinels must not appear. This is a helper/adapter checkpoint only; production request integration and actual store reopen/carry-on acceptance remain pending P2 handoff. `git diff --check` passed before the final fixture annotation/report update. No P6 heavy validation ran because the shared gate is held by the lead.

## Proposed acceptance

Provider-free fixtures must cover all three trail sources and all alternate state fields, with a large synthetic raw capture beside real allowed rows/action evidence. Compare every final row/value and processing/comparison/removal account exactly before/after. Assert no capture sentinel reaches the serialized request, each ordered action's failure/effect uncertainty and missing markers survive, declared exclusions still hold, and the original strict oracle remains. Include absent/invalid/throwing projector, legacy summary compatibility, applied action plus invalid projection, build-read full values without a persisted dataset, and stable prefix/field-order tests. Measure complete request UTF-8 bytes before/after, with no raw payload in reports. Run owning tests, affected types and audits only through the shared heavy gate with one Vitest worker.

P2's processed answer/readiness/reference-time contract must be synced before final combined acceptance. P6 will reuse it and will not evaluate rows again. No live browser/paid acceptance or whole historical replay is claimed by these unit checks.
