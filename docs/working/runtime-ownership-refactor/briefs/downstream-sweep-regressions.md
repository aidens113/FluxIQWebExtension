# Downstream full-sweep regression triage

Role: Heavy worker, gpt-6.1-sol, max effort.
Goal: Diagnose and fix the 25 domain failures from the first full sweep, preserving safety and original oracles.
Authoring repo: C:/Users/osrs_/FluxStuff/fxwork/t843/!FluxIQWebExtension only.
Read: Current State of ../../runtime-ownership-refactor.md; original checkout .fluxiq/runtime-refactor-sweep/downstream-test.log (ignored; parse bounded failures, no large dumps).
Failed subjects: node-run/press-effect/tests/refusal-notice; node-run/tests/other-record/tests/replay-other-record; node-run/tests/replay-{ambiguous-target,remembered}; plan-resolution/extraction/tests/listing-order-in-repeat; runtime/tests/carried-{row-service,service}-repair.
Owned edits: those downstream domain test directories and actual domain/src/runtime/llm-evidence/** causes; domain/src/runtime/tests/carried-* repair tests. Report additional production paths to lead before touching.
Must not touch: any Core source (R5 foundations frozen), host-runtime.ts/output-nodes/matcher, package/config/exports, shared working docs/indexes, other reports, original checkouts, t842 source. No git/spawn.
Lead is preparing paired historical baseline under fxwork/t844 using exact pre-refactor downstream c9056f1a and Core16b5043c. This is READ ONLY; wait for lead's build-ready confirmation before running its normal selected domain tests.
Baseline report/test logs may be written only ignored run paths or your t843 report. Do not alter baseline source/oracles. No providers/browser/panel/full suites.
Current t843 Core source is changing; do not run its normal package runner or broad services until coordinated freeze/current build. Trace source while baseline prepares, then reproduce the exact failing subjects on baseline.
Determine actual runtime behavior and regression cause. Do not assume preexisting or caused by refactor. Preserve uncertain lasting-act guards, declaration/permission requirements, replay provenance and exact output data. Do not relax a meaningful safety oracle to make a pass.
If stale stimuli violate current contracts, repair them truthfully and retain the original behavior assertion; document unchanged-baseline proof. Real production defects need structural correction at owner.
Lead may authorize source-aliased focused probes if t843 runner needs rebuilt Core; request exact missing seam, do not bypass core currency guard.
Acceptance: selected failed tests plus directly affected regression tests, current vs baseline cause evidence, short honest report; no full suite repetition.
Additional read-only baseline: t844 Core selected eight files from original Core .fluxiq/runtime-refactor-sweep/core-test.log: recovery/tests/runtime-exploration-views; flow-bootstrap/candidate/tests/trial-gate; llm/harness/tests/run-size; result-verification/build-test/tests/task-checklist; service/candidate-trial/tests/consequences; service/end-view/tests/passive-result; service/subflow-trial/tests/environment; service/candidate-trial/tests/environment/tests/trial-environment (all .test.ts under Studio runtime).
The original Core parallel test group passed 15,562 tests and failed 14 in those eight files. Baseline-run these exact subjects and report actual causes; no Core source edits authorized in this triage brief.
Lead authorizes ignored esbuild virtual TEST-only overlays of corrected t843 stimuli/helpers onto unchanged t844 production for fast fixture verification. Baseline source stays untouched. Do not source-alias the changing t843 Core or claim overlay tests as final current integration; normal t843 package acceptance waits for source freeze/build.
Report: docs/working/runtime-ownership-refactor/reports/downstream-sweep-regressions.md.
Return: Outcome; Changed; Validation exact observed commands/results; Not verified; Report; Notes <=3 lines.
