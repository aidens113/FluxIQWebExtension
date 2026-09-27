# t194 final architecture-document consistency review

Status: Complete

## Verdict

No release-blocking contradiction was found in the permission contract, provider/recovery contract, or live-validation status. The three Core documents consistently retain exactly `move_money`, `delete`, and `send_or_publish` as high-risk; `modify_existing` and `create_new` remain ungated merely by class. None of the seven edited documents claims that the pending provider-backed hard scenario passed live.

Two downstream documentation precision issues remain. The first is a concrete overstatement of the current recovery-account carrier; the second attributes a cross-layer replay decision entirely to the content runtime. Neither changes product behavior, but both should be corrected before calling the architecture text exact.

## Findings

### P1 — recovery-account prose is unconditional where the carrier is conditional

- Document: `docs/architecture/web-capabilities.md`, **Default browser recovery**, line 116.
- Current statement: recovery details are appended to the result's bounded validation or failure description.
- Source contradiction: `apps/extension/src/content/action-runtime/recovery/record.ts:48-59` appends only when the final validation has a status other than `none`, or when a recognized failure exists. Successful evidence-only actions such as `web.dom.extract` and `web.dom.capture_snapshot` return `validation.status: "none"` (`content/actions/extract.ts:35`, `capture-snapshot.ts:22`) and no failure. If one of those actions absorbs a transient fault and then succeeds, the computed recovery account has no carrier and is omitted.
- Smallest correction: qualify the architecture statement to say that the account is appended when the final result has a writable validation/failure description, and explicitly note the successful evidence-only gap. Alternatively, implement the already-described structured recovery field before retaining the unconditional wording.

### P2 — transport replay safety is owned by Core, not the content runtime

- Document: `docs/architecture/failure-taxonomy.md`, **The Closed Set**, lines 59-64.
- Current statement: “The content runtime” applies side-effect safety, followed by `TRANSPORT_TRANSIENT` as the example.
- Source mismatch: `TRANSPORT_TRANSIENT` is classified in the background worker (`apps/extension/src/runtime/action-runner.ts:114` through `domain/src/runtime/failure/browser-api.ts:86-90`). The content recovery mapping explicitly says that this code is reported by the background worker and is not seen by the content loop in practice (`content/action-runtime/recovery/fault.ts:96-100`). Its ambiguous/mutating replay protection is applied by Core's defensive assessment (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\executor\defensive\assess.ts:77`).
- Smallest correction: replace “The content runtime” with “The browser and Core runtimes,” then distinguish the content loop's pre-dispatch target rule from Core's transport-failure side-effect check.

## Confirmed consistency

- Core's classifier source marks only `move_money`, `delete`, and `send_or_publish` true, and the same exact set appears in `automation-studio.md`, `automation-studio/llm-flow-bootstrap.md`, and `package-boundaries.md`.
- The downstream documents continue to treat all five consequence declarations as visible to Core without asserting that all five prompt.
- Provider retry, grant-purpose semantics, screened verification/repair data, defensive execution, the 18-code failure table, extraction behavior, and created-Flow authored-node screening agree with the cited integrated source seams and with the t182/t187/t188/t189/t193 reports.
- New live-sensitive text is either explicitly negative (`no live-provider success`, hard scenario not passed live) or describes code/package validation rather than a live provider/browser success.

## Validation and boundaries

Reviewed only the seven edited architecture-document diffs and their cited source seams across both repositories. Per brief, I changed only this report and did not edit architecture/source/shared working documents, run builds or tests, start the Lab, use a provider or browser, commit, or push.
