# Report: automated-testing-facility-plan.md header and Current State insertion

Target: `F:\!FluxIQWebExtension\docs\working\automated-testing-facility-plan.md`
Worker: cs-testing-facility
Date: 2026-09-10

## Status chosen and why

**Active.**

Justification from the document's own text:

- The pre-existing `## Status` section (original lines 3-14; now lines 149-160)
  states both "The implementation is complete in this repository" and "live
  certification of the `existing` lane remains pending only because no
  external installation credentials, project, or persisted Flow were supplied
  to this run."
- Execution Log rows: Phase 5 "Linux execution and the scheduled three-repeat
  baseline await CI"; Phase 9 and Phase 10 "implemented and locally validated;
  live external certification pending".
- Phase 9 primary integration validation (2026-09-04): "A live external Flow
  was not executed because this session was not provided an external target
  or secrets; this is a certification gap, not an unimplemented runner path."
- Phase 10 final integration (2026-09-04): "Live clone certification against
  an external existing FluxIQ installation remains pending because no source
  base URL, credentials, project, or Flow were supplied."

Under the protocol definitions, `Complete` requires "delivered and validated".
The document itself says two lanes are uncertified and the Linux CI lane and
scheduled baseline are unexecuted, so `Complete` would overstate. `Blocked`
does not fit: the only explicit blocker the document records (Phase 12
`Credential recheck required`, 2026-09-04) was resolved the same day by the
persistent identity store, and the remaining gaps are missing inputs rather
than obstacles. `Paused` does not fit: no deliberate stop is recorded. Queued
work remains (live certification once inputs are supplied; CI lanes), which is
the `Active` definition.

The Status detail preserves the original Status section's wording about the
`existing` lane and extends it with the `clone` lane and CI gaps that the
Execution Log rows state.

## Owner

`Primary agent under the Execute Plan With Subagents workflow, with rotated
phase subagents`.

Justification: the original Status section names the `Execute Plan With
Subagents` workflow; the Execution Log `Owner` column lists `primary` plus
named subagents (`phase0_contracts`, `phase3_topology`, `phase4_evidence`,
`clone_contracts`, `clone_source`, `clone_destination`,
`post_crash_hardening`, `phase12_target_cli`, `phase12_allocation_lock`,
`phase12_manifest_docs`); the 2026-09-05 audit section states "The primary
agent owns cross-repository integration, working-document reconciliation, and
final automated/live validation." No human role or team is named.

## Paired Core document

**none.**

The document never names a document under `F:\!FluxIQ\docs\working\`. To
check for an implied pair I listed that directory and grepped every file for
`testing facility`, `FluxIQWebExtension`, `web-extension`, `demo:record`,
`persistent-isolated`, `Scenario Lab`, and `test-runner`. Hits:

- `README.md` (index link to the extension working-doc README only).
- `agent-working-doc-protocol.md` (protocol text).
- `module-size-governance-plan.md` (its own pair with the extension
  module-size plan, unrelated).
- `runtime-kernel-plan.md` (12 hits, all dated 2026-08-20, referencing the
  extension repository as the runtime kernel's "first validation target"; a
  different effort that predates this facility's 2026-09-04 start).

Two Core documents touch surfaces this document's 2026-09-05 audit changed
(`automation-studio-runtime-debug-ui-cleanup.md`, title "Automation Studio
Runtime Debug UI Cleanup", Status "Implemented; live browser review pending";
and `flow-initialization-router-ui-plan.md`, title "Flow Initialization And
Router UI Plan"). Neither is named or implied by the target as covering the
testing facility, and the Core-side Router/Subflow ownership work is recorded
inside the target itself (assigned to `core_invariants`, `core_ui_scope`, and
`core_failure_audit`) with no Core working document referenced. I did not read
those Core documents beyond their H1 and Status lines.

## The five facts an agent resuming this work most needs

1. Everything through Phase 12 is implemented and locally validated. Latest
   recorded gates: extension workspace `pnpm check`, `pnpm test`, `pnpm build`
   pass; test-runner 116/116; Core package check/build pass with 542/542 tests
   across 88 files; Core Automation Studio service 89/89 (2026-09-06).
2. Two live-certification gaps remain and both are caused by missing inputs,
   not missing code: the `existing` lane and the `clone` lane against a real
   external FluxIQ installation. The required variables
   (`FLUXIQ_TEST_BASE_URL`, `FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD`,
   `FLUXIQ_TEST_PIN`, `FLUXIQ_TEST_PROJECT_ID`, `FLUXIQ_TEST_FLOW_ID`, optional
   `FLUXIQ_TEST_GATEWAY_URL`/`FLUXIQ_TEST_TOTP`) are in the "FluxIQ target
   modes" section. Linux CI execution and the scheduled three-repeat baseline
   are also unexecuted.
3. The persistent demo lives at `test-runs/web-extension-demo` with its own
   isolated `fluxiq-root/.fluxiq` (it no longer attaches to the repository
   root installation), workspace schema `0.3` (parent Flow, Subflow, graph
   Flow, Router IDs), driven by `pnpm demo:setup-local`, `pnpm demo:record`,
   and `pnpm demo:run`. Both scripts use the real panel UI, including the
   **Generate deterministic Subflow** dialog and Runtime Debug in No LLM mode.
   Most recent successes (2026-09-06): recording
   `client.extension-bbe5ab04-3eca-415f-b64c-d0c54e135ad2.1788718034927`;
   runtime runs `8db01689-2074-4432-9551-130d301dd1a5` and
   `e23d811e-208d-4287-9815-780d67ec1548`; 37 balanced pairs / 74 screenshots
   each.
4. FluxIQ Core was changed on 2026-09-05 under this plan's "Top-level graph
   compatibility escape audit": Flow representation metadata is enforced,
   modern top-level Flows reject public graph writes, runtime must enter via
   Router and Subflow, a PIN-authorized legacy migration endpoint exists, edge
   upserts re-home `flow_id`, summary counts derive from completed detail, and
   Subflow navigation hydrates the graph before opening Nodes. The Execution
   Log rows saying "No FluxIQ Core files were changed" refer to the facility
   phases only.
5. Evidence policy is strictly event-only (one JPEG immediately before and one
   after every state-changing action; timed sampling and deduplication
   disabled). Phase 8 real-site execution and Phase 7 Core promotion are
   deliberately deferred; Phase 6 agent dispatch is human-triggered only; there
   is no reset/delete command for persistent workspaces (manual removal only).

## Internal contradictions or stale statements noticed

- The "Top-level graph compatibility escape audit" section says
  "Status: implementation in progress." (now line 1526), but the later
  "Final Implementation And Live Validation (2026-09-05)" section says
  "Status: complete for the requested parent Flow / Router / Subflow ownership
  fix and the two persistent-isolated demo scripts." (now line 1688). The
  earlier line is stale.
- Multiple passages state "No FluxIQ Core files were changed" (Execution Log
  Phase 7, 10, 12 rows; Phase 10 final; Phase 12 completion), while the
  2026-09-05 sections describe Core changes ("Core now owns and enforces
  explicit Flow representation metadata", "A graph-store defect found during
  live testing was also corrected", "Core now derives route-decision ...
  counts"). Accurate per phase, but the top-level Status sentence "The
  implementation is complete in this repository" no longer conveys that Core
  edits were made under this plan.
- Phase 9 Step 5 note: "Implementation is blocked in this execution because
  the active writable workspace is limited to `F:\!FluxIQWebExtension`;
  `F:\!FluxIQ` is read-only". Later Core edits show this constraint was
  execution-specific; it is stale as a description of the current state.
- Phase 12 execution update: "This is now an explicit Phase 12 blocker ...
  Live two-invocation acceptance remains in progress" is immediately followed
  by the same-day completion update resolving it. Stale if read alone.
- The "Phase 11 implementation note" and "Phase 11 live validation update"
  describe an existing-install workflow against "The repository-local FluxIQ
  panel ... at `http://127.0.0.1:3000`", but the later "Persistent demo
  isolation correction (2026-09-05)" states "the reusable demo scripts no
  longer attach to the repository-root FluxIQ installation." The earlier
  passages are stale.
- The original Status section mentions only the `existing` lane's pending
  certification; the Phase 10 rows record the identical gap for the `clone`
  lane. The new header block covers both.
- Planning sections ("Run bundle", "Capture triggers", "Evidence And Human
  Review") still describe PNG screenshots, deduplication, contact sheets, and
  "An optional 0.5-1 FPS sampler", whereas the implemented policy states JPEG,
  "timed sampling and deduplication are disabled", and "no periodic low-FPS
  capture remains." Planning text is stale relative to implementation.
- Screenshot pair counts vary across passages (24/48, 25/50, 26/52, 28/56,
  37/74). These are successive results rather than contradictions; the
  2026-09-06 figures (37/74) are the latest.
- The Execution Log Phase 11 row says "Real headless record and No-LLM
  playback passes are recorded below", and the detailed Phase 11 notes do
  follow the table, so this is consistent, but the Phase 12 heading and notes
  are interleaved before the Phase 9 step notes, so the log is not in phase
  order.

## Line count before and after, and lines inserted

- Before: `wc -l` = 1696.
- Inserted: 146 lines. Composition: 1 blank line after the H1, 8 header
  fields, 1 blank line, `---`, 1 blank line, then the `## Current State`
  section of 134 lines (from `## Current State` through its closing `---`,
  inclusive), which is under the 150-line limit.
- After: `wc -l` = 1842 = 1696 + 146.

Verification actually run:

- `wc -l` before (1696) and after (1842).
- A pre-change backup of the target was taken in the scratchpad. After the
  insertion: `cmp` of line 1 against the backup (identical); `cmp` of lines
  2-147 against the block file (identical); `cmp` of lines 148-1842 against
  backup lines 2-1696 (identical); and a whole-file reconstruction check
  (backup == target line 1 + target lines 148-end) passed.
- Byte size check: 102714 (original) + 9053 (block) = 111767 (final target).
- No CR characters in the block file or the final target (the original uses
  LF only).
- `git diff --stat -- docs/working/automated-testing-facility-plan.md` reports
  `146 insertions(+)` and no deletions. `git status --short` also lists other
  modified working documents and `AGENTS.md`; I did not touch those (they
  belong to other workers), and the only paths I wrote are the target and
  this report.

Honesty note on method: the first insertion attempt used `sed -i '1r block'`.
It produced the correct line count but the byte-level `cmp` of the preserved
body against the backup differed by one byte at original line 269. Rather
than trust it, I rebuilt the target with `cat` (backup line 1 + block + backup
lines 2-1696), which passed every check above. Only the target file and this
report were written; nothing was committed or pushed.
