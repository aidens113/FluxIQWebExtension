# t196-wD: the web domain reports each call's state digests from its own captures

Worker report, 2026-09-29. Branch `task/t196-state-digest-cost`, worktree
`fxwork/t196/!FluxIQWebExtension`. Nothing was committed.

## Outcome

Partial. Tasks 1, 2 and 4 are done, and task 3 is answered with "no". The action
target of one capture per action is not met: an action still costs 2 captures,
not 1. Task 3 below explains why the read before the action was kept.

- Every result `executeTool` returns now carries `stateDigests`, digested from
  captures the call already took. The binding declares `stateDigestsOnCalls: true`.
- A test proves a call's digest equals what `captureStateDigest` returns for the
  same page. It covers call bounds of none, 2,500 and 9,000 bytes. At 2,500 bytes
  the packet was budget-truncated and a digest of that packet would have
  differed.
- Captures per decision, with Core no longer bracketing calls:
  - look: 3 → 1
  - action that runs: 4 → 2
  - action refused before acting: 3 → 1
  - detection: 3 → 1 page-wide, 4 → 2 around a target

## Captures per decision type

These are `web.dom.capture_snapshot` commands, counted by a gateway that records
every command.

- **Before** is Core's old protocol: `captureStateDigest` before the call, the
  call, then `captureStateDigest` after it.
  - It was measured on the HEAD source (`git show HEAD:` copies of the 7 changed
    files in a scratch copy of `domain/src`).
  - It was measured again on the new source, and the two agree.
- **After** is the new protocol. Core asks no digest because the binding declares
  `stateDigestsOnCalls`. The "action" counts exclude the action's own command.

| Decision type | Before (HEAD, digests around the call) | After (digests on the call) | Digests on the result |
| --- | --- | --- | --- |
| Look (`web.output.dom-capture_snapshot`) | 3 | 1 | before = after = its one capture |
| Action that runs (click) | 4 + click | 2 + click | before = read before acting, after = `captureAfterAction` |
| Action refused before acting (`target_unobserved`) | 3 | 1 | before = after = read before acting |
| `web.detect_repeating_structure`, page-wide | 3 | 1 | before = after = the detection capture |
| `web.detect_repeating_structure`, around a target | 4 | 2 | before = after = the binding read (`detect.ts:84`) |
| Dry-run replay step that ran | 0 | 0 | none (no page read) |
| Dry-run replay step that failed | 1 | 1 | after only (read after its command went out) |

Core never bracketed dry-run replays with digests. `runtime/flow-draft/` has no
digest call, so their "before" equals their "after".

Not in this table:

- The answer check Core makes for a look answered from memory
  (`answer-check.ts:38`, 1 capture). It is Core's, outside this brief.
- `captureStateDigest` itself (1 capture). It is kept for moments no call
  brackets.

## What changed and why

All paths are under `domain/src/runtime/llm-evidence/` (D).

- **`snapshot-state-digest.ts` (new)**
  - `webLlmSnapshotStateDigest(snapshot, bounded, maxEvidenceBytes)` returns the
    digest `captureStateDigest` would give. It re-sanitizes the same raw snapshot
    with the default exploration bound, no expected origin and no failed action.
  - When the call's own bound is the default (`maxEvidenceBytes` undefined), it
    digests the freshly sanitized packet directly.
  - It returns `undefined` only when even an empty packet exceeds the default
    bound (`evidence_budget_exhausted`), which `captureStateDigest` also refuses.
- **`sanitize.ts`**
  - Adds `WebLlmSnapshotBinding.stateDigest?`. It is internal to the domain and
    never part of a packet.
- **`capture.ts`**
  - `captureEvidence` digests every capture as soon as it is sanitized, before any
    caller writes on the packet.
  - Adds `stateDigests?: { before?; after? }` to `WebLlmEvidenceToolExecution`.
  - Adds `"stateDigests"` to `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`. Core's dist
    parser already accepts the key: `evidence-loop-decision.js:41`.
  - Adds `withCallStates(execution, found, left)`. It writes the digests onto the
    result and omits a side that has none.
- **`stable-handles.ts`**
  - `rewrite` (restamp) carries `stateDigest` through. The digest leaves `target`
    out, so renumbering cannot change it.
- **`node-run/run.ts`**
  - A look reports its capture on both sides.
  - An action reports `current` (`:222` read) as before and the
    `captureAfterAction` packet as after. After is absent when the page stayed
    unreadable.
  - `refusal()` reads two new fields on the call record:
    - `found`: the read before acting.
    - `acted`: set just before the node's command is dispatched.
  - Before is `found`.
  - After is the refusal's own page, or `found` when nothing was sent. When the
    command went out and no page came back, after is absent.
  - So "not there yet", invalid input and a navigate from nowhere report no
    before. The navigate reports after only.
- **`node-run/replay.ts`**
  - `answerWithPage` reports its one capture as after.
  - It reports that capture as before too only when the step's command never went
    out: the handle was refused before dispatch.
  - The capture is digested even when the packet is too large to return.
- **`structure/detect.ts`**
  - Adds an optional `observed` callback on the context. It is given the one
    whole-page capture: the target-binding read when a target was named,
    otherwise the page-wide detection capture.
  - Frame-scoped detection captures are not digested. They describe the frame's
    own document, not the page.
  - The recovery harness option leaves `observed` unset, so its results are
    unchanged.
- **`tools.ts`**
  - Declares `stateDigestsOnCalls: true` on the type and on the runtime.
  - A detection's result carries the observed page's digest on both sides. So
    does a refusal thrown after the read, in the `catch`.
  - `captureStateDigest` now returns `captureEvidence(...).stateDigest`, so the
    call digests and the asked digest share one code path.
- **Tests**
  - `tests/call-state-digests.test.ts` (new, 14 tests).
  - `structure/tests/detect.test.ts`: its `detect()` helper now deletes
    `stateDigests` before its whole-result `deepEqual` comparisons. Four of them
    failed otherwise, because refusals now carry a digest of each fixture page.
    The digests themselves are asserted in the new file.

Harness-option (runtime recovery) results do not carry digests. Core parses those
elsewhere, and the brief covers the build loop's `executeTool`.

## Task 3: reusing the most recent capture as the pre-action read

The pre-action read was not changed. It cannot be skipped and stay exactly as
correct, because "no command has run since" does not mean "the page is as last
read". Between the last capture and the action there is a whole model decision,
which takes seconds. In that time the page can change with no command from this
domain:

- A search or filter renders its results late.
- A navigation started by the previous click lands after `captureAfterAction`
  returned on the first readable document.
- A timer, a rate-limit redirect, or the person using the tab changes it.

The domain cannot see any of these without a capture. Each of the five
properties the brief names would then change:

1. **Handle resolution.**
   - `run.shown(current)` replaces that page's handle map in `targetPackets`
     (`plan-resolution/target-packets.ts`, `remember`).
   - Today a handle whose element has since left, or whose selector now matches
     several elements, is refused before acting: `parameters_not_resolved`
     (unknown) or `not_unique`.
   - With a cached page, resolution would use the stale map. The command would go
     out and fail on the page as `target_not_found`, or act on whichever element
     matches first.
2. **Permission judgement.**
   - `observedControl(current.evidence, …)` names the control that the person is
     asked about.
   - A stale page can name a control that is no longer the one the selector will
     hit.
3. **Replay location.**
   - `foundAt(current, …)` is written into the step's `replay.from` and is where a
     dry run resets to.
   - After a late client-side redirect, the cached location is the intermediate
     URL, and the replay would reset to the wrong page.
4. **Arrival.**
   - `currentPage` returns nothing until arrival (`arrival.ts`), and a cached page
     would have to respect that too.
   - This one is holdable, but it is the only one of the five that is.
5. **`pageChanged`.**
   - The flag compares `after` with `current`. With a cached `current`, a change
     the page made by itself during the decision would be credited to the action.

A capture is the only way to know the page did not move. So the choice is between
the read before acting and a less correct action, and I kept the read. The
remaining saving would have to come from Core, for example by not answering from
memory with a capture (`answer-check.ts`). That is outside this brief.

## Commands run and observed results

- **Narrow runs.**
  - Tool: my own script
    `scratchpad/t196-wd-narrow.mjs`. It bundles the named test entries
    exactly as `domain/scripts/test-domain.mjs` does, into
    `domain/.test-build-scratch/t196-wd-narrow/` (ignored by `.gitignore:24`),
    then runs `node --test`.
  - `call-state-digests.test.ts` plus `structure/tests/detect.test.ts`:
    `# tests 26  # pass 26  # fail 0`.
- **HEAD baseline counts.**
  - Same script, run on a scratch copy of `domain/src` with the 7 changed files
    restored from `git show HEAD:`, and a derived counting test.
  - All 7 decision rows passed with the "before" counts in the table: look 3,
    action 4, refused 3, detect 3/4, replay 0/1 (`# pass 7  # fail 0`).
  - The scratch copy was deleted afterwards.
- **Whole llm-evidence suite (all 47 `llm-evidence/**/tests/*.test.ts`
  entries).**
  - Command: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t196-wD llm-evidence suite" node scratchpad/t196-wd-narrow.mjs <47 entries>`.
  - First run: `# tests 349  # pass 345  # fail 4`. All four failures were
    whole-result `deepEqual`s in `structure/tests/detect.test.ts` that now saw
    `stateDigests`, and the test helper was updated.
  - After the fix: `exit 0`, `# tests 350  # pass 350  # fail 0  # cancelled 0`.
- **Domain type check.**
  - Command: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t196-wD domain check" pnpm --filter @fluxiq-web-extension/domain check`.
  - First run: `run.ts(238,5): error TS2412` under `exactOptionalPropertyTypes`.
    Fixed by typing `found?: WebLlmSnapshotBinding | undefined`.
  - Rerun: `exit 0`, `{"build-cache":"build","step":"domain:check",…}`. It
    covers both `tsconfig.json` and `tsconfig.test.json`.
- **Structure audit.**
  - Command: `node scripts/structure-audit.mjs`.
  - Result: `structure-audit: passed (124 warning(s), 120 baselined).`, exit 0.
  - No error-level findings.
  - Advisory warnings in paths I touched:
    - file lines: `capture.ts` 544, `node-run/run.ts` 724 (the hard limit is
      800), `tools.ts` 578 (it was 551), `structure/tests/detect.test.ts` 571.
    - `capture.ts` has 10 exported values against the advisory 8. It already had
      9; `withCallStates` is the tenth.
    - `llm-evidence/` holds 24 source files against the advisory 15. The hard
      limit is 25, and the new `snapshot-state-digest.ts` is the 24th.

## Not verified

- **Core with the flag.**
  - Core's loop change that skips `captureStateDigest` when
    `stateDigestsOnCalls` is set is another worker's. The dist I read has the
    types and the parser key, but I did not see the loop skip.
  - The "after" counts are therefore this domain's captures under that protocol.
    They were not observed through Core's loop.
- **Browser and live runs.** None were made, per the brief.
- **Extension-side snapshots.**
  - I did not check that a `capture_snapshot` with `detectStructure` and no frame
    returns the same `snapshot` as a plain capture. The page-wide detection's
    digest assumes it does.
  - If the extension's detection snapshot differs, a detection's digest would
    differ from a look's on an unchanged page.
- **Unrun suites.** The full unlabelled `pnpm --filter @fluxiq-web-extension/domain test`
  and `pnpm check` were not run. Only the llm-evidence subset was.

## Open questions or contradictions found

- **The brief says "a refusal carrying a page -> both from that page".** For a
  node that acted and then failed, I report `before` as the read before acting
  and `after` as the refusal's page. That page was captured after the attempt,
  and the failed command may have moved something. This matches what Core's old
  digests around the call would have seen.
- **Replay answers carry digests, but Core never reads digests on dry-run
  replays.** They cost nothing: no extra capture.
- **The recovery harness options' results do not carry `stateDigests`.** If
  Core's recovery exploration is also switched to trust `stateDigestsOnCalls`,
  those options would need the same treatment. `harness-options/execute.ts` is
  in D but outside what the brief named.
