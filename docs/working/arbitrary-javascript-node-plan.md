# Arbitrary JavaScript Flow Node Plan

Status: Active
Status detail: Discovery confirmed the capability is absent; implementation is queued behind the three active live-validation lanes.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Add a privileged, reviewable web JavaScript Flow node that an LLM may choose only when purpose-built nodes cannot express the required browser behavior, then prove it through the real panel and extension.
Paired document: `F:\fxwork\t029\!FluxIQ\docs\working\arbitrary-javascript-node-plan.md`
Related: [Week 2 automation loop](./mvp-week2-automation-loop-plan.md), [extension runtime capabilities](./extension-runtime-capabilities-plan.md)

---

## Current State

**Discovery complete; implementation not started.** The downstream web node
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

**Next:** dispatch the implementation/live-validation brief when a worker slot
finishes its current MVP lane, then review and integrate the result.

**Blockers:** all three worker slots are currently running the higher-priority
repair, extraction, and performance live lanes. The task has an isolated paired
worktree and can begin immediately when the first slot returns.

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

---

## Work Ledger

### 2026-09-20 — Discovery and execution boundary
- Agent: supervisor
- Changed: this paired working plan only
- Why: The requested node does not exist and spans Core authoring policy plus extension execution, with security and browser-permission consequences.
- Validation: repository search and source inspection -> no user-authored JS node; current LLM validator rejects executable-code keys; Chrome 153 is installed and exposes the MV3 user-script API when enabled.
- Outcome: Partial
- Follow-up: dispatch `w2-arbitrary-js-node-live` when a worker slot returns.

---

## Open Questions

- Whether Chrome's per-extension Allow User Scripts toggle is already enabled in
  the disposable Lab profile; the first live run will answer this and the UI
  must surface a recovery instruction if it is not. Owner: worker.
- Whether Firefox's optional permission can be requested cleanly in the current
  popup flow; absence must fail closed and be documented rather than emulated
  with `eval`. Owner: worker.
