# t187 -- Downstream architecture documentation

Status: Complete
Repository scope: `F:\!FluxIQWebExtension`
Date: 2026-09-26

## Result

Updated the four assigned current-state architecture documents from the t182
documentation-impact audit. No source, Core file, shared working document,
generated output, or other architecture document was changed.

## Files and reconciled contracts

- `docs/architecture/web-capabilities.md`
  - documents the content-action recovery loop, exact backoffs, five-second
    ceiling, deadline recheck, and side-effect-aware retry eligibility;
  - removes the stale claim that acting verbs never retry;
  - records tolerant optional extraction-request parsing, the structured
    summary versus bounded prose boundary, partial/wide results, and
    checkpointed cross-document pagination with de-duplication.
- `docs/architecture/failure-taxonomy.md`
  - changes the closed set from 15 to 18 codes and adds the exact definitions
    for `BLOCKED_BY_DIALOG`, `BROWSER_PERMISSION_DENIED`, and
    `TRANSPORT_TRANSIENT`;
  - explains their semantic distinctions and that a retryable classification
    is still subject to browser/Core side-effect safety.
- `docs/architecture/testing-facility.md`
  - defines the instruction-created Flow lane and its partial-progress
    snapshot;
  - documents `authoredNodes` and the Core screen plus local validator,
    including a retained safe URL origin beside `parametersWithheld: ["url"]`;
  - enumerates `itemsSeen`, `emptyRecords`, and `listWait`, while keeping item
    and page fault details out of `RunExtractionRead`.
- `docs/architecture/sensitive-values.md`
  - documents screened authored parameters in judge/repair context and
    created-Flow artifacts;
  - distinguishes absence, safe transformation, and budget omission, and
    states that persisted repair records retain bounded Core findings/fix data
    rather than arbitrary model prose.

## Validation

- `git diff --check --` on all four owned architecture documents: passed.
- Targeted searches confirmed the stale `fifteen codes`, `no acting verb waits
  first`, and `Every other late target` statements are absent.
- Targeted searches confirmed all three new failure codes, the recovery and
  partial extraction sections, the created-Flow artifact, authored-node
  screening, and explicit no-live-success wording are present.
- Reviewed the resulting diff against the integrated failure definitions,
  extraction summary, authored-node contract/validator, and created-Flow
  snapshot source.

Documentation-only task: no test, build, Lab, live provider/browser run,
commit, or push was performed. The current provider-backed hard scenario is
not claimed to have passed live.
