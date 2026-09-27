# t414 — t170 commit producer-attribution map

## Result

This is a read-only provenance aid for the senior supervisor. It does not change t399's allowed
candidate manifests or t408's staging/finish sequence. At observation time Core has 222 status
entries (92 untracked and the same two-entry inherited partial index); downstream has 382 status
entries (306 untracked and an empty index). I did not inspect ignored/runtime contents, stage,
commit, test, build, invoke a provider, or run browser/Lab/live work.

The labels below are the producing task/report slugs supported by authored reports. Use them as
`Worker:` trailers only when the final staged patch still contains that task's authored bytes.
Where a report records review or validation only, it is deliberately excluded. T181 is the one
report that states a different actual resumed worker label; use its explicit label rather than its
report filename. Supervisor-authored integration/reconciliation has no invented worker trailer.

## Core commit groups

### C1 — Flow authoring, names, and draft representation

Paths: `nodes/name-match/**`, `runtime/flow-bootstrap/plan/**` except `plan/risk.ts`, and
`runtime/flow-draft/**`. Suggested producer trailers, after staged-patch confirmation:

```text
Worker: t126-name-match-core
Worker: t137-lost-draft-steps
Worker: t141-extraction-vocabulary-reaches-the-repair
Worker: t156-a-short-name-resolves-against-a-long-one
Worker: t157-a-shrinking-draft-is-still-a-draft
Worker: t170-core-integration
Worker: t377-packing-implementation-review
```

T377 owns the final `flow-draft/entry.ts` and `entry.test.ts` correction even though its title says
review; its report expressly says it edited those files. T372 designed the packing change and t381
independently reviewed it, but neither authored final source bytes, so neither receives a trailer.

### C2 — Bootstrap diagnostics, provider/evidence loop, and progress

Paths: the atomic generation-failure delete/rename/replacement, provider-refusal, DeepSeek,
evidence-loop, provider-retry, harness/harness-options, direct LLM support files/tests, and the
flow-bootstrap evidence-step projection. Supported producing labels are:

```text
Worker: t138-provider-failure-sidecar
Worker: t140-amendment-refusal-reaches-the-model
Worker: t144-a-build-failure-that-parses
Worker: t145-a-provider-refusal-that-names-itself
Worker: t146-the-refusals-reach-the-record
Worker: t152-a-refusal-that-never-reached-a-provider
Worker: t153-the-waits-account-is-a-field
Worker: t154-two-screens-on-one-request-agree
Worker: t157-a-shrinking-draft-is-still-a-draft
Worker: t168-a-provider-fault-is-retried
Worker: t170-core-integration
Worker: t217-final-unusable-classification
Worker: t239-flow-bootstrap-provenance
Worker: t243-untyped-harness-provenance
Worker: t353-core-repro-fixture
Worker: t354-core-answerability-progress
Worker: t355-core-progress-projection
Worker: t357-core-progress-tests
Worker: t370-core-projection-bound-fix
Worker: t375-draft-measurement-support
Worker: t393-llm-test-structure-fix-plan
```

T393 both proposed and implemented the semantic test move, so it is a producer. T374, t376, t378,
t379 and t396 are review/validation tasks, not authors. The supervisor's final integration of the
accepted answerability snapshot and draft-progress production seam is supervisor-authored and
should not be assigned to t357 merely because t357 found the defect.

### C3 — Defensive execution, risk-only grants, and public API seam

Paths: `_shared/runtime.ts`, Automation Studio `api/**`, `action-permissions/**`, `executor/**`,
bootstrap permission/risk files, LLM execution/grant files/tests, and service-bootstrap tests.
Supported producing labels are:

```text
Worker: t165-every-node-is-defensive-by-default
Worker: t166-grants-gate-only-risk
Worker: t168-a-provider-fault-is-retried
Worker: t169-only-delete-and-money-are-asked-about
Worker: t170-core-integration
Worker: t189-send-publish-gate
Worker: t255-grant-continuation
Worker: t258-grant-continuation-wiring
Worker: t290-permission-test-reconciliation
```

Some files, especially `_shared/runtime.ts`, span C3 and C4 follow-up work. If the supervisor uses
one broad implementation commit as t399 recommends, include the union of applicable C1–C4 labels;
do not split a file solely to manufacture cleaner trailers.

### C4 — Judgement, repair, persistence/replay, and service tests

Paths: `runtime/recovery/**`, `runtime/result-verification/**`, `runtime/service.ts` and
`runtime/service/**`, plus the owned refuted-result, service-adaptation, and service-flow tests.
Supported producing labels are:

```text
Worker: t124-repair-wrong-answer
Worker: t139-version-recorded-with-verdict
Worker: t147-the-comparison-target-reaches-the-repair
Worker: t164-the-judge-says-what-to-fix
Worker: t166-grants-gate-only-risk
Worker: t169-only-delete-and-money-are-asked-about
Worker: t170-core-integration
Worker: t175-rerun-seed-regression
Worker: t176-auto-repair-assertions
Worker: t233-narrow-reauthor-request-boundary
Worker: t243-untyped-harness-provenance
Worker: t246-subflow-repair-replay
Worker: t258-grant-continuation-wiring
Worker: t290-permission-test-reconciliation
Worker: t293-deadline-fixture-determinism-fix
```

The three final test-local 60-second timeout arguments were applied by the supervisor after t395's
diagnosis. T400 only re-reviewed them. Those hunks receive no `Worker:` trailer.

### C5 — Core metadata and documentation

- `.structure-baseline.json`: generated by the supervisor through the owning command after the
  source moves. Commit with its owning implementation group; no worker trailer is justified by
  t406's audit.
- `packages/fluxiq/package.json`: `Worker: t195-core-version-compatibility`.
- Three authored architecture files: `Worker: t188-core-architecture-docs`,
  `Worker: t193-core-doc-send-publish-reconcile`, and
  `Worker: t195-core-version-compatibility` where their staged hunks remain. The final draft-packing
  text was integrated by the supervisor from t380's proposed wording and t383's review, so do not
  credit either task for those supervisor-authored bytes.
- The two byte-identical framework-reference mirrors: exactly
  `Worker: t394-core-docs-reference-regen`. T397 only reviewed them.
- `apps/web/.../run-permission-request.test.tsx`: `Worker: t304-web-permission-test-reconciliation`.

## Downstream commit groups

### D1 — Extension plus domain runtime contract

Commit `apps/extension/**` with `domain/**`. Supported producing labels include:

```text
Worker: t126-domain-node-name-match
Worker: t127-eleven-second-wait
Worker: t128-sixty-second-tail
Worker: t129-list-never-appeared
Worker: t142-extraction-expresses-the-instruction
Worker: t143-why-the-read-returns-nothing
Worker: t148-a-still-page-is-not-an-empty-one
Worker: t149-a-detected-column-resolves-by-nearest-match
Worker: t155-an-assumed-column-says-so
Worker: t156-a-short-name-resolves-against-a-long-one
Worker: t160-a-withheld-path-is-not-a-selector
Worker: t166-grants-gate-only-risk
Worker: t167-web-nodes-survive-the-page
Worker: t171-web-integration
Worker: t177-domain-extraction-regressions
Worker: t189-send-publish-gate
```

T171 expressly owns the final browser recovery deadline recheck in `budget.ts`, `attempt.ts`, and
their test. T172 validated the integrated contract without source edits and gets no trailer.

### D2 — Test contracts and test runner

Commit `packages/test-contracts/**` with `packages/test-runner/**`. Supported producers are:

```text
Worker: t132-publish-extraction-summary
Worker: t150-run-scenario-split
Worker: t158-the-reads-account-reaches-the-bundle
Worker: t181-runner-authored-node-assertions-resume
Worker: t356-downstream-progress-projection
Worker: t367-downstream-sanitizer-fix
```

Use the explicit t181 resumed label above. T172, t184, t192, t281, t284, t289, t310, t312, t385
and t409 validated readiness/build/freshness or identity but did not author this group's source.

### D3 — Downstream architecture

For the four t399 architecture candidates, use:

```text
Worker: t187-downstream-architecture-docs
Worker: t198-doc-precision-fixes
Worker: t356-downstream-progress-projection
Worker: t367-downstream-sanitizer-fix
```

T356/t367 apply only to `testing-facility.md`; t198 applies only to `web-capabilities.md` and
`failure-taxonomy.md`. Review/audit tasks such as t182, t194, t366 and t371 are not producers.

### D4 — Authored working record

The working-document commit is a record of many workers rather than a product-source attribution
boundary. It is reasonable to omit `Worker:` trailers entirely when the supervisor's final
reconciliation/regeneration changes the shared plans and index: every individual report already
identifies its task in its filename/header, while the shared documents are supervisor-owned.
If trailers are desired, use them only for reports a worker actually authored, never for review
tasks as if they authored product code, and never attempt to list hundreds of report ids in one
commit. T414 itself is authored by `t414-commit-provenance-map` and may receive that trailer.

## Review-only/generated/supervisor distinction

- Review/validation only, therefore no source trailer: t173, t174, t179, t182, t186, t191, t194,
  t199–t206, t220–t232 except actual implementers named above, t234–t242 except t239, t241, t244,
  t247–t254 except t255, t256–t257, t259 onward unless specifically named above, and in the final
  packing/closure tranche t358, t360–t369 except t367, t371–t374, t376, t378–t392 except t380's
  wording proposal, t395–t413 except t394's generator output. A review task's GO does not make it an
  author.
- Generated but tracked: Core `.structure-baseline.json` (supervisor-owned generation) and the two
  framework-reference mirrors (t394-owned generation). All build/test/runtime output remains
  excluded by t399.
- Supervisor-only: shared-plan Current State/ledger edits, working-index regeneration, integration
  glue explicitly reported as applied by the supervisor, the three timeout arguments, and any
  final conflict/staging reconciliation. These use `Task: t170` with no invented `Worker:` trailer.

## Recommended practical use

Preserve t399's explicit staging groups. After each staged patch is reviewed, take the union of the
applicable labels above and remove any whose authored hunk is absent or was superseded. Every commit
still carries `Task: t170`; repeated `Worker:` trailers are for actual surviving authored bytes,
not for design, review, validation, or report citations. If exact hunk ancestry is ambiguous in a
heavily shared file, omit the uncertain worker trailer rather than guess; the task/report record
remains the authoritative detailed provenance.
