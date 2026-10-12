# t462-d: web domain start state

## Outcome

Done. The web domain answers Core's optional `startState` binding method. It only reads the page, through the same passive capture `observeResult` uses (hidden elements included, no handles kept, no retained packet). It compares states as line multisets and leaves out dialogs and covering layers.

## What changed and why

New module `domain/src/runtime/llm-evidence/start-state/`, one exported thing per file, with a barrel:

- `schema-version.ts`: `WEB_START_STATE_SCHEMA_VERSION = "web-start-state.v1"`.
- `state.ts`: `WebStartState = { schemaVersion, location, title?, lines }`.
- `page-state.ts`: `webStartStateFromEvidence(evidence)`. It first drops interruptions, then writes the page view (`webLlmPageText`) from what is left and reads its handle-free element lines. After those come the non-rendered state rows, using the exact projection `result-observation/observe.ts` prints under PASSIVE NON-RENDERED STATE (JSON rows). Values come from the already-sanitized evidence, so sensitive values are screened the same way `observeResult` screens them; the test checks that a password value and selectors stay out.
- **Dialogs and layers: the capture can identify them, and they are left out.** An element is dropped when any of these holds:
  - `webIsLayer` is true for it (`isDialog`, a recognised cover `kind`, or `frontLayer`);
  - it has `inDialog`;
  - any described ancestor is such a layer.

  A `covered-by` entry that names a dropped layer is removed from the line it was on, so a page behind a consent wall reads the same as the bare page. Geometry-only membership (`webInLayer`'s box test) is deliberately not used, because a layer's box may span the whole page.
- `view-lines.ts`: `webViewLines(text)`. It gives the title and the handle-free element lines using the same rules as `state-diff/summary-lines.ts`:
  - `tN` becomes `t*` outside quoted words;
  - the `~` base is expanded;
  - structure markers are left out.
- `differences.ts`: `webStartStateDifferences(start, now)` lists, in order: `location: A -> B`, then `gone: <line>…`, then `new: <line>…`. It uses a multiset comparison and nothing is capped.
- `read-state.ts`: `webStartStateOf(start)` validates an opaque `start`. Anything that is not a well-formed v1 state gives `undefined`.
- `observe.ts`: `observeWebStartState(capture, input)`:
  - It checks for abort and validates the ids as `observeResult` does.
  - A malformed `start` returns `undefined` before any capture.
  - `start` is stripped before the capture request.
  - It returns `{ state, differs }`, with `differs` empty when no `start` was given.
- `tools.ts`: `startState?` is added to `WebAutomationLlmEvidenceRuntime`. `createWebAutomationLlmEvidenceRuntime` binds it next to `observeResult` with the same capture call: `captureEvidence(..., request.signal, undefined, { includeHidden: true })`, toolId `web.start_state`, and the same permission and signal pass-through.

**Why `state-diff` is not reused directly.** Importing `webStateSummaryLines` failed the structure audit's `import-cycles` rule. `state-diff/summary-lines.ts` imports the `llm-evidence` barrel, and the barrel now reaches `tools.ts` → `start-state` → `state-diff`. I don't own `state-diff`, so `view-lines.ts` mirrors its line reading, and its header says how to remove the copy. The multiset `leftOver` in `state-diff.ts` is not exported, so `differences.ts` has its own copy (8 lines).

## Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t462-d node scripts/test-domain.mjs llm-evidence/start-state` (from `domain/`): `# pass 7`, `# fail 0`. The tests cover:
  - same page gives differs `[]`, plus the commands sent;
  - a count change gives gone/new pairs for both the rendered and the hidden line;
  - entry order and repeat counting, with location first;
  - renumbered handles give an identical state;
  - a consent wall gives differs `[]`, and the unfiltered view is asserted to contain the wall and `covered-by`, so the test is not vacuous;
  - six malformed starts give `undefined` with no extra capture;
  - an aborted ask dispatches nothing.
- `DOMAIN_TEST_BUILD_LABEL=t462-d node scripts/test-domain.mjs llm-evidence/tests/result-observation` (existing binding test): `# pass 1`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check`:
  - First run refused because Core's dist was stale.
  - Ran `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in the Core worktree: Done, with fluxiq rebuilt.
  - Next runs found two type errors in my files (an `exactOptionalPropertyTypes` mismatch on `signal`, and test gateway typing). I fixed both.
  - Final run: "core-build: … is current with its source", exit 0. The build cache did not stamp it because Core source changed while it ran (other workers).
- `node scripts/structure-audit.mjs`: `structure-audit: passed (184 warning(s), 646 baselined)`. I fixed two problems along the way: the `import-cycles` failure described above, and `contract-spread` failures, which `present<T>()` and `Object.assign` in the test resolved.

## Not verified

- No live browser run. The tests use a fake gateway with sanitized snapshots.
- No Core-side caller exists yet in the worktree, so I have not exercised end to end how Core treats an answer or a rejection.
- Non-modal dialog descendants are dropped only when they are described children (`parent` chain) of the dialog. A non-modal dialog whose controls are not its described descendants would leave its controls' lines in.

## Open questions or contradictions found

- Capture failures (no connected session, unreadable snapshot) **reject**, as `observeResult` does. They do not answer `undefined`. The binding doc says "Undefined … when the domain cannot read its state". If Core's caller does not catch a rejection, the supervisor may want failures mapped to `undefined`. Aborts must still reject either way.
- The title is kept in `state`, but a title change on its own is not a `differs` entry, because the brief lists only location, gone and new.
- Recommended follow-up, outside this brief: change `state-diff/summary-lines.ts` to import `WEB_LLM_EVIDENCE_SCHEMA_VERSION` from `../llm-evidence/sanitize` and `webLlmPageText` from `../llm-evidence/page-view` instead of the barrel. That should break the cycle, so `start-state/view-lines.ts` could be replaced by `webStateSummaryLines`. I have not verified this.
