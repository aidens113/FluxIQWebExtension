# Current State Report: extension-runtime-capabilities-plan.md

Worker report for the `## Current State` insertion into
`docs/working/extension-runtime-capabilities-plan.md`.

## The five facts an agent resuming this work most needs

1. **All six planned phases are complete and verified.** The Implementation
   Plan checklist is `[x]` for Phase 1 (structure/exports) through Phase 6
   (state/snapshot runtime), and the "2026-08-20 Final Verification" entry
   records workspace-wide `pnpm check`, `pnpm build`, and `pnpm test` passing.
   What remains is follow-on work, not phase completion.

2. **A workaround is load-bearing: core's client gateway capability contract
   does not expose `outputIds`.** Because `RuntimeService` selects clients by
   `outputId`, the web automation host registers a *direct runtime adapter*
   with explicit output IDs and dispatches through the existing client gateway
   bridge. The Protocol Work section's proposed `ClientGatewayCapability`
   fields and their projection in
   `ClientGatewayRuntimeTransport.runtimeCapabilityFromGatewayCapability()`
   are still unimplemented. Removing this workaround requires a change in the
   linked core repo, not this one.

3. **Flow execution is host-owned by design; `read_state` is a snapshot
   fallback by design.** `server.run_flow` / `client.flow_result` are
   deliberately deferred until there is a concrete offline/local execution
   requirement. `server.read_state` / `client.state_result` do not exist, so
   the adapter's `readState` intentionally uses structured snapshot capture.
   Neither is an oversight; both are recorded decisions.

4. **The hard-won behavior lives in the post-phase debugging checkpoints, not
   in the plan sections.** Extension-owned automation tab; navigation waiting
   for tab load, a stable completed URL, and content-script attach;
   confirmation `client.recording_event` carrying `inputId` *and* `domainId`;
   `output-nodes/native-runtime.ts` binding native implementations for the
   generated output nodes; client selection by advertised `web.actions`
   capability accepting `connected` as well as `ready` sessions; target
   resolution falling back selector -> coordinates -> visual-target bounds ->
   recorded element fingerprint; frame `0` default with a top-frame-only guard;
   and a content-script version handshake. Regressing any of these re-breaks
   replay.

5. **Four Open Questions are genuinely open and gate the next design step:**
   default `RuntimeService` binding in core, whether the gateway protocol grows
   `read_state` now, generated importer node definitions versus
   `builtin.policy.action` nodes for authoring, and whether runtime client
   selection should prefer the recording source session. Cross-repo work is
   coordinated through the paired document
   `F:\!FluxIQ\docs\working\runtime-kernel-plan.md`.

## Does the document's own evidence support `Status: Active`?

**Partly, with a caveat the supervisor should know.**

Supporting `Active`:

- Four Open Questions remain unanswered.
- Multiple explicit deferrals are written as future work, not cancellations:
  "Add only when needed"; "Only add extension-owned `run_flow` after there is a
  concrete offline/local execution requirement"; tab behavior described as
  "later settings".
- The core capability-contract gap is recorded as a live workaround, implying
  an intended follow-up.
- Git history shows the file was still being edited on 2026-09-04.

Arguing against `Active`, or at least against "actively in progress":

- Every phase in the Implementation Plan is checked off, and the document's own
  Final Verification entry closes the plan with a green full-workspace run.
  There is no open checkbox anywhere in the file.
- No dated Progress Log section exists after **2026-08-20**. The body shows no
  recorded activity for roughly three weeks before the header's
  `Last updated: 2026-09-10`.
- The document has no "Next" or "In progress" section of its own; its
  forward-looking content is entirely Open Questions plus conditional
  ("add only when needed") deferrals.

Net: the content reads as *complete-but-not-closed*. The planned scope is
delivered; what remains is optional or blocked on core. `Active` is defensible,
but it should not be read as "someone is mid-task here."

## Internal contradictions and stale statements

1. **The header's status detail is not supported by the body.** Line 4 reads:

   > `Status detail: Extension as a first-class FluxIQ runtime client; last
   > checkpoint 2026-09-04 added settable output-node parameters.`

   There is no 2026-09-04 section in the document, and the string "settable"
   appears nowhere in the body. I checked the actual 2026-09-04 commit
   (`12abce1`, "settable params for output nodes manually and state-based"):
   it changed this file by **+4 lines only**, appending two bullets (the
   top-frame-only guard and the content-script version handshake) to the
   existing **2026-08-20** "Runtime Status Accuracy / Redirect Readiness"
   section. That commit's settable-parameter work went into code, not into this
   document. The header describes a checkpoint the document does not contain.

2. **Duplicated `Verification:` block at end of file.** The final section
   carries two consecutive `Verification:` lists (original lines 1030-1040 and
   1041-1050). The second repeats the same commands in a different order
   (`domain check/test`, `extension check/build/test`, `pnpm check/build/test`).
   One is redundant. Not removed - the brief forbids deleting existing content.

3. **`Related: none` versus a live cross-repo dependency.** The header says
   `Related: none`, yet the most important unresolved item depends on the
   linked core repo, and the header itself names a paired file on line 9
   (`F:\!FluxIQ\docs\working\runtime-kernel-plan.md`). Not a strict
   contradiction, since "Paired document" is its own field, but a reader
   scanning `Related:` would miss the dependency.

4. **Phase 1's implementation note quietly supersedes Phase 2's acceptance
   criteria.** Phase 2 lists as acceptance:

   > `RuntimeService.dispatch({ kind: "execute_action", outputId })` selects the
   > extension client.

   Phase 1's note explains this is achieved via a *direct runtime adapter*
   because the gateway contract lacks `outputIds` - that is, not via the
   gateway capability projection that the Runtime Capability Model and Protocol
   Work sections present as the design. Protocol Work still reads as pending
   work rather than as superseded or blocked, so a reader could implement
   against it without noticing the adapter path already exists.

5. **"Recommended First PR" is stale by success.** The section describes a
   low-risk structural slice - "That creates the backbone for flow replay
   without touching the large extension connection/content scripts yet" - that
   Phases 1-4 have since completed, including the connection/content script
   work it explicitly deferred. It reads as forward-looking guidance but is
   history.

6. **`Proposed Folder Structure` omits files the Progress Log later added.**
   The tree does not list `apps/extension/src/runtime/automation-tab.ts` or
   `domain/src/output-nodes/native-runtime.ts`, both recorded in the Progress
   Log as created and load-bearing. The tree is a stale snapshot of intent.

## Line counts and verification output

- **Before:** 1050 lines
- **Inserted:** 115 lines
- **After:** 1165 lines (1050 + 115, exact)

Placement: after the header's `---` (line 12) and its following blank line
(line 13). The block runs `## Current State` (line 14) through its content,
then a blank line, a closing `---`, and a blank line. The original `## Goal`
now begins at line 129.

Verification commands run after the edit, verbatim output:

```text
$ wc -l docs/working/extension-runtime-capabilities-plan.md
1165 docs/working/extension-runtime-capabilities-plan.md

$ git diff --numstat -- docs/working/extension-runtime-capabilities-plan.md
115     0       docs/working/extension-runtime-capabilities-plan.md

$ grep -n '^## Current State' docs/working/extension-runtime-capabilities-plan.md
14:## Current State
```

Checks against the brief:

- New count equals old count plus lines inserted: **1050 + 115 = 1165. Pass.**
- `git diff --numstat` shows **0 deletions. Pass.**
- `## Current State` is on line **14**, not greater than 32. **Pass.**
- Inserted section is **115 lines**, under the 150-line limit. **Pass.**
- Header lines 1-12 unmodified, unmoved, not duplicated - implied by 0
  deletions combined with the insert starting at line 14. **Pass.**

Repo-wide `git diff --stat` confirms this worker touched exactly one file.
`AGENTS.md`, `docs/working/README.md`,
`docs/working/agent-working-doc-protocol.md`,
`docs/working/module-size-governance-plan.md`, and `package.json` were already
modified in the working tree before this task began (they appear in the
starting `git status`) and were not touched here. No commit was made.

## Anything not completed

Nothing in the brief was left undone. Two notes on scope discipline:

- The duplicated `Verification:` block and the stale sections listed above were
  **reported, not fixed**, per the add-never-rewrite constraint.
- Git history was consulted (`git log`, `git show 12abce1`) only to test the
  header's 2026-09-04 claim against the body. The inserted `## Current State`
  section is otherwise sourced from the document's own content; its single
  reference to the 2026-09-04 edit states only the verified fact that the edit
  appended bullets to the 2026-08-20 section rather than opening a new dated
  checkpoint.
