# Codex architecture docs round 3 (t221)

Outcome: Partial against full gates; documentation complete, Core full audit has an inherited unchanged-source violation. Paired t221 trees only; architecture docs only.

## Findings and decisions

Read required task/current-state/shared rules, named reports t196/t200/t208/t211/t214/t205/t212 and t191. Reports contain superseded rounds; current source is authoritative.

- Downstream `page-evidence.md` has an up-to-date t200 appendix but still describes capture/merge caps and repeat ranking in its main sections.
- `extension-client.md` still describes capped/ranked capture and incorrectly blanks unresolved waits after work ends.
- `sensitive-values.md` still claims descriptor admission is based on readable text; current capture keeps rendered elements, while sensitive text remains screened.
- `testing-facility.md` still describes v1/40-element/12KB evidence at the early architecture section, while its later byte-budget and spend sections are updated.
- Core flow-bootstrap docs correctly describe authored steps and unreadable replies, but retain the old three-unusable-reply bare ending; update to build phases and clarify checklist choices/progress paths.
- Core client-gateway docs still say Simple Mode and need current per-step/action-card/resolved-ask design.
- Capture source, merged snapshots, rendered-elements, sanitizer/layers and build lifecycle are being checked read-only before wording changes.

## Validation

Not run yet; notify supervisor before final audits so shared temporary brief can be removed.

## Not verified

No live/browser/Lab/provider calls permitted.

## Implemented

Downstream architecture:

- `page-evidence.md`: uncapped frame merge/capture, retained legacy capture flags vs separate stored-state caps, repeat annotations without ranking, clarified obsolete domain byte-budget refusal vs Core build budget ending, and complete evidence/request window.
- `extension-client.md`: full rendered composed-tree capture vs bounded stored recording state; explicit wait resolution vocabulary and unresolved waiting state.
- `sensitive-values.md`: sensitive contents screening without text-based snapshot admission/ranking; Core model parameter screen separated from t212's stricter downstream artifact screen.
- `testing-facility.md`: retired inspect/navigate/press-only build catalog replaced with registered node library and detection; v2 whole-page evidence, covering-layer fields, secret screens, three phases, task permission-point coverage/person answering, per-build cost wording.
- `web-capabilities.md`: file-input descriptor is listed, not ranked.

Core architecture:

- `automation-studio/llm-flow-bootstrap.md`: superseded bare unusable-decision ending removed, explicit three-phase lifecycle, checklist choices, current progress module path, repair/live-round bounds and shared spend, three named endings with message starts, t214 complete successful/unfinished traces with honest baseline ended limitation.
- `automation-studio/client-gateway.md`: automation controls replace Simple Mode labels; each model reason/action as a message, shared fluxiq/ui cards and icons, six explicit ask resolutions, same-ref in-place settlement, no inferred success from later work.

Current t221 source still carries Simple-named relay symbols and final-round-only ended trace/parked-expiry gaps. These are pending Task3/5/4 changes on other isolated branches, not baseline behavior; this docs branch does not claim those fixes are already merged. Historical descriptions explicitly labelled as removed remain as context. Recording-state selection, runtime target matching and Lab artifact bounds remain distinct from the uncapped model packet.

## Code checked read-only

Downstream capture/rendered-elements/describe-element, frame merge, sensitivity/model elements/layers, stored-state projection selection, runtime tool vocabulary and runsNodes, authored-node artifact screen, scenario permission coverage and permission/person-answer policy. Core build phases/judgement/endings, completion-attempt gate, authored-progress, activity observer, shared action classifier and resolution contract. No source files changed.

## Validation in progress

Full audits queued via heavy.sh (`codex t221 downstream structure`, unified session84699; `codex t221 core structure`, unified session1480). Both repository `git diff --check` commands passed (downstream emitted only testing-facility CRLF normalization warning).

## Audit iteration

- Downstream full audit command: `& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex t221 downstream structure' node scripts/structure-audit.mjs` from t221 downstream -> exit1, one new `docs-links` failure: testing-facility.md linked `../../../!FluxIQ/docs/architecture/automation-studio/llm-flow-bootstrap.md`, which the auditor refuses as outside the repository. Replaced the link with a plain named Core doc path; rerun queued as `codex t221 downstream structure corrected` (session93287).
- Core full audit remains active session1480. Core docs-links-only audit queued with exact rule id `docs-links`; no baseline/source correction attempted.

Core full audit observed:

- From `C:/Users/osrs_/FluxStuff/fxwork/t221/!FluxIQ`: `& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex t221 core structure' node scripts/structure-audit.mjs` -> exit1, only this inherited source failure:

```text
FAIL [file-lines] packages/fluxiq/src/programs/automation-studio/runtime/service.ts: 4506 lines exceeds the 800-line limit. Split it by diagnosing why it grew. Baseline for this entry is 4505; baselined entries may shrink, never grow.
structure-audit: 1 violation(s) across 1 rule(s).
```

- `git diff --exit-code HEAD -- packages/fluxiq/src/programs/automation-studio/runtime/service.ts` -> exit0, no output: failing source is unchanged in this docs-only task.
- No source or baseline edits made to clear this inherited failure. Task4/5 supervisor changes shrink the touched service separately; Claude integration owns the combined full gate.

## Final result and validation

Documentation is complete for the Task1 scope. Outcome remains Partial against the requested full gate because Core's unchanged source exceeds its inherited service line baseline. All documentation links and downstream structure pass.

Observed commands:

- From t221 downstream: `& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex t221 downstream structure corrected' node scripts/structure-audit.mjs` -> exit0, `structure-audit: passed (135 warning(s), 119 baselined).`
- From t221 Core: `& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex t221 core docs-links' node scripts/structure-audit.mjs --rule docs-links` -> exit0, `structure-audit: passed (0 warning(s), 0 baselined).`
- Core full audit -> exit1, exactly inherited service.ts4506 vs baseline4505, documented above; no documentation violation.
- Both `git diff --check` -> exit0; downstream only CRLF normalization warning for testing-facility.md.
- Shared temporary taskdoc brief was restored by supervisor before audits. Worker edits remain architecture docs plus this unique report only.

No pending worker sessions remain. No source/baseline/generated material, shared working doc, historical report, unrelated tree, commit, merge or push changed. No live/browser/Lab/provider calls.

## Integration notes

- Task3's branch updates extension relay symbol/path documentation independently; this baseline still describes its current Simple-named symbols without presenting them as modes. Merge its doc changes when integrating that task.
- After Task4/5 integration, remove/update the brief baseline limitation sentences in Core client-gateway.md (parked expiry/removal) and llm-flow-bootstrap.md (ended trace), since those isolated fixes were not present in t221's source snapshot.
- Supervisor/Claude owns independent review and integration; do not resolve the inherited source audit failure in this docs-only worker task.

## Supervisor verification

Supervisor reviewed all seven architecture diffs, including stored recording-state bounds versus uncapped model input, sensitive controls, phase endings, shared action cards/resolutions and permission points. Independently ran heavy label `codex t221 supervisor docs links`: `node scripts/structure-audit.mjs --rule docs-links` in downstream, then Core -> both passed (0 warnings, 0 baselined), complete chain exit0. Independently confirmed Core failing service.ts is unchanged (`git diff --exit-code HEAD -- .../runtime/service.ts` -> exit0) and both diff checks pass. No source/baseline change authorized by this docs-only scope. Final full Core gate remains the inherited one-line violation; Task4/5 resolve it during Claude integration. Local branch delivery only.
