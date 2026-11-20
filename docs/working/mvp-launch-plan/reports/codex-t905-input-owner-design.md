# t905 effective-input revision owner design

Read-only design; no interface or implementation is approved by this report. Core/downstream source and dist remain frozen for the lead's integration gates. No tests, browser, git or source writes were performed.

## Proposed first implementation brief (30 lines)

1. Role: heavy worker, gpt-6.1-sol, Max; implement only a durable NONSECRET input-binding owner, without execution/admission integration.
2. Root C is paired Core `packages/fluxiq/src`; E is the paired extension report directory.
3. Own new `C/runtime/input-basis/{reference,owner,index}.ts` and `tests/owner.test.ts`.
4. Own new `C/framework/automation-service/service/input-basis/{store,index}.ts` and `tests/store.test.ts`; own report only under E.
5. Must not touch engine, run-secrets, FluxNode authoring, task-memory, replay/judge, witness, downstream source, generated output or other lanes.
6. Existing storage ports: RunDatasets.createImmutableSnapshot/readImmutableSnapshotPage, ProjectPaths.projectFile, ProjectStore.ensureProjectStructure and programJsonDocumentTransaction.
7. Define closed `InputRevision={ownerId,bindingId,revision}`; ownerId/bindingId are durable opaque issued IDs, revision is a positive monotonic integer.
8. Scope binding slots by trusted service project/task/principal and logical producer identity; no value-derived key, request-nominated principal or random run ID as the persistent slot.
9. Expose `observe(scope, normalValues, producerRefs)`, `reopen(scope, ref)` and `verifyCurrent(scope, ref)` through internal typed owner ports.
10. Return a runtime-only normal-input lease with reference, private execution-copy accessor and current-check; outcomes/logs receive reference or closed unknown only.
11. This lease proves stored normal bindings, NOT that the engine actually used them; that needs the separately briefed execution integration below.
12. Constructor ports include trusted secrecy inspection; absent inspection, active/unverified secret context or unresolved secret-bearing origin returns unknown before any snapshot write.
13. Do not copy secret-bearing private dataset rows into new input snapshots; their future authenticated opaque-origin integration is outside this unit.
14. Do not classify a redacted/withheld dictionary as nonsecret original data or compare such dictionaries to establish equality.
15. Snapshot only the exact unredacted nonsecret JSON plus ordered producer-reference roles; preserve absent/null/false/zero, array order and every actual field.
16. Reject malformed/unsupported captures; no field dropping, handle projection, string coercion, default substitution or arbitrary equivalence in the owner.
17. Compare against the current private immutable snapshot structurally; identical values AND producer references reuse the current revision.
18. Changed values, inherited/default/caller producer revision or binding definition issue a new immutable snapshot and increment the same logical binding's revision.
19. Keep snapshot writes outside document transactions that may hold the same project DB connection; publish a reference only after an authoritative compare-and-swap of the owner head.
20. On a CAS race, reread authoritative head and retry comparison; never overwrite another writer or return an unpublished reference.
21. Snapshot success followed by head-write failure publishes no receipt; an orphan snapshot is not authority and no old receipt is returned as current.
22. Distinguish missing initial state from corrupt/unreadable state; propagate original storage failures at the owner and never silently create a replacement owner/head.
23. Reopen requires exact owner/scope/id/revision plus readable immutable snapshot/count; stale, foreign, missing or memory-only authority is unknown.
24. New owner instances on the same durable root retain identity; process-local maps, ALS identities and legacy redacted records cannot restore durable proof.
25. Execute from the lease's private copied snapshot in future integration, so later mutation of caller objects cannot change what was sealed.
26. Tests: same/private values reuse; scalar/key/array/type changes revise; producer revision change revises even if effective text matches; A→B→A advances.
27. Tests: cross-project/principal/slot/owner rejection; fresh instance/restart; stale/corrupt/missing snapshot; memory-only; reference/capture mutation isolation.
28. Tests: concurrent writer CAS, snapshot failure and head-commit failure preserve the prior current head; original SQL/storage error identity survives.
29. Tests: unavailable/active/raw/unverified secret inspection and secret-bearing origins create no snapshot/receipt; equal withheld markers grant nothing.
30. After explicit source release, run only owner/store tests, Core typecheck and unchanged structure audit via coordinator; no full suite/browser/admission or witness work.

## Interface and ownership rationale

Persisted cross-attempt identity requires durable owner IDs and revisions. A process-local reference can identify one live object/context, but cannot authenticate that the same binding survived restart or that a newly supplied secret is unchanged. A normal owner record should keep the trusted scope, its current revision, immutable snapshot reference, and producer references. The public reference contains no input values or new digest. The owner compares complete private normal values; consumers validate references through the owner rather than trusting their spelling.

The proposed interface separates storage identity from execution evidence:

```ts
type InputRevision = Readonly<{ ownerId: string; bindingId: string; revision: number }>;
type ProducerRevision = Readonly<{ role: "inherited" | "defaults" | "caller" | "binding"; reference: InputRevision }>;
type InputRead<T> = { status: "bound"; value: T } | { status: "unknown"; code: InputUnknownCode };
interface NormalInputLease {
  readonly reference: InputRevision;
  executionCopy(): JsonObject; // runtime only, exact private nonsecret snapshot
  verifyCurrent(): Promise<InputRead<true>>;
  close(): void; // releases live copies; never erases durable historical identity
}
interface NormalInputOwner {
  observe(scope: TrustedInputScope, values: JsonObject, producers: readonly ProducerRevision[]): Promise<InputRead<NormalInputLease>>;
  reopen(scope: TrustedInputScope, reference: InputRevision): Promise<InputRead<NormalInputLease>>;
  verifyCurrent(scope: TrustedInputScope, reference: InputRevision): Promise<InputRead<true>>;
}
```

`TrustedInputScope`, secrecy inspection and producer adapters are internal owner dependencies, not fields accepted from request JSON. Each actual inherited/default/caller layer can receive its own normal binding revision through `observe`; the final effective frame records that ordered dependency vector. A producer definition revision must come from its owner: for example, the existing current execution/settings binding and immutable published contract identify the Flow defaults, while caller/parent layers are captured by their actual service/execution owners. Those existing receipts are reused privately; no new hash of values is manufactured. An unchanged redacted string, task key, act scope, pointer name or input shape supplies no revision authority.

`AutomationStudioRunDatasets` already issues immutable private snapshot IDs and reads their occurrence rows. `ProgramJsonLockedDocument.read/write` supplies the authoritative owner-head transaction. These are sufficient to implement the normal owner; they do not already expose an effective-input revision API. Use an optimistic two-phase operation: capture immutable normal values, write any new snapshot, then CAS the exact previously read head in a short document transaction. If the head changed, load/compare against the new head before publishing. Do not nest a second snapshot DB write inside the head transaction or assume two independent commits are one transaction.

The normal snapshot belongs to the project input-binding owner, independently of a run's disposable trace. It must not be reconstructed from kept redacted options if its snapshot is gone. Initial state can be created only on an authoritative missing read. Corruption, deletion, lost owner identity, unavailable storage or failed writes cannot produce a replacement receipt that validates the old proof. Restart tests must instantiate a new owner/store and read disk rather than reuse a WeakMap/cache.

## Actual execution capture points: separately brief the next unit

The earlier 32-line proposal's frame point was too early. `graph-run.ts#runGraphFromSeed` creates/installs an invocation frame before `runGraphToTrace` merges ambient run secrets into `options.inputs` (secret map first, explicit options win). `child-frame.ts#inputsOf` additionally strips minted/handle/evidence fields from item rows for act identity. Neither `InvocationFrame.inputs`, trace/shared inputs, a repeat sample's projection nor a redacted caller record is the full input the executor uses.

The later wiring unit should own these disjoint paths and adjacent tests, after the owner interface is independently accepted:

- `engine/automation/contracts/graph-execution-options.ts`, `graph-run.ts`, and `frames/invocation-frame.ts`: carry an optional owner port/reference; seal the actual effective normal input frame at graph entry around the real secret overlay. Preserve existing execution when proof is unknown.
- `engine/automation/composite/boundary.ts` and its new adjacent `tests/boundary.test.ts`: observe child declared defaults followed by explicit input bindings before `request.frame(childInputs)` projects them. Parent ambient normal inputs do not cross this typed boundary; inherited options and the secret context still matter. Parent/child lineage references must be explicit.
- `engine/automation/node-execution/attempt.ts`, `parameter-refresh/inputs.ts`, and adjacent tests: inspect the actual resolver result after variable/value/input precedence and target refresh, and the full native Flow-plus-wired input dictionary before declared-port/repeat/trace projection. A node-use lease is additional evidence, not a replacement for the frame reference.
- `answer-first/flow-run/{ports,flow-run,outcome}.ts` and `attempt/{contracts,flow-stage}.ts` with existing tests: supply the trusted normal owner, observe the real inherited engine options plus caller override, and carry only reference/unknown metadata. Do not persist/admit a whole-run proof in this unit.

Frame identity covers the actual layer values and definitions, not just the keys or values the next node happens to read. Node resolution uses `{options.inputs, variables, values, nodeInputs}` in that precedence order; native dispatch separately overlays wired inputs on Flow inputs. Source-bound parameters and fallback definitions are already executable identity, while the values they resolve at use time need an actual node-use record. Distinct child occurrences must not be conflated because their values or positions match: use verified owner occurrence identity, or keep their context identity ephemeral/unknown across attempts.

Execution integration must run from the owned normal copy, keep secrets out of persistent input snapshots, and verify all issued producer/frame references before publishing a proof at the end. Input changes advance revisions, including a change back to an older value. A caller mutating its original object after capture cannot mutate the owned execution copy. Missing coverage, unknown child frames, unresolved bindings, foreign receipts and a producer that changes during the run invalidate input proof; they do not add a task ending or switch off judging.

Acceptance additions for this wiring: inherited-only input; explicit caller override; child default and child binding precedence; absent vs explicit null/zero; ambient secret shadowing; a handle/evidence field changed before child projection; wired value/variable/fallback changes; target-refresh result changes; mutation before/during execution; undisclosed/unsealed child occurrence; and ordinary execution continuing with closed unknown when the owner is unavailable. These are proposed regressions, not tests run in this design task.

## Secret lifecycle: known boundary, not first-unit integration

Current `runtime/run-secrets/{store,run-with,read}.ts` holds frozen flat raw values in ALS for an async scope. Inner nonempty names override outer names; empty texts are dropped. `PipelineSecrets` keeps a per-pipeline set only for that run, and `pipeline.secretN` is a withholding key. None is a durable secret revision issuer. The first normal-owner unit therefore returns explicit unknown for active/unverified secret contexts, never a persisted secret verifier, copied secret-bearing row or equality claim based on withheld output.

An immutable **private dataset occurrence/field** can authenticate an existing secret origin: its dataset owner can authoritatively resolve the immutable snapshot/occurrence/field in the correct project and supply the actual value directly to ALS. A future protected binding owner may privately associate that pointer with an opaque binding ID/revision; changing its origin revises the binding. This reuses the existing private owner and requires no new copy of the secret into an input snapshot. An input/caller pointer alone is mutable: the caller may supply a new credential at the same pointer, so that pointer cannot prove the secret stayed equal.

Raw caller secrets may have context-lifetime identity while their existing ALS scope is alive; that expires with the context and does not establish persisted cross-attempt equality. Durable comparison requires an authenticated secret-owner receipt whose owner resolves the value and verifies current revision/revocation. No such generic receipt API was established by this reading. A future secret-specific unit must design it explicitly, preserve inner/outer merge semantics and close/release lifetimes, and remain unknown for raw/unverified suppliers. It must never keep a plaintext/hash verifier or infer equality from the same name/redaction marker.

## Return contract

Outcome: Done (read-only owner design; unapproved implementation brief).
Changed: docs/working/mvp-launch-plan/reports/codex-t905-input-owner-design.md only.
Validation: Source/API inspection only; tests/typecheck/audit/browser/git not run, as instructed. The lead owns active integration gates.
Not verified: Implementation, persisted input receipts, execution wiring, secret owner integration, witness behavior or replay admission.
Report: docs/working/mvp-launch-plan/reports/codex-t905-input-owner-design.md
Notes: First unit is nonsecret owner/storage only. Later execution/secret units are separate. Source/dist freeze remains in force.
