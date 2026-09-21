# Arbitrary JavaScript Flow Node Plan

Status: Active
Status detail: Final rereview found complete-lineage, delayed-event, and cross-invocation USER_SCRIPT hardening gaps; one last narrow live-first remediation is active.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Add a privileged, reviewable web JavaScript Flow node that an LLM may choose only when purpose-built nodes cannot express the required browser behavior, then prove it through the real panel and extension.
Paired document: `F:\fxwork\t029\!FluxIQ\docs\working\arbitrary-javascript-node-plan.md`
Related: [Week 2 automation loop](./mvp-week2-automation-loop-plan.md), [extension runtime capabilities](./extension-runtime-capabilities-plan.md)

---

## Current State

**Discovery and implementation complete; integration review active.** The downstream web node
catalog has deterministic DOM actions and extraction, while Core has built-in
data/control nodes and trusted-local importer implementations. Neither side
currently exposes a user-authored JavaScript Flow node. Core's LLM output
validator deliberately rejects conventional executable-code keys, so the new
capability must be a narrow registered exception rather than a general weakening.

**Chosen ownership.** Core owns catalog selection, LLM guidance, privileged
review semantics, and the generic contract. The web domain owns the registered
browser action and result contract. The extension owns execution through the
browser's user-script API. This is a browser/DOM capability, not unrestricted
Node.js execution in the panel server.

**Required behavior**

- A visible palette node accepts bounded JavaScript source and JSON inputs and
  returns a bounded JSON result.
- Execution occurs in a browser user-script world with no extension API access.
- The node is privileged and never silently introduced or applied: generated
  source remains visible in the normal proposal review.
- Provider guidance says to prefer registered purpose-built nodes and select
  JavaScript only when the catalog cannot express the behavior.
- Generated plans may use only this registered source parameter; arbitrary code
  fields elsewhere remain rejected.
- Unsupported browser/API/permission state fails closed with a categorical,
  actionable error. Existing flows and permissions continue unchanged until the
  node is selected.
- Source, inputs, output, error text, page data, and secrets must not enter logs
  or reports. Limits cover source bytes, input bytes, output bytes, and elapsed
  execution. Synchronous non-termination is called out honestly if the browser
  API cannot forcibly terminate it.

**Live-first validation order**

1. Use a disposable Lab page and hand-authored Flow to prove the real panel,
   gateway, extension, browser user-script world, result transport, and oracle.
2. Add the node to the provider catalog and run one bounded real-LLM authoring
   task where purpose-built nodes suffice; assert the model does not choose JS.
3. Run one bounded real-LLM task whose behavior cannot be expressed by the
   current node library; review the proposed source, apply it, run it, and prove
   the page/result oracle.
4. Only after those live checks pass, add focused contract/runtime tests and
   package builds. Workspace-wide suites wait for the coherent task boundary.

**Node-library feedback loop.** Every live lane records missing reusable
behavior. A repeated behavior becomes a purpose-built Core or web node, after
which the LLM should prefer that node over JavaScript. JavaScript is the escape
hatch, not the normal authoring vocabulary.

**Live result.** A disposable Chromium 151 journey proved the real panel,
gateway, extension, user-script execution, page mutation, direct JSON result
port, downstream value consumption, and a second-node verification oracle.
Two capped provider attempts did not prove model selection: one persisted a
proposal that the temporary harness failed to retain for inspection and one
failed closed as invalid provider output. These remain explicit gaps rather
than inferred passes. Firefox remains fail-closed and unverified.

**Remediation result.** Trusted output metadata now withholds the complete
JavaScript command parameters and raw result payload from saved runtime
attempts while preserving the real ephemeral adapter call and projected Flow
result. USER_SCRIPT serializes and byte-checks the value before transport in a
small tagged envelope. Both injected and outer deadlines are categorical
timeouts. The same real Chromium two-node Flow passed again after these fixes.

Supervisor verification found and corrected two stale existing domain
registry assertions for the nineteenth output node; only those two checks were
rerun and passed. The focused Core persistence/projection/allowlist gate passed
72/72. The Chromium manifest's required `userScripts` permission remains an
explicit documented product tradeoff.

**Persistence-boundary result.** The graph/session trace, saved attempts, and
public runtime events now omit distinct source/input/result sentinels while
the reviewed Flow artifact, ephemeral adapter call, and real data edge retain
the values they own. USER_SCRIPT captures bounded serializer/encoder/race/timer
primordials before source runs, and docs/tests state honestly that timeouts do
not cancel already-running asynchronous or synchronous source. The final
Chromium 151 two-node oracle passed (`sum="7"`, `marker="js-live"`), followed
by 68/68 Core and 11/11 extension focused checks plus affected builds.

**Next:** close complete JSON-result lineage withholding, retain private command
classification across duplicate/delayed transport results, and make the
pre-transport byte boundary immune to current and prior USER_SCRIPT poisoning.
Then rerun the two-node Chromium oracle before focused checks and rereview.

**Blockers:** the three final rereview findings. The model-authored
selection/apply/run journey and Firefox parity remain follow-up validation
gaps and must not be reported as complete.

---

## Implementation Phases

1. Audit the exact command, manifest, output-node, registry, catalog, proposal,
   and action-result seams; revise this design only from code evidence.
2. Add the smallest registered `web.dom.run_javascript` contract and extension
   executor, using `userScripts.execute` where supported and a closed refusal
   elsewhere. Keep Chrome/Edge and Firefox manifests aligned with their actual
   permission models.
3. Add Core's catalog/prompt preference and exact privileged review behavior.
   Do not globally permit executable fields.
4. Perform the three live browser journeys above, fixing one observed failure at
   a time. Do not run broad suites during this loop.
5. Add focused tests after live success, update architecture/user documentation,
   merge current `dev` into both task branches, run coherent final gates once,
   merge and push both `dev` branches together.

## Worker Briefs

### Brief: w2-arbitrary-js-node-live
- Repository: paired t029 downstream and FluxIQ Core worktrees
- Task: implement and live-prove the registered privileged browser JavaScript node and LLM fallback policy described in Current State.
- Required reads: this document's Current State; Core paired document Current State; downstream `domain/src/io/`, action command/result seams, manifests, and extension runtime; Core node registry, bootstrap catalog/prompt, output validation, proposal risk/review seams.
- Owns (may edit): t029 downstream domain/extension source, manifests, focused tests, authored architecture docs, and its unique report; t029 Core node/catalog/prompt/validation/review source, focused tests, authored architecture docs.
- Must not touch: t027 worktrees, user `.fluxiq`, live user panel data, unrelated node libraries, shared `dev`, or any worker report except its own.
- Definition of done: all three live journeys are observed in order; source remains reviewable and privileged; existing-node task avoids JS; missing-node task uses JS and passes its oracle; focused checks pass only after live behavior works; limitations are reported honestly.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-node-live.md`

### Brief: w2-node-library-gap-live
- Repository: t029 downstream, read-only except its unique report
- Task: audit live MVP journeys and the registered web/Core node catalog for repeated behavior currently expressed through orchestration glue or likely to fall through to JavaScript; distinguish true node gaps from runtime/UI/harness defects.
- Required reads: this document's Current State; t027 extraction, repair-result, runtime-latency, reconnect/reuse, and unified-progress reports; downstream output-node definitions; Core built-in node registry.
- Owns (may edit): only `docs/working/arbitrary-javascript-node-plan/reports/w2-node-library-gap-live.md`.
- Must not touch: product source, t027/t030, shared dev, user data, worker reports, tests, or live provider credentials.
- Definition of done: ranked list of at most five candidates with concrete repeated live evidence, existing-node overlap, owning repository, smallest contract, and an explicit recommendation to build now/defer/reject; no candidate based only on speculation.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-node-library-gap-live.md`

### Brief: w2-semantic-actionables-live-probe
- Repository: isolated disposable Lab worktree based on current downstream `dev`; t029 read-only except its unique report
- Task: live-probe whether existing `web.dom.capture_snapshot` / page inspection exposes bounded role, accessible-name/label, actionable-state, and stable opaque target evidence sufficient for creation and repair; decide whether `web.dom.query_actionables` is a real missing node.
- Required reads: this document's Current State; `w2-node-library-gap-live.md`; existing snapshot/inspection output contracts and extension implementation; Scenario Lab fixture controls.
- Owns (may edit): only `docs/working/arbitrary-javascript-node-plan/reports/w2-semantic-actionables-live-probe.md`; disposable ignored run/profile data outside user storage.
- Must not touch: product source, t027/t030, shared `dev`, user `.fluxiq`, user browser profile, provider credentials, or any other worker report.
- Live order: inspect the real output contract, run a controlled page with ambiguous selectors but distinct semantic identities through the production extension/panel path, capture only structural metadata, and compare the evidence to the proposed smallest node contract.
- Definition of done: report exact fields and boundedness; demonstrate whether a consumer can distinguish actionable candidates without raw DOM/HTML; recommend build now/defer/reject from observed evidence; no provider call and no product edits.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-semantic-actionables-live-probe.md`

### Brief: w2-arbitrary-js-adversarial-review
- Repository: paired t029 downstream and FluxIQ Core worktrees, read-only except its unique report
- Task: try to falsify the completed JavaScript-node implementation before integration; inspect only the final product diff and focused tests.
- Required reads: this document's Current State; `reports/w2-arbitrary-js-node-live.md`; changed files reported by `git diff --name-only` in both t029 worktrees.
- Owns (may edit): only `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-adversarial-review.md`.
- Must not touch: product source, tests, other reports, task branches, user data, live panel state, provider credentials, or provider APIs.
- Review focus: executable-source allowlist identity, privileged/operator-review invariant, source/input/output byte limits, JSON shape, result-path projection and pollution resistance, user-script permission failure, manifests/browser claims, and accidental unrelated changes.
- Definition of done: list concrete findings by severity with file/line evidence; explicitly state every reviewed claim that survived; no live provider call and no code change.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-adversarial-review.md`

### Brief: w2-arbitrary-js-remediation-live
- Repository: paired t029 worktrees; Core owns generic persistence withholding/projection, downstream owns trusted node metadata and browser executor.
- Task: fix every blocking/high/medium adversarial finding, then rerun the existing hand-authored real-browser flow before focused checks.
- Required reads: Current State; adversarial report; existing JS live report; direct runtime persistence, IO-policy, node metadata, executor, and focused-test owners named there.
- Owns Core: `packages/fluxiq/src/runtime/{contracts,service}.ts` and focused runtime tests; Automation Studio `runtime/io-policy.ts` and focused tests/docs. Owns downstream: JS output/manifest metadata, `run-javascript.ts`, focused tests, related architecture docs, and unique report.
- Must not touch: provider harness/scenarios, t027/t033, user state/port 3000, provider APIs/credentials, unrelated permissions, shared `dev`, git history.
- Privacy contract: real parameters/results reach the adapter and downstream node ephemerally; saved command attempts omit or mark the entire JS parameter object and raw result payload; persistence test proves source/input/result sentinels absent.
- Executor contract: serialize and byte-check in USER_SCRIPT before browser transport; return only a bounded tagged envelope; exact/over-limit/non-JSON/error cases fail closed; injected and outer deadlines both return typed timeout without raw errors.
- Live order: focused executor probes may support implementation, but acceptance requires the same real Chromium hand-authored two-JS-node flow and direct result-port/page oracle before final focused package checks.
- Permission disposition: keep the proven Chromium manifest/API path and revise docs/plan to state the up-front declaration plus per-extension toggle honestly; do not add an unproven optional request flow.
- Definition of done: all high/medium findings fixed; live oracle passes; focused persistence/executor/projection/build checks pass afterward; no provider call; report any remaining model-authored/Firefox gap.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-remediation-live.md`

### Brief: w2-arbitrary-js-adversarial-rereview
- Repository: paired t029 downstream and FluxIQ Core worktrees, read-only except its unique report.
- Task: independently try to falsify the remediated JavaScript-node implementation before integration; review final source, tests, manifests, and docs only.
- Required reads: this document's Current State; the initial adversarial report; `reports/w2-arbitrary-js-remediation-live.md`; final modified and untracked files in both worktrees.
- Owns (may edit): only `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-adversarial-rereview.md`.
- Must not touch: product source, tests, other reports, task branches, user data, live panel state, provider credentials/APIs, or disposable browser runs.
- Review focus: trusted-only persistence controls; saved-event/attempt coverage; ephemeral adapter/projection behavior; tagged-envelope spoofing, size and JSON bounds; injected/outer deadlines; executable allowlist/review invariants; manifest/docs accuracy; and complete accounting of untracked files.
- Definition of done: list concrete residual findings by severity with file/line evidence; explicitly re-evaluate every initial high/medium finding; state surviving claims and integration disposition; no code edit, live run, provider call, commit, or push.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-adversarial-rereview.md`

### Brief: w2-arbitrary-js-persistence-boundary-live
- Repository: paired t029 worktrees; Core owns durable/public projections and graph-trace privacy, downstream owns USER_SCRIPT hardening/docs/live rerun.
- Task: fix every high/medium residual rereview finding, then rerun the same hand-authored two-node Chromium Flow before focused checks.
- Required reads: Current State; adversarial rereview; remediation report; Core runtime public-event, client-gateway transport, executor trace/session persistence and existing trace-withholding owners; downstream executor/docs and focused tests.
- Owns Core: runtime contracts/service/client-gateway transport only as required for a safe public event projection; Automation Studio executor trace/privacy seams and focused full-graph/service persistence tests. Owns downstream: `run-javascript.ts`, its focused tests, timeout/privacy architecture wording, and unique report.
- Must not touch: provider harness/scenarios, t027/t033, user state/port 3000, provider APIs/credentials, unrelated runtime events, shared `dev`, or git history.
- Durable boundary: real source/input/result remain available only to reviewed Flow ownership, the executing adapter, and ephemeral downstream data edges. Saved graph traces/sessions and public runtime events contain none of three distinct sentinels. Controls must be trusted definition/runtime policy, not Flow/model fields.
- Event boundary: preserve command/status identity needed by observers while projecting or withholding sensitive parameters/payloads consistently, including the transport-forwarded result event. Pin compatibility for ordinary outputs.
- USER_SCRIPT boundary: capture immutable/bound serializer, UTF-8 encoder, race, and timer primordials before invoking source; monkey-patching their globals/prototypes cannot spoof the envelope or move an oversized value across transport. Extension-side recheck remains.
- Timeout contract: keep typed deadlines and document/test honestly that neither injected nor outer timeout cancels still-running asynchronous or synchronous source; do not claim termination.
- Live order: after the fixes, rerun the same isolated real Chromium two-JS-node result-port/page oracle before focused persistence/event/executor checks. No provider call.
- Definition of done: all residual high/medium findings closed with sentinels absent from full saved session/trace and observed public events; adversarial monkey-patch cases remain bounded; live oracle and focused checks pass; ordinary command/event/trace behavior is covered.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-persistence-boundary-live.md`

### Brief: w2-arbitrary-js-persistence-final-rereview
- Repository: paired t029 worktrees, product read-only; downstream unique report only.
- Task: independently try to falsify the final persistence/event/USER_SCRIPT remediation before integration.
- Required reads: Current State; both adversarial reports; persistence-boundary live report; final changed product/tests/docs only.
- Owns: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-persistence-final-rereview.md` only.
- Must not touch: product/tests/other docs, live panel/store, browser/provider APIs, disposable runs, git/shared `dev`.
- Review focus: trusted metadata cannot be Flow/model spoofed; full saved session/trace/attempts and every public/transport event omit source/input/result; reviewed Flow/ephemeral adapter/data edge still work; primordial monkey patches cannot bypass byte/envelope bounds; timeouts/docs/manifest permission claims are exact; ordinary-node compatibility remains.
- Definition of done: re-evaluate every prior high/medium finding with file/line evidence, list any new blocker separately, and give integrate/block disposition; no test/live/provider/commit action.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-persistence-final-rereview.md`

### Brief: w2-arbitrary-js-final-boundary-remediation
- Repository: paired t029 worktrees; Core owns generic lineage/event persistence, downstream owns USER_SCRIPT execution; report downstream.
- Task: close every final rereview blocker, then rerun the existing real Chromium two-node oracle before focused checks.
- Required reads: Current State; final rereview report; persistence-boundary report; direct trace-withholding, client-gateway transport, USER_SCRIPT executor and focused tests.
- Owns Core: smallest `trace-withholding.ts`, transport private-command classification, and nearest focused tests. Owns downstream: `run-javascript.ts`, focused tests/docs only if behavior wording changes, and unique report.
- Must not touch: provider/model harness, t027/t033, user state/manual panel, unrelated runtime events/nodes, shared `dev`, git history.
- Privacy: private result lineage must cover the complete JSON value shape, including booleans, null, arrays, and dynamic object keys, through downstream attempt/session trace inputs without value-only false negatives. Private command classification must remain bounded but survive first settlement and suppress/project duplicate or delayed same-ID result events until expiry.
- Executor: pre-transport byte measurement and envelope construction must be immune to mutations made by the current invocation and every earlier/late invocation in the shared user-script realm; do not claim cancellation that the browser cannot provide.
- Live order: implement/probe narrowly, then rerun the same isolated final Chromium two-JS-node page/result/data-edge oracle; only after live success run focused lineage/event/executor/ordinary-compatibility checks and affected builds.
- Definition of done: all three findings closed with adversarial boolean/null/key, duplicate/delayed event, cross-invocation poisoning, and mutable byteLength proofs; live oracle passes; no provider call/full suite; report exact limitations.
- Report to: `docs/working/arbitrary-javascript-node-plan/reports/w2-arbitrary-js-final-boundary-remediation.md`

---

## Work Ledger

### 2026-09-20 — Discovery and execution boundary
- Agent: supervisor
- Changed: this paired working plan only
- Why: The requested node does not exist and spans Core authoring policy plus extension execution, with security and browser-permission consequences.
- Validation: repository search and source inspection -> no user-authored JS node; current LLM validator rejects executable-code keys; Chrome 153 is installed and exposes the MV3 user-script API when enabled.
- Outcome: Partial
- Follow-up: dispatch `w2-arbitrary-js-node-live` when a worker slot returns.

### 2026-09-20 â€” Node-gap audit and direct-proof follow-up
- Agent: supervisor + `w2-node-library-gap-live`
- Changed: gap-audit report and this brief/state update only
- Why: The audit rejected UI/runtime/harness defects as node gaps and found one provisional semantic-actionable query that needs direct live proof before adding catalog surface.
- Validation: registry/report inspection and `git diff --check`; no provider call or product edit.
- Outcome: Partial
- Follow-up: run the isolated semantic evidence probe while JavaScript-node implementation continues.

---

### 2026-09-20 — Remediation live pass and supervisor gate
- Agent: supervisor + `w2-arbitrary-js-remediation-live`
- Changed: trusted persistence withholding, bounded USER_SCRIPT envelope, typed deadlines, focused tests/docs, and two stale domain registry assertions.
- Why: initial adversarial review found one high and two medium defects that blocked integration; the new output node also invalidated old registry-count/dispatch-only expectations.
- Validation: fresh real Chromium two-JavaScript-node result/page oracle passed; Core focused gate 72/72; the two corrected domain contract files passed in isolation; no provider call.
- Outcome: Partial
- Follow-up: independent adversarial rereview, then paired current-dev integration and final gates.

---

## Open Questions

- Whether Chrome's per-extension Allow User Scripts toggle is already enabled in
  the disposable Lab profile; the first live run will answer this and the UI
  must surface a recovery instruction if it is not. Owner: worker.
- Whether Firefox's optional permission can be requested cleanly in the current
  popup flow; absence must fail closed and be documented rather than emulated
  with `eval`. Owner: worker.
