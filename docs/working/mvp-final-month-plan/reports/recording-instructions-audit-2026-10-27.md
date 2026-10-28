# Recording plus mandatory instructions: audit and plan (2026-10-27)

## Outcome
Read-only audit. Only this file was written. No builds, tests, Lab runs, model calls, or fxwork lane trees touched. Not exhaustively verified: I did not open Core's generation path to confirm how linkedRecordingIds reach the prompt, and I did not run a merge test of t518 (merge-tree is blocked for workers).

## 1. What the MVP requires

Plan lines (30-Day MVP plan):
- Phase 3.3 (lines ~764-788): flow "Write Task Instructions -> Describe Optional Recording -> Record Demonstration -> Stop -> Attach Evidence -> Generate From Instructions -> Test -> Save". Exit: "Recording supports the written task without creating a standalone executable automation. Existing recordings remain readable and can receive descriptions."
- Final MVP Acceptance Test (line ~1366): step 5, "Create an instructed automation with an optional described recording", inside a clean-profile 13-step script (RC Nov 5-10), plus the 26 acceptance items.
- mvp-final-month-plan.md: line 154 table row "Phase 1b, after A-D: Other realistic tasks; recording plus instruction. Gate: Correct reusable outcome despite recording detours". Line 93: "Prove adaptation on three sites twice each, then the ten-site/68-task breadth plan, recording plus mandatory instructions". Line 116: evidence beside mandatory instructions, after A-D (done 2026-10-13).

Acceptance shape is NOT numerically defined for this proof anywhere. Only qualitative: a correct, reusable outcome (oracle-passing, later zero-model replay) despite recording detours (the recording contains extra or retried acts that must not be copied into the Flow), and the instruction outranks the recording. The sibling gates give the template: two creation passes per site, exact oracles, separate zero-call replay. I propose that shape (section 4).

## 2. What exists on dev

- Capture: extension recorder (`apps/extension/src/content/*`, `background/connection/active-recording.ts`, `recorded-event-intake.ts`, `recording-evidence.ts`; panel UI `panel/recording/**` with review/remove-step controls). New recordings require a description (t519).
- Automation relay (`apps/extension/src/background/automation-relay/automation-relay.ts:78-81`): `generateFromRecording` is retired and returns "Author task instructions in FluxIQ and optionally attach a described recording."
- Reaching a build: Core persists recording + description; Flow carries `linkedRecordingIds`; Core web `BlankFlowAuthoringPanel.tsx:64` `saveGenerationInstruction({..., instruction, linkedRecordingIds})`; Core's `AUTOMATION_STUDIO_SUPPLEMENTARY_RECORDINGS_INSTRUCTION` tells the model written instructions outrank recordings (docs/architecture/build-loop.md ~515); described linked recordings enter generation as untrusted supplementary evidence, validated for ownership/finalized/description before the provider call (instruction-led-automation-plan Current State, t519).
- Chat entry: extension chat starts builds (live-builds-start-from-extension-chat). I did not find a chat-side step that attaches a recording; attachment looks like a Core web panel / API path (`linkedRecordingIds`). Needs confirmation.
- Lab: NO lane builds from a recording today. `packages/test-runner/src/demo-workspace/creation-lanes.ts` and `blank-preparation.ts` assert the recorder is idle and the project's recording set is UNCHANGED (`assertRecordingSetUnchanged`, `recording.persistence` failures) across instruction-only creation. The standalone recorded `--flow` conversion lane is retired (docs/architecture/testing-facility.md lines 3-12). The default recording lane (`packages/test-runner/src/run-scenario.ts`, `core-round-trip/`) measures capture only, not generation. Manifests carry explicit fixture recording descriptions (42, independent of tasks). So a "recorded-input build" launch flag or task kind does not exist; it must be added.
- Existing specs: recording persistence/round-trip tests (`core-round-trip/tests`), `demo-llm-creation.test.ts`/`demo-llm-adaptation.test.ts`, extension recording-evidence/active-recording tests, Core web `task-instructions.test.tsx`. None exercises a build with an attached recording. Unit evidence of recording-instruction outranking is only in Core prompt text.

## 3. t518

- Branch `task/t518-recorded-recovery-state-routing` in both repos; worktree `C:/Users/osrs_/FluxStuff/fxwork/t518/{!FluxIQ,!FluxIQWebExtension}`. Merge base downstream 0d6a24e8 (2026-10-13). Downstream 12 commits ahead of dev (101 files, +2750/-42); dev is 896 commits ahead of it. Core 10 ahead of Core dev. Unmerged, unpushed.
- Changes: recorded-flow conversion/replay support: complete recording state capture for guarded recovery replay, settled terminal boundary capture before stop, historical route signatures/recorded-state projection, passive result facts as terminal-effect evidence, generated End role. All aimed at making a recording-ONLY converted Flow replay and recover. Its social replay still failed; no terminal success claimed.
- Conflicts: 896 dev commits plus t519 retiring recorded-only conversion, and domain/runtime/route-state, recording/web-state, extension background connection and recording files overlap; expect real conflicts (not tested).
- Needed for the proof? No. Existing triage (reports/codex-continuation-recovery-triage.md) says park it; only the generic SQLite long-path fix (Core e60bfbe0) was recommended for extraction, and the supervisor log says t520 delivered it. The proof is instruction-first generation with recording as evidence; nothing in t518 is that. One caveat: if a recorded run needs the recording's passive-evidence completeness (empty dialog/overlay capture) to be usable evidence, that is an optional separate unit, only if a failure points to it.

## 4. Plan

Principle: no hidden test bypass, no scenario-shaped guidance; the recording is a real capture on the scenario's own fixture, with its own description; instruction is the existing task text of an existing realistic task.

Phase 0 (supervisor, decisions; no code)
- Confirm the attach path: chat versus Core web panel `linkedRecordingIds` (one read-only worker, `worker-low`). Decide recording content design: a demonstration with deliberate detours (a wrong sort tried then undone, an extra filter click, a retry), so the proof can check "despite detours". Fixture goals must not leak into guidance.
- Pick tasks (existing, realistic, already audited achievable): one per site on three sites chosen from lanes already green on instruction-only builds (suggest A-D set sites: crossborder-marketplace, everything-store, plus one extraction site such as job-board; a scraping task needs nonempty expected rows per the 2026-10-17 rule). Final choice from the current breadth ledger; do not pick a task with an open wording fix.

Phase 1 (provider-free, parallel, file-partitioned)
- U1 `worker`: Lab runner support. Owns `packages/test-runner/src/demo-workspace/` (new `recorded-evidence-lane.ts`, small edits to `creation-lanes.ts`, `blank-preparation.ts`), `packages/test-contracts/src/` (a new optional manifest field naming a scripted demonstration plus its independent description; no oracle data in it), and adjacent `tests/`. Behavior: before the build, drive the scripted demonstration in the real extension (start with description, stop, finalize), link the new recording ids via the production save-instruction API (`linkedRecordingIds`) while the instruction text is the unchanged task; replace the unchanged-recording-set assertion with "exactly the expected recording, finalized, described, linked". Uses chat entry for the build itself.
- U2 `worker`: scripted demonstrations with detours for the chosen tasks. Owns `apps/scenario-lab/**` demonstration scripts and `packages/test-contracts` fixture data only if U1 does not own that path (otherwise serial after U1). One script per chosen task; one scenario per file.
- U3 `worker-low`: provider-free assertions that a described recording (a) never changes the task text, (b) cannot satisfy a missing-instruction gate (Core refuses before provider), (c) is rejected unlinked/undescribed/unfinalized. Mostly exists in Core t519 tests; this unit only runs `pnpm task`-style narrow tests in Core `packages/fluxiq` and records the output. No edits.
- U4 `worker`: oracle for "despite detours": a generic check over the built Flow's node list that no recorded detour act (wrong sort, extra filter) appears as an executed node, derived from the demonstration script's marked detour steps, not from product guidance. Owns `packages/test-runner/src/` new checker file plus tests.
- Gate: narrow tests for each unit, typecheck of touched packages, structure audit. Prove provider-free that the positive browser path reaches the oracle with the demonstration recorded (scripted browser path, no model), per the data-scraping rule.

Phase 2 (paid, supervised, single lane per site; max four slots, live lane trees synced to latest dev and rebuilt first, all agreed changes merged)
- Per chosen task: build from the extension chat with instruction plus attached recording; judged whole run; separate zero-call replay; two creation passes per site (matches adaptation gate). Cost: the $0.25 purse per Flow; stop at first balance error. Compare one control build of the same task without a recording only if a failure needs attribution.
- Pass criteria: oracle matches expected records; Flow reusable on zero-call replay; no detour act in the Flow; instruction wins when the recording demonstrates a different filter than the written task (one negative probe, provider-free where possible by a deliberately conflicting but achievable task wording, not a new realistic task).
- Also review the extension UI during each live loop (standing rule), including recording start/description/attach states.

Phase 3: record findings in the working doc, fix generic causes in Core/domain, requalify on changed source.

## Risks
- No attach step in the chat; UX gap could force a panel-driven attach, conflicting with "live builds start from the extension chat". Confirm in Phase 0.
- Detour demonstrations may expose that the model copies recorded acts: that is the point, but a failure needs a generic guidance fix (never mirroring the task).
- Recording completeness gaps (the t518 evidence-capture units) could surface; extract narrowly only on a proven failure.
- t518 if ever wanted: 896-commit gap; do not merge; cherry-pick narrow units only.
- Cost and time: two passes times three sites is about six paid builds plus replays; fit within the 68-task breadth schedule (breadth ends Oct 28, freeze Oct 29), so the proof competes for lane slots; I did not verify whether this is feasible in the remaining time.

## Commands run
Read-only: git branch/log/rev-list/diff --stat, ls, grep, sed over docs, tests, runner and extension source. `git merge-tree` was refused by the hook (not run).
