# Recording review control identity

Status: Complete - exact source/test paths frozen for supervisor verification.
Worker: trace_endings. Date: 2026-10-01. Tree: downstream t224.

Read Current State, exact released brief, frozen extension recovery audit finding5 and unchanged review-model/payload-parsing tests. Own only panel/recording/review/recording-review.ts and new owning tests/recording-review.test.ts, plus this unique report. Core Runtime paths remain frozen. Reducer, background, cancellation, caller, shared DOM helpers, all other source and shared documents remain untouched.

Source confirms draw replaces every action on every phase transition, including shared Done across analyzing/building timer. Plan: reproduce mounted node/focus behavior with local focus modeling; reconcile controls by ReviewAction with current copy/look/disabled/handler; focus a visible enabled remaining local action only when the disappearing control still owns focus in an active visible mounted card/document. Hidden dismissal has no external fallback or cancellation semantics.

Initial meaningful reproduction ran against unchanged source via label `codex t224 recording-review reproduce`: native1,16tests/14pass/2fail,449.9735ms. Both new mounted node/focus cases failed; unchanged model9/parsing5 passed. First correction `codex t224 recording-review first fix`: native0,16/16pass,385.6892ms.

Current source reconciles only removed/new ReviewAction buttons in-place, updates copy/look/busy, and keeps retained nodes/listeners. Removed action handlers cannot issue requests into a subsequent phase/review. Focus fallback checks ownership before redraw and again after removal, visible mounted ancestry and active document; Done dismisses presentation without external fallback/cancellation. Source/test frozen.

Expanded narrow run label `codex t224 recording-review expanded focused` observed native0: **3bundles/33tests/33pass/0fail/0skipped/0cancelled,1569.7264ms** (new component19, unchanged review-model9/payload-parsing5). Covers Done identity/focus through timer/completion/Test/Save; removed Generate/Test/Save local fallback; current retry copy and request IDs; one listener/duplicate suppression; passive redraw; external-field/inactive/hidden-document focus; hidden/inert/aria-hidden/CSS/detached ancestry; focus transferred during removal; dismiss/old-control/old-reply epoch fences; fresh preview IDs. All local data is synthetic.

Scoped semantic types currently active session10641 under label `codex t224 recording-review scoped types`, command `node C:/Users/osrs_/AppData/Local/Temp/codex-t224-recording-review-scoped-types.mjs`, downstream t224 workdir. External temp harness reads unchanged extension tsconfig and checks the two owned roots, separately reporting dependency diagnostics; no repository config/baseline/build output edits. Resume by polling the worker-local session or rerunning exact command through heavy if unavailable. Owned git diff --check observed native0; unchanged model/parsing files have no diff.

Initial scoped session10641 observed native1:3 owned/global and7 dependency diagnostics, all missing Node ambient/module definitions. Harness ran with repository-root current directory, while pnpm-filter extension checks run inside apps/extension, where @types/node is installed. Corrected only external harness current directory to the actual extension package before constructing the unchanged strict compiler program; source/config/types were not relaxed. Corrected scoped rerun label `codex t224 recording-review corrected scoped types` is now pending; the earlier pending paragraph records historical state.

Narrow harness: external temp `C:/Users/osrs_/AppData/Local/Temp/codex-t224-recording-review-focused.mjs` bundles only new recording-review plus unchanged review-model/payload-parsing into ignored `apps/extension/.test-build-scratch/codex-t224-recording-review`, then native node --test with source maps. No full runner or shared scratch/helper edits. No broad/live/provider/panel/commit/push.

Resumed validation worker: recording_controls, 2026-10-01. Re-read Current State, released brief, existing source/test and this report. Existing two final cases were already saved: obsolete response during a fresh review and unsupported completion retain current controls/focus. No implementation or test edits were needed in this resumed turn.

Observed resumed narrow command label `codex t224 recording-review resumed focused`: native0, **3 bundles / 35 tests / 35 pass / 0 fail / 0 skipped / 0 cancelled, 577.1425ms**. Includes 21 new component cases and unchanged review-model9/payload-parsing5.

Observed resumed scoped command label `codex t224 recording-review resumed scoped types`: native0, **2 source/test roots; 0 owned/global diagnostics; 0 unowned dependency diagnostics**. External harness uses the actual unchanged extension tsconfig and package cwd. No compiler/config/baseline relaxation.

Observed existing shell integration command label `codex t224 recording-review shell integration`: native0, **4 bundles / 45 tests / 45 pass / 0 fail / 0 skipped / 0 cancelled, 552.5576ms**. External variant `TEMP/codex-t224-recording-review-shell.mjs` adds the unchanged actual mount-panel-navigation suite to the same narrow harness. Real shell construction, passive redraw, explicit navigation, naming and focus contracts pass under its existing local DOM model. No shared fake-DOM helper edits; this remains Node modeling, not live browser certification.

Owned `git diff --check` passed native0. Exact recording-review.ts and new tests/recording-review.test.ts are frozen. Source/model/parsing/background/caller unchanged beyond the previously released two-path implementation. No broad gates, live/browser/provider/panel operation, commits, pushes or Claude changes performed. Supervisor owns independent source review, root checks and integration.
