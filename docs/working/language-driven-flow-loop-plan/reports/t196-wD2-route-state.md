# t196-wD2: the web domain reports each call's route state from the capture it already took

## Outcome

Done. Every llm-evidence execution result that holds a capture of the page the call left now carries `routeState`. The value is exactly what the host's `observeRouteState` returns for that page, and the call sends no extra command. All tests, the domain check and the structure audit pass. One existing test's invariant had to be narrowed; see "Open questions".

## What changed and why

- `domain/src/runtime/llm-evidence/snapshot-states.ts`: renamed from `snapshot-state-digest.ts` (plain `mv`, not `git mv`). `webLlmSnapshotStateDigest` is replaced by `webLlmSnapshotStates(snapshot, bounded, maxEvidenceBytes)`, which returns `{ stateDigest, routeState }`.
  - Both values come from one packet sanitized at the default exploration bound, with no expected origin and no failed action. That is the same packet `captureStateDigest` uses, and the same one `observeRouteState` gets from `sanitizeWebLlmSnapshot(snapshot)` with `{}` options: `budgetFor({})` is the exploration default.
  - When the call's own bound is that default, the packet the call already made is reused. Otherwise the capture is sanitized once more.
  - If the page is too large even for an empty packet (`evidence_budget_exhausted`), both values are `undefined`.
  - `routeState` is `webAutomationRouteState(page)`, imported from the `../route-state` barrel. route-state only imports a type back from llm-evidence, so there is no runtime cycle.
- `sanitize.ts`: `WebLlmSnapshotBinding` gains `routeState?: JsonObject`. Because it is built through `present<>`, every site that builds a binding has to name the new key or fail to compile.
- `capture.ts`:
  - `WebLlmEvidenceToolExecution.routeState?: JsonObject` is added and documented.
  - `"routeState"` is added to `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`. I checked that Core dist's `evidence-loop-decision.js` `exactKeys` list already contains it.
  - `toolExecution` names `routeState: undefined`.
  - `withCallStates` writes `routeState` from the `left` binding only, so an action's read before acting is never used.
  - `captureEvidence` computes both values at capture time, before any caller writes on the packet.
- `structure/detect.ts`: the same computation, only for a top-frame detection. A detection inside a frame reads the frame's own document, so it gets no route state, just as it gets no digest.
- `stable-handles.ts`: renumbering carries `routeState` through unchanged (the route state reads no handle).
- `tools.ts`: one comment now points at the renamed file (edited with sed on line 408 only, because the file contains a byte grep treats as binary).

Where each decision gets its route state:
- **Look:** its one capture.
- **Action:** the capture after acting (`current, after`).
- **Refusal:** `page ?? (acted ? undefined : record.found)`, so a refusal before acting reports the page it refused on.
- **tools.ts refusal path:** `page ?? observed`.
- **Detection:** its capture.
- **Dry-run replay step that captured:** that capture (`replayStates`).
- **Nothing read:** the key is absent.

Tests:
- New `llm-evidence/tests/call-route-states.test.ts`, 15 tests. The oracle is the real `createWebAutomationHostRuntime(...).observeRouteState`, fed the same fake page.
  - A look's route state deep-equals the host's at bounds undefined, 2500 and 9000. At 2500 the test also proves that projecting the trimmed packet would differ.
  - A page with a dialog and a blocker gives `dialog` and `blockedBy`, and a refusal on that page reports the same value.
  - An action reports the page it left and not the page it found.
  - A refusal before acting, after the page changed, reports the newly read page and not the one shown by the earlier look.
  - A failed action reports the page captured after the attempt.
  - A detection reports its page, both when it answers and when it refuses. A malformed input reports nothing.
  - An unknown node reports nothing and takes 0 captures. Navigating from nowhere reports the page it arrived on.
  - A command-counting table asserts capture counts per decision: look 1, action that ran 2, refused before acting 1, page-wide detection 1, detection around a target 2, replay step that ran 0 (no route state), replay step that failed 1. These are the same counts `call-state-digests.test.ts` pins.
- `structure/tests/detect.test.ts`: the `detect()` helper already stripped `stateDigests` before deep-equal. It now strips `routeState` too, mirroring the digest work.
- `tests/tool-rejection-detail.test.ts`: see "Open questions".

## Commands run and observed results

- Narrow runner, new test only: `T196_OUT=t196-wd2 bash .../heavy.sh "t196-wD2 narrow route-state test" node .../t196-wd-narrow.mjs runtime/llm-evidence/tests/call-route-states.test.ts` printed `# tests 15 # pass 15 # fail 0`.
- Mutation check, reverted afterwards: I made the helper read the call's own bounded packet and made `withCallStates` report `found`. The run printed `# pass 11 # fail 4`; the failures were the bound test, the action-left test, navigate-from-nowhere, and replay-step-failed. The tests discriminate.
  - While restoring, a copy of `capture.ts` was briefly written to `domain/capture.ts` because the `cd` was wrong. I confirmed it byte-identical with `cmp` and deleted it, and confirmed both sources were restored (`git status` is clean of strays).
- All 49 `llm-evidence/**/tests/*.test.ts` plus `runtime/tests/host-runtime.test.ts` (the only other route-state test; `route-state/` has no tests directory), through the narrow runner:
  - First run: `# tests 383 # pass 378 # fail 5`. Four failures were `detect.test.ts` deep-equals that now included `routeState`. One was `tool-rejection-detail` "no refusal carries a word of the page" (`Schedule post true !== false`).
  - After the fixes, and again after the audit fixes: `exit 0`, `# tests 383 # pass 383 # fail 0 # cancelled 0`.
- `bash .../heavy.sh "t196-wD2 domain check" pnpm --filter @fluxiq-web-extension/domain check` printed `"step":"domain:check" ... "ms":10761` and exited 0. It also exited 0 before the audit fixes.
- `node scripts/structure-audit.mjs`:
  - First run: exit 1 with 2 FAILs, both mine: a conditional spread in the test fixture, and a deep import `../route-state/project`. I fixed both.
  - Final run: exit 0, `structure-audit: passed (124 warning(s), 120 baselined).`
  - The warnings on my files are advisory and were already past threshold before this change: `capture.ts` is 569 lines against a 400 threshold (it was 544), and `llm-evidence/tests/` has 24 files against 15.

## Not verified

- Core consuming `routeState`: that belongs to another worker. I did not build or run Core.
- Harness-option results (`harness-options/execute.ts`, the runtime failure-exploration path) do not carry `routeState`, and they do not carry `stateDigests` either. I mirrored the digest work, which left them alone.
- No full `pnpm check`, `pnpm test` or `pnpm build`, and no Lab or browser runs (per the brief).

## Open questions or contradictions found

1. **A refusal's result now carries page words.** `tool-rejection-detail.test.ts` asserted that the serialized refusal *results* contain no page word. `routeState` is page words by construction: the title, and `page.controls` (control names). The brief requires it on refusals. I narrowed that one assertion to everything on the result except `routeState`, with a comment saying why. Everything else is still checked: `evidence`, `detail`, `resultReason` and `draft`.
   - I did not weaken the guard on what the refusal *says*. But the execution result as a whole now carries the same projection Core used to fetch itself with `observeRouteState`.
   - Supervisor to confirm this is acceptable, or say where Core must keep `routeState` away from the model-visible or trace-visible refusal.
2. The file was renamed `snapshot-state-digest.ts` to `snapshot-states.ts` without `git mv`. The supervisor should stage the deletion and the new file together.
