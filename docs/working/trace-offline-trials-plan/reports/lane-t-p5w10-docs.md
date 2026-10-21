# Report: lane-t-p5w10-docs (t749, trace plan P5, brief W10)

## Outcome
Done (2026-10-20). Architecture docs for P5 written in both repositories; all named checks pass.

## What changed and why

### 2026-10-20 - all five files
- Core `docs/architecture/automation-studio/client-gateway.md`: new section "Gateway traces and offline trials"
  (about 80 lines, a little over the brief's 70): what a trace holds (pointer to `persistence.md`, "Keyed content
  addresses"), tier 1 strict matching (`ClientGatewayTraceMatcher`), tier 2 reevaluation port (asked only for
  `argument_mismatch` with a single readable recorded result; request contents and the cut at the next recorded
  operation; `answered`/`gap`/`declined`; a throw or bad answer is `incomplete_capture`, cause `reevaluation`), the gap
  vocabulary and origin `snapshot_evaluation`, `satisfiesAutomationStudioWholeRunGate` (offline pass never counts), and
  the seams `runAutomationStudioOfflineCandidateTrial`, `automationStudioProjectSingleSubflowRebuild`,
  `automationStudioServiceWholeTrialPorts`, `automationStudioGatewayTraceServiceStore`,
  `clientGatewayTraceReevaluationRequest`. Domain-neutral wording. Every name checked against the code
  (`trace-matcher/{matcher,types,gap-reasons,reevaluation-request}.ts`, `runtime/index.ts` lines 45-52,
  `service/offline-trial/{run,contracts,evidence-result}.ts`, `model/offline-trial/whole-run-gate-eligibility.ts`).
- Core `docs/architecture/code-structure.md`: two bullets after `restricted-references`: `package-exports` (D38 scope,
  from the rule's header) and `module-reach` (`reachBoundaries`, binding-by-binding chains, never baselined, the
  "trace-free model guidance" boundary in both configs).
- Downstream `docs/architecture/web-capabilities.md`: the builder of the gateway result now names
  `domain/src/client/browser-result-mapping.ts`; step 2 of the action path names `executeActionMessage`
  (`domain/src/client/execute-action-message.ts`). The two remaining `runtime/result-mapping.ts` mentions (lines 86,
  522) are for `browserActionFromGatewayCommand` and the rejection result, which still live there; left as they are.
- Downstream `docs/architecture/extension-client.md`: the `executeAction` paragraph now says the message is built by the
  domain's `executeActionMessage`. The doc did not document the trace page capture at all, so a short parent section
  "Trace page capture" (from `shared/trace-page-capture.ts`, `background/trace-capture/`, `content/trace-capture/`)
  was added before "Recording-capture policy", with the subsection "Offline reads over a captured page (tier 2)":
  eligibility, snapshot, D37 control, the three gaps, the `WebSnapshotPage` port, `openWebSnapshotPage` /
  `loadExtensionContentCode`, the headed spec path, and P6 owning production hosting.
- Downstream `docs/architecture/testing-facility.md`: the doc did not list the experiment; added a short section
  "Offline trials over recorded traces" after "Replaying a saved Flow" covering `survey`, `trial`, `trial --tier2` and
  `reads` (provider-free, fresh copies under `test-runs/`, headed, needs the extension build).

## Commands run and observed results
- Core `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).` and
  `Deterministic framework reference is current.`
- Core `node scripts/structure-audit.mjs --rule docs-links` -> `structure-audit: passed (0 warning(s), 0 baselined).`
- Downstream `node scripts/structure-audit.mjs` -> first run `FAIL [docs-links] docs/architecture/extension-client.md:2695:
  ... points outside the repository` (a link into Core's docs); replaced it with a plain path; rerun ->
  `structure-audit: passed (218 warning(s), 651 baselined).`
- `grep -rn "result-mapping" docs/architecture/` (downstream) -> only `browser-result-mapping.ts` as the builder, plus
  web-capabilities 86 and 522 and failure-taxonomy 229, all naming functions still in `runtime/result-mapping.ts`
  (`browserActionFromGatewayCommand`, `gatewayActionResultFromRejection`).

## Not verified
- The anchor `extension-client.md#offline-reads-over-a-captured-page-tier-2` passed docs-links; not checked in a
  rendered view.
- The trace page capture description is from the module header comments, not from running a capture.

## Open questions or contradictions found
- Cross-repository links from downstream docs into Core fail docs-links ("points outside the repository"); Core is
  named by path instead.
- `docs/architecture/failure-taxonomy.md:229` (not owned) is still correct: refusals are built by
  `gatewayActionResultFromRejection` in `runtime/result-mapping.ts`.

UNIT READY: Core docs/architecture/automation-studio/client-gateway.md, Core docs/architecture/code-structure.md,
downstream docs/architecture/{web-capabilities,extension-client,testing-facility}.md
