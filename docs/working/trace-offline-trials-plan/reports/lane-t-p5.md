# Report: lane-t-p5 (t749 offline-reads-tier2)

## Outcome
Done (2026-10-20). Tier 2 works end to end through the one production path. Core's trace matcher offers a changed read
to a reevaluator; the web domain answers it by running the extension's own content code over the recorded page
snapshot in a sandboxed headed Chrome or Edge page (scripts and network off), or answers an explicit gap. P4's
deferred corrected-candidate item is met: round 4's social revision 16 offline gives 0 rows (live 0) and the oracle
says fail (live judged "no"). The experiment's deep loads are replaced by public seams and deleted. Two audit rules
now fail the build on new private-file loads and on any path from model guidance to trace modules. Photo is the one
partial: its round-4 trace holds no changed-read pair whose list appeared, so its changed-read evidence is the headed
live-versus-offline check plus 9/9 recorded reads reproduced from their snapshots (gate table below).

## Plan

Brief `t749-offline-reads-tier2` (plan P5, tier 2): a changed read or target is evaluated against the captured page
snapshot loaded in a sandboxed browser with scripts and network off, running the same extension extraction and target
code; anything dynamic is an evidence gap. Also owned: P4's corrected-candidate gate item (round 4's social revision 16
changes `extractList.where`), and the boundary item (the experiment's deep loads of Core and domain build files replaced
by public seams, plus an audit rule refusing such loads). Gate: on the breadth round's photo, job and social traces a
changed read evaluated offline matches what the live read returned; the social corrected candidate reproduces the
judged result; a dynamic or missing snapshot is an explicit gap, never a pass; an offline pass never satisfies the
whole-run gate; no trace content reaches model guidance.

Trees `fxwork/t749/{!FluxIQ,!FluxIQWebExtension}`, branch `task/t749-offline-reads-tier2`. Not t748's files (domain
plan-resolution, Core site reset, candidate-trial feedback, LLM request size) or t747's (`storage/project/**`).

## Decisions

- D31 Tier 2 is a reevaluation port on Core's trace matcher. On a strict mismatch with the recorded operation at the
  cursor that keeps the action type, an optional reevaluator (the web domain's) may answer the command from the trace's
  recorded page snapshot. Its answer replaces only the payload of the recorded `client.action_result` for that
  operation; the ack, unsolicited inputs and artifacts of the segment are fed as recorded, and the cursor advances (the
  changed read stands in the recorded read's place). `declined` keeps today's gap. Core stays domain-neutral.
- D32 The snapshot is the one recorded with the replaced operation's own result (captured after the recorded read ran:
  the P0 spike's warm-up design, so the page holds what that read loaded and disclosed). The reevaluator can read only
  artifacts recorded up to the end of that operation's segment (no future leakage).
- D33 Vocabulary: matcher and U5 reasons `snapshot_unavailable` and `dynamic_content`; U5 origin
  `snapshot_evaluation`. A reevaluator failure is a gap, never a pass.
- D34 For P5 the sandbox is a Playwright page in the test-runner (Chrome first, Edge by channel when installed), running
  the extension's built content code in an isolated world; where production hosts it is P6's decision.
- D35 Both deep-load files go: `rebuild/core-authoring.ts` (3 Core modules + the domain's `where` reader) and
  `run/core-trial-seams.ts` (5 Core modules + the domain's host entry), which the brief did not name but which loads
  build files the same way.
- D36 Two mechanical rules: a generic package-build-path rule (Core first, mirrored), and trace modules never reachable
  from model-guidance modules (each repository's config).

| Unit | Worker | Owns |
| --- | --- | --- |
| P5a reevaluation port | worker-high | Core `client-gateway/trace-matcher/**`, AS `runtime/service/offline-trial/**`, AS `model/offline-trial/**` |
| P5b public seams (Core) | worker-high | new Core seam files, the build construction sites they come from, AS `runtime/index.ts` |
| P5c web reevaluator | worker-high | domain `runtime/offline-reads/**` (port file by the lead), extension `background/connection/**` if a mapping moves |
| P5d sandbox page + headed check | worker-high | new test-runner `offline-snapshot-page/**`, new e2e `content/tests/offline-reads/**`, extension `background/runtime/**`, `content/**`, `shared/**` if a builder moves |
| P5e audit rules | worker | Core `scripts/structure-audit/**` (+ entry), downstream mirror list and config |
| P5s trace survey | worker | report only; copies under ignored `test-runs/p5/` |

Wave 2 (after wave 1): the experiment switches to the seams and deletes the deep loads; the experiment passes the web
reevaluator to the runner; the changed-read gate tool over the photo, job and social traces; the social corrected
candidate. Lead: shared barrels, Core rebuilds, verification, gate runs.

## Worker briefs
(the dispatch prompts, kept verbatim in the agents' transcripts; summaries in the table above)

## Progress log

### 2026-10-20 - Lead setup
- Read the brief, both plans' P5 sections, lane-t (U3 spike), lane-t-p4 and P4d prep. Both trees clean on dispatch;
  t748 touches no file this lane plans to edit (checked `git status --short` in both t748 trees).
- Builds current before any edit: `node scripts/check/core-build.mjs` -> `core-build: FluxIQ Core's build at
  ...\fxwork\t749\!FluxIQ is current with its source.`; test-runner build -> both build-cache steps `reuse`.
- Lead wrote the domain port shared by P5c and P5d: `domain/src/runtime/offline-reads/{snapshot-page,index}.ts`, export
  line in `domain/src/runtime/index.ts`. Check: domain `npx tsc --noEmit -p tsconfig.json` -> exit 0.

### 2026-10-20 - Wave 1 back (P5a-P5e, P5s); lead verification and one fix
- P5a (Core): the reevaluation port in `client-gateway/trace-matcher/` (new `reevaluation-request.ts`; types
  `ClientGatewayTraceReevaluator`, `...ReevaluationRequest`, `...ReevaluationArtifact`, `...Reevaluation`; matched entries
  carry `answeredFrom` and `fields`; gap cause `reevaluation`); U5 reasons `snapshot_unavailable`, `dynamic_content`,
  origin `snapshot_evaluation`; the runner's `reevaluator?` and `reevaluated` list. Report `lane-t-p5a-reevaluation-port.md`.
- P5b (Core): `automationStudioProjectSingleSubflowRebuild` (the builder's single-subflow test and the rebuild share
  `proposal-assembly.ts`), `automationStudioServiceWholeTrialPorts` (the build's own trial environment and whole ports
  are made by the same functions, `service/trial-ports/`), `automationStudioGatewayTraceServiceStore`. Report
  `lane-t-p5b-core-seams.md`.
- P5c (domain): `createWebOfflineReadReevaluator(page, buildResult)` in `domain/src/runtime/offline-reads/`; read-only
  actions from the domain's safety table; the builder (`gatewayActionResultFromBrowserResult`) lives in
  `apps/extension/src/runtime/result-mapping.ts`, outside P5c's files, so it was injected. Report
  `lane-t-p5c-web-reevaluator.md`.
- P5d (downstream): `openWebSnapshotPage` in `packages/test-runner/src/offline-snapshot-page/`; the background's
  action message moved to `apps/extension/src/shared/execute-action-message.ts` (action runner switched); headed spec
  `e2e/content/tests/offline-reads`: offline B equals live B on job-board 84/84 cells (Chrome and Edge), photo
  566/566, social 906/906; dynamic photo case live 27 rows, offline 4, `scrollsPastEnd` 1. Report
  `lane-t-p5d-snapshot-page.md`.
- P5e (both): rules `package-exports` (generic) and `module-reach` (trace-free model guidance, `reachBoundaries` in each
  config), mirrored (`core-mirror.mjs` -> 69 files match). `package-exports` flags 5 Core and about 97 downstream files
  that predate this task besides the experiment's 2 and P5d's 2 e2e files. Report `lane-t-p5e-audit-rules.md`.
- P5s: round-4 stores copied hash-verified to `test-runs/p5/` (job run-mvgw1854-5d10955b, photo run-mvgw7320-de416190,
  social run-mvgw3ve5-294881b5); changed-read pairs: job 10, photo 0 (only `timeoutMs` differs), social 233. Report
  `lane-t-p5s-trace-survey.md`.
- Lead review: P5a offered a redacted recorded operation to the reevaluator. Fixed: only `argument_mismatch` is offered
  (`matcher.ts`), test `matcher-reevaluation.test.ts` "never asks about a recorded operation whose fields were withheld"
  shown failing first (`expected { status: 'succeeded' } to match { code: 'redacted_input' }`), then
  `vitest run src/client-gateway/trace-matcher` -> `Test Files 6 passed (6)`, `Tests 32 passed (32)`.
- Lead checks: Core `vitest run` over trace-matcher, model/offline-trial, service/offline-trial, service/trial-ports,
  single-subflow, dispatch, gateway-trace, project-build -> `Test Files 87 passed (87)`, `Tests 467 passed (467)`;
  fluxiq `tsc --noEmit -p .` -> 0; Core build `fluxiq:build` -> built; `core-build.mjs` -> current.
- Decisions: D37 dynamic content is judged differentially: the recorded command is replayed over the same snapshot as a
  control; the changed read is answered only when the control reproduces the recorded result and the changed read asked
  the page for no more than the control did (held navigations, scrolls past the end), or the recorded read proves its
  list ended. P5c's "recorded read succeeded" proof alone made every social read a gap (social reads end `failed`,
  output not observed, with their rows). D38 `package-exports` holds out-of-repository packages by any path, and within
  the repository computed addresses beside a package entry and loads of another package's build output; a static import
  of a sibling workspace package's TypeScript source is type-checked and not held (the e2e harnesses share test-runner
  code that way). Findings that predate t749 are adopted into each ratchet baseline and listed as a follow-up.

### 2026-10-20 - Wave 2 (W6, W7, P5e2) and wave 3 (W8); lead decisions
- W6: the experiment uses `automationStudioProjectSingleSubflowRebuild`, `automationStudioServiceWholeTrialPorts`,
  `automationStudioGatewayTraceServiceStore`, and the domain's `registerFluxIQHost` and `keptWebExtractionConditions`
  (now public); `rebuild/core-authoring.ts` and `run/core-trial-seams.ts` deleted. Real data: survey on a fresh social
  copy verifies revisions 10 and 16 (subflow and whole digests) and brief-2's 11; E1 revision 10 on f53b350b -> 19/19
  matched, 15 = 15 rows, oracle fail. Report `lane-t-p5w6-experiment-seams.md`.
- W7: `gatewayActionResultFromBrowserResult` moved to `domain/src/client/browser-result-mapping.ts` (extension callers
  switched); `createWebOfflineReadReevaluator(page): ClientGatewayTraceReevaluator` on Core's types; D37 control
  (`control-reproduced.ts`). Domain offline-reads tests 18/18 (4 pass, 14 fail before). Report
  `lane-t-p5w7-reevaluator-control.md`.
- P5e2: `package-exports` scoped per D38 (type-checked static imports of sibling TypeScript source not held). Rules'
  tests 296/296 in each repository; mirror 72 files match. Report `lane-t-p5e2-rule-scope.md`.
- Lead: adopted the findings that predate t749 into each ratchet baseline (`node scripts/structure-audit.mjs --update
  --adopt package-exports`): Core 3 (`scripts/flow-compiler.mjs`, `scripts/automation-studio-scale-{baseline,
  certification}.mjs` load `packages/fluxiq/dist`), downstream 35 (34 root scripts load `packages/test-runner/dist`;
  `domain/.../node-run/tests/arrival.test.ts:331` loads a second copy of a Core module on purpose). Then Core audit ->
  `passed (436 warning(s), 1155 baselined)`, downstream -> `passed (218 warning(s), 651 baselined)`.
- Lead: exported Core's `clientGatewayTraceReevaluationRequest` from the trace-matcher barrel so the gate tool asks
  exactly as the matcher does; Core rebuilt (`fluxiq:build` built), fluxiq `tsc --noEmit -p .` -> 0.
- W8: `executeActionMessage` moved to `domain/src/client/` (P5d's shared copy deleted, callers switched);
  `loadExtensionContentCode` reads the extension's production bundles; `trial --tier2`; `reads` gate subcommand.
  Report `lane-t-p5w8-tier2-gate.md`. Results (provider-free, headed Chrome over recorded snapshots):

  | Site | Changed-read pairs: equal / different / gap | Reads over own snapshot: equal / total |
  | --- | --- | --- |
  | job-board | 2 / 0 / 8 `dynamic_content` (incl. the best pair 130 -> 144, `where` added, 12/12 cells) | 10 / 10 |
  | photo-social | 0 / 0 / 6 `dynamic_content` (only `timeoutMs`-only pairs on lists that never appeared) | 9 / 9 |
  | social-network-feed | 22 / 4 / 0 (the 4: different snapshots, the feed grew between A and B) | 50 / 62 (12: t743 content-code drift, each a gap by D37) |

  Corrected candidate (P4's deferred item): revision 16 on trace f53b350b with tier 2 -> 19/19 operations, 1
  reevaluated (`parameters.extractList.where`), 0 stored rows = live revision 16's 0, oracle fail = live judged "no".
  Reverse control (revision 10 on 3e353455): 14 rows vs live 15, a different page (30 vs 32 items), 14 positions equal.
- Decision D39: the 4 social cross-snapshot pairs are not tier-2 faults. The matcher asks for B run at A's point,
  which A's snapshot answers; B's live result came from a later, grown page. The judged whole run stays live (D3), so
  a page that grows by itself costs at most an offline answer that the live run then corrects; recorded for P6.

### 2026-10-20 - W9 (headed spec through the reevaluator), W10 (docs), lead's final gate
- W9: `e2e/content/tests/offline-reads` now asks the domain's reevaluator with a Core-shaped request built from the
  production capture. Report `lane-t-p5w9-e2e-reevaluator.md`.
- W10: Core `client-gateway.md` section "Gateway traces and offline trials", `code-structure.md` (the two rules);
  downstream `extension-client.md` ("Trace page capture", tier-2 subsection), `web-capabilities.md` (builder paths),
  `testing-facility.md` ("Offline trials over recorded traces"). Report `lane-t-p5w10-docs.md`.
- Lead's final checks (after every unit; no worker running):
  - Core `pnpm exec vitest run` over client-gateway trace, trace-replay, trace-matcher; AS model/offline-trial,
    service/offline-trial, service/trial-ports, single-subflow, dispatch, gateway-trace, service/project-build ->
    `Test Files 99 passed (99)`, `Tests 540 passed (540)`.
  - fluxiq `pnpm exec tsc --noEmit -p .` -> 0.
  - Core `pnpm docs:check` first failed `framework-reference.md is stale: the public surface changed`; `pnpm
    docs:reference` -> `Wrote ... (4116 public declarations)`; then `pnpm docs:check` -> `Deterministic framework
    reference is current.` Core rebuilt after it (`fluxiq:build` built); `core-build.mjs` -> current.
  - Domain `tsc --noEmit` (tsconfig.json, tsconfig.test.json) -> 0, 0; `DOMAIN_TEST_BUILD_LABEL=t749-lead node
    scripts/test-domain.mjs runtime/offline-reads/tests client/tests runtime/llm-evidence/plan-resolution/extraction/tests`
    -> `# tests 132 # pass 132 # fail 0`.
  - Extension `tsc --noEmit` (tsconfig.json, tsconfig.test.json) -> 0, 0; `test-extension.mjs runtime/tests/result-mapping
    runtime/tests/action-runner background/connection/tests/server-command-channel` -> `# tests 62 # pass 62 # fail 0`.
  - Test-runner build -> `test-runner:build` built; `node --test` over offline-snapshot-page and offline-trial-experiment
    -> `# tests 98 # pass 98 # fail 0`.
  - Audits: Core -> `passed (436 warning(s), 1155 baselined)`; downstream -> `passed (218 warning(s), 651 baselined)`;
    `core-mirror.mjs` -> `structure-audit (72 files)` match.
  - Headed browser check (realistic scenarios, provider-free): `node scripts/test-content.mjs -- --headed --workers=2
    offline-reads` -> `5 passed (7.0m)`: the reevaluator answers changed read B over the production capture equal to
    live B on job-board 84/84 cells (Chrome and Edge), photo-social 566/566, social-network-feed 906/906 (0 scripts, 0
    leaked requests); a photo feed captured before it grew -> gap `dynamic_content`; the primary unreadable -> gap
    `snapshot_unavailable` (all 5 cases).

## Gate (plan P5)

| Gate item | Result | Evidence |
| --- | --- | --- |
| Changed read offline matches live: job-board | Met | Trace pairs: 2 answered, both equal (130 -> 144 `where` added, 12/12 cells; 1255 -> 1284); 8 conservative `dynamic_content` gaps, 0 different; reads 10/10 reproduced; headed 84/84 on Chrome and Edge |
| Changed read offline matches live: social | Met | 22 same-snapshot pairs answered, all equal (164 -> 265 34/34 rows; f53b350b@78 -> a4d59680@78); 4 cross-snapshot pairs differ because the feed grew between A and B (D39); headed 906/906 |
| Changed read offline matches live: photo | Partial | Round 4 holds no photo changed-read pair whose list appeared (6 `timeoutMs`-only pairs on lists that never appeared, gaps by rule); reads 9/9 reproduced (incl. a 24-row read); headed changed read 566/566 cells |
| Social corrected candidate reproduces the judged result | Met | Revision 16 on f53b350b `--tier2`: 19/19, 1 reevaluated, 0 rows = live 0, oracle fail = live "no" |
| Dynamic or missing snapshot is an explicit gap | Met | Headed: grown feed `dynamic_content`, missing primary `snapshot_unavailable`; traces: the 12 social reads changed by t743's content code are refused by the control; unit tests (domain 18, matcher reevaluation) |
| Offline pass never satisfies the whole-run gate | Met | `model/offline-trial/tests/{whole-run-gate,live-success}-eligibility.test.ts` with reevaluated operations |
| No trace content reaches model guidance | Met | `module-reach` rule, `reachBoundaries` in both configs (12 Core guidance entries; domain guidance); both audits pass |
| Deep loads replaced by a public seam, plus an audit rule | Met | `rebuild/core-authoring.ts`, `run/core-trial-seams.ts` deleted; `package-exports` rule; survey and E1 still verify on real data |

## Units ready

UNIT READY (Core, t749 tree): `packages/fluxiq/src/client-gateway/trace-matcher/{types,matcher,gap-reasons,index,
reevaluation-request}.ts` and `tests/{trial-gateway.ts,matcher-reevaluation.test.ts}`; AS `model/offline-trial/
{vocabulary,live-success-eligibility}.ts` and 3 tests; AS `runtime/service/offline-trial/{contracts,run,
evidence-result}.ts` and `tests/{offline-harness.ts,gap-vocabulary.test.ts,reevaluation.test.ts}`; AS
`runtime/service/trial-ports/**`, `runtime/project-agents/single-subflow/{proposal-assembly,rebuild,index,
single-subflow-trial}.ts` and `tests/rebuild.test.ts`, `runtime/project-agents/dispatch/index.ts`,
`runtime/gateway-trace/wiring/{service-store,index}.ts` and `tests/service-store.test.ts`, `runtime/service.ts`,
`runtime/service/project-build/whole-trials.ts`, `runtime/index.ts`; `scripts/structure-audit/{config.mjs,
import-graph/{binding-reach,module-bindings,index}.mjs,package-exports/**,rules/{module-reach,package-exports}.mjs,
rules/tests/{module-reach,package-exports}.test.mjs}`; `.structure-baseline.json`; `docs/reference/
framework-reference.md`, `packages/fluxiq/docs/reference/framework-reference.md`; `docs/architecture/{automation-studio/
client-gateway,code-structure}.md`.

UNIT READY (downstream, t749 tree): `domain/src/runtime/offline-reads/**`, `domain/src/runtime/index.ts`,
`domain/src/client/{browser-result-mapping,execute-action-message,index}.ts` and their tests, `domain/src/index.ts`,
`domain/src/runtime/llm-evidence/index.ts`, `domain/src/runtime/llm-evidence/plan-resolution/{index,extraction/index}.ts`;
`apps/extension/src/runtime/{result-mapping,action-runner}.ts`, `apps/extension/src/runtime/tests/result-mapping.test.ts`,
`apps/extension/src/background/connection/server-command-channel.ts`, `apps/extension/e2e/content/tests/offline-reads/**`,
`apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts`; `packages/test-runner/src/
offline-snapshot-page/**`, `packages/test-runner/src/offline-trial-experiment/**` (including the deletions of
`rebuild/core-authoring.ts`, `run/core-trial-seams.ts`, `rebuild/tests/{core-authoring.test.ts,authoring-fakes.ts}`);
the `scripts/structure-audit/**` mirror and `config.mjs`; `.structure-baseline.json`; `docs/architecture/
{extension-client,web-capabilities,testing-facility}.md`; `docs/working/trace-offline-trials-plan/reports/lane-t-p5*.md`.
The two halves form one unit (the downstream half compiles against the Core half); merge Core first.

## Not verified

- No live or paid run (by the brief). Tier-2 trials ran provider-free with a non-model judge on copied round-4 traces.
- Production does not host the snapshot page: for P5 it is a Playwright page in the test-runner (D34). Where it runs in
  a build, and passing the live session's view (round-4 traces still need `--session-view declared`), are P6's.
- The "asked the page for more than the control" rule never fired in a headed run (`scrollsPastEnd` is 1 for every
  read, static or not); the dynamic gaps seen came from the control not reproducing the recorded read, and from the
  job-board legacy reads asking less than their changed reads. A read that only scrolls further than its recorded one
  is covered by unit tests only.
- Edge ran only on job-board. Firefox has no tier 2 (no page capture).
- The `reads/` gate modules (`run-reads-gate.ts`, `trace-reads.ts`) are exercised by the real runs, not by unit tests.
- No full suites (narrow checks only, per the rules).

## Open questions and follow-ups

1. Pre-existing `package-exports` findings adopted into the ratchet baselines (Core: 3 root scripts loading
   `packages/fluxiq/dist`; downstream: 34 root scripts loading `packages/test-runner/dist`, and `arrival.test.ts:331`,
   which loads a second copy of a Core module on purpose). New loads fail the build; the cleanup (export named entry
   points and link the packages where the scripts run) is a separate task for the supervisor to schedule.
2. Content-code drift: tier 2 runs today's content code over older traces (12 social reads differ because t743 changed
   disclosure checking after round 4). The control turns them into gaps. In P6 a trace and its offline trials come
   from one build, so drift matters only across extension updates; a version check could be added then.
3. A page that grows on its own (social 136 -> 189): the answer is right for "B at A's point", and the judged whole run
   stays live (D39). P6 may want a self-growing-page signal before relying on such answers.
4. Ignored run outputs: `test-runs/p5` (1.1 GB, survey copies), `test-runs/p5w6` (1.6 GB), `test-runs/p5w8` (3.4 GB)
   hold store copies with page data; never commit; prune when no longer needed.
