# t195-w20b: the dry run and what the site remembers

Worker t195-w20b, 2026-10-01. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ` and downstream
`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension`, both on `task/t195-live-control-flow`.
"R/" is Core `packages/fluxiq/src/programs/automation-studio/runtime/`. "N/" is downstream
`domain/src/runtime/llm-evidence/node-run/`.

## Outcome

Partial: items 1 to 4 are done and validated. Only the optional `madeOptional` half of item 1 is not done, because
the brief said to skip it if no evidence exists, and none does.

- **remembered.** A replayed step whose target is missing while the page stands on that step's own
  `replay.from.location` now answers `core.replay.remembered`. It passes, and the step stays in the Flow unchanged.
  The dry-run line shows `replayed: "remembered"`.
- **reanchored.** A step can come back `unreproducible` right after a step that was not done again: verified,
  present, remembered, excused, or a conditional step that did not run. That step is now tried once more. The reset
  call goes out with the step's own `from`, and the step is then sent again. The outcome carries `reanchored: true`
  and the retry's own status and code. A blocking re-anchored step adds `core.replay.reanchored` to the issue codes.
- **Withheld gated act.** A verified step that declared `move_money`, `delete` or `send_or_publish` now excuses every
  later step that does not replay (`withheldBy`). Before, only the next step's move did this.
- **`DRY_RUN_INSTRUCTION`.** It now explains `remembered` and `reanchored`. It tells the model never to drop, rerun or
  reorder a remembered step. It offers dropping only for failed, changed or unreproducible steps.
- **madeOptional: skipped.** Neither the domain nor the extension records whether a pressed target sat in a dialog
  or overlay layer. What it would need is under "Open questions" (1).

## What changed and why

### Core (R/)

- `flow-draft/site-memory.ts` (new):
  - Holds the header for the whole rule: the defect, the four audits, `remembered`, `reanchored`, why it is not made
    optional, and why only the immediately preceding step counts.
  - Exports `AUTOMATION_STUDIO_FLOW_DRAFT_REPLAY_REMEMBERED_CODE` (`core.replay.remembered`) and
    `AUTOMATION_STUDIO_FLOW_DRAFT_REPLAY_REANCHORED_CODE` (`core.replay.reanchored`).
  - It has no imports, so it cannot form a cycle with `verify-only.ts`.
- `flow-draft/index.ts`: exports `site-memory.ts`.
- `flow-draft/dry-run.ts`:
  - The outcome gains `reanchored?: true`, and the `withheldBy` doc is widened.
  - The feedback line carries `reanchored: true`.
  - The issue codes add `core.replay.reanchored` for a re-anchored step that still blocks.
  - The header now separates `unreproducible` from `remembered`.
  - `DRY_RUN_INSTRUCTION` is rewritten as item 4 asks.
- `flow-draft/verify-only.ts`:
  - `automationStudioFlowDraftReplayOutcomeWord` returns `remembered` for a replay-mode outcome that has status
    `replayed` and the remembered code.
  - New `automationStudioFlowDraftStepWithholdsLater(step, next)`. It is true when the step moved the target (the
    existing next-step comparison), or when its declaration names a class for which
    `isAutomationStudioDestructiveActionConsequence` is true.
  - The declaration accepts a list or a comma string, read case-insensitively. Any other shape names no class.
  - The header's "next proposed step" wording is updated for both rules.
- `llm/node-tools/replay.ts`:
  - `remembered` joins `AUTOMATION_STUDIO_NODE_REPLAY_RESULT_CODES`.
  - `automationStudioNodeReplayStatus` maps it to `replayed` in replay mode and `failed` in verify mode. This mirrors
    `present`, which passes only a check.
  - `automationStudioNodeReplayStepCall` now sends `from` (the step's `replay.from`), as the verify call already did.
    That is how the host can tell remembered from unreproducible.
- `llm/node-tools/replay-draft.ts`:
  - The loop computes the conditional set once and uses `StepWithholdsLater`.
  - It re-anchors when all of these hold:
    - the step answered `unreproducible`;
    - no `withheldBy` is in force;
    - the step is not conditional;
    - the previous outcome left its effect undone (private `leftUndone`).
  - The re-anchor (private `reanchor`) sends `{replay:"reset", from: step.replay.from}` under
    `dryrun.N.P.reanchor`. If that reset answers `replayed` with `effectApplied`, it sends the same call again under
    `dryrun.N.P.again`.
  - A re-anchor happens at most once per step. If the reset fails, the step keeps its first `unreproducible` answer
    and blocks.
  - The page shown to the model is the retry's.
- `dry-run-gate.ts`: unchanged. `madeOptional` was not implemented.

**Design choice: Core drives the re-anchor, not the host.**
- Only Core knows the step order, so only Core can test "after a step that was not done again".
- Core's result parser takes exact keys (`evidence-loop-decision.ts`), so a host could not return two codes in one
  answer.
- Reusing the existing reset call needed no new wire key.

**Re-anchor precondition: the immediately preceding step only.**
- w19b's spec says "the step before it". The brief says "an earlier step".
- I chose the narrower reading. With "any earlier step", run 18's shape would be waved through: the steps reaching
  the product page were withdrawn, so add-to-cart replayed on the search results. One verified or present step
  anywhere earlier would re-anchor that add-to-cart onto its own page and pass it.
- With the narrower reading, every case in pickup still passes (see the test).

**Moved-target rule: still the next step only.** I did not widen it to "any later step" (w19d's C4 spec, step 2).
Almost every later step stands on another page, so every verified Add to cart would excuse every later failure.
Only the gated-class rule was added, which is the brief's item 3.

### Domain (N/)

- `missing-target.ts` (new): `webNodeReplayMissingTarget(run, kind, about, failure?)`.
  - It captures the page and compares `page.evidence.location` with the `from.location` sent back by Core.
  - On the step's own page it answers `remembered` for a step (`ok: true`, `effectApplied: false`), or `present`
    for a check (as before).
  - On another page, or where the location cannot be read, it answers `unreproducible`, with exactly the fields and
    wording both callers used before.
  - It replaces `verify.ts`'s private `missing` and `actedOnLocation`.
  - `about` is written field by field: the domain's contract-spread rule bans spreads under `llm-evidence`.
- `replay-answer.ts`: adds `remembered: "core.replay.remembered"`. The header now says "the same eight".
- `replay.ts`:
  - A `TARGET_NOT_FOUND` replay now goes through `webNodeReplayMissingTarget(run, "step", …)`. Every other failure
    is unchanged, and so is the person-needed wrap.
  - The header documents `remembered`, the `from` on a step call, and the reset's second use as a re-anchor.
- `verify.ts`: uses the shared module. Its header now says how the location is compared (whole), instead of
  "origin and path", which the code never did.
- `index.ts` is unchanged: the new module is internal, like `verify.ts`.

### Tests added or changed

- Core `R/llm/node-tools/tests/replay-draft.test.ts` (new). It uses a fake site that answers the way the domain
  does. Seven cases:
  - **Pickup after the real order** (w19b #1's list): Accept all and No thanks are remembered; Add to cart is
    verified; View cart is remembered; Save for later is present after a re-anchor; Continue to checkout is
    remembered; the guest link is remembered after a re-anchor; Retry is remembered; the slot and typings are
    replayed; Place order is verified; the extract is unreproducible but `withheldBy: 14`. The result is
    `ok: true`, with exactly the resets `dryrun.1.reset`, `dryrun.1.7.reanchor` and `dryrun.1.9.reanchor`.
  - The step call carries `from`.
  - **Apply:** `[type replayed, submit verified send_or_publish, confirm-person failed same page, extract
    unreproducible]` gives `ok: true`, both steps `withheldBy: 2`, and no re-anchor.
  - A step missing on another page after a replayed step blocks, with no re-anchor.
  - A step whose re-anchor reset fails blocks.
  - A step still missing after a re-anchor (a redirect) blocks. It was asked only once, and its issue code is
    `core.replay.reanchored`.
  - A verified `modify_existing` followed by a failing same-page step still blocks, and the same draft with
    `send_or_publish` passes.
- Core `R/llm/node-tools/tests/dry-run-gate.test.ts`, one new case: a remembered step passes the gate on the first
  completion. It stays `kept` with no routing, and is recorded with the remembered code.
- Core `R/flow-draft/tests/site-memory.test.ts` (new), six cases:
  - the word and verdict for `remembered`;
  - the instruction never offers dropping a remembered step (sentence scan);
  - the feedback for a re-anchored step and its issue codes;
  - `StepWithholdsLater` for gated words (list, comma and mixed-case strings);
  - `StepWithholdsLater` for non-gated words and the object shape;
  - `StepWithholdsLater` for a moved target.
- Domain `N/tests/replay-remembered.test.ts` (new), three cases:
  - remembered on the step's own page;
  - unreproducible elsewhere, with an unreadable `from`, or with no `from`;
  - a re-anchor: reset to the step's `from`, then the step again. This makes exactly one navigation, to that
    location, and the step then answers `remembered`.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/llm/node-tools`
  in `packages/fluxiq`: `Test Files 13 passed (13)`, `Tests 111 passed (111)`. Re-run after the revert check
  restored the files: `111 passed (111)`. After a final comment-only edit to `replay-draft.ts`, the `node-tools`
  directory alone: `Tests 43 passed (43)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w20b core tsc" npx tsc --noEmit -p tsconfig.json` in
  `packages/fluxiq`: no diagnostics, `exit=0`.
- `bash …/heavy.sh "t195-w20b domain check" pnpm --filter @fluxiq-web-extension/domain check`: both `tsc` passes
  (src and test) completed (`"build-cache":"build","step":"domain:check"`), `exit=0`.
- `node …/scratchpad/run-dir-tests.mjs domain w20b runtime/llm-evidence/node-run/tests` (downstream root):
  `tests 91, pass 91, fail 0`, before and after the revert check.
- `node scripts/structure-audit.mjs`:
  - Core: `passed (207 warning(s), 353 baselined)`. The only warning in my directories is
    `flow-draft/dry-run.ts: 12 exported values`. That file already had 12 exported values and I added none, so the
    207th warning (206 before) is not from my files.
  - Downstream, first run: 1 FAIL `[contract-spread]` in my new test, a conditional spread. I fixed it.
  - Downstream, re-run: `passed (140 warning(s), 118 baselined)`. Two new advisory warnings are mine: `node-run/` and
    `node-run/tests/` now hold 16 source files each, past the advisory threshold of 15.
- **Revert check.** I backed up my sources, wrote the `HEAD` versions in place, and removed the new source modules.
  Test files stayed. I ran the same commands, then restored the backups, and `git diff --stat` was identical.
  - Core: `Tests 14 failed | 97 passed (111)`. All 14 failures are the new cases (7 replay-draft, 6 site-memory,
    1 gate).
  - Domain: `tests 91, pass 89, fail 2`. The failures were "remembered, and passes" and "a re-anchor … remembered
    there". The third new case, "unreproducible elsewhere", passed while reverted. It pins behaviour that did not
    change, and the brief asked for it as the counterpart.

## Not verified

- No Lab run, browser or model call, per the brief.
- Whether the real bigbox `/checkout` renders, rather than redirecting, once the order has emptied the cart. If it
  redirects, the guest link's re-anchor lands on `/cart` and the step still blocks. That case is tested, but I did
  not check the scenario's routing.
- Whether a live model now keeps remembered steps and stops dropping them. The instruction says so; behaviour is
  unproven.
- Full Core or downstream suites: not run, per the user rule.

## Open questions or contradictions found

1. **What `madeOptional` would need.** No layer evidence exists at press time.
   - The click payload carries none (`apps/extension/src/content/actions/click.ts`, `action-runtime/results.ts`).
   - The step statement is only `{ from: { location }, produced: { records } }`.
   - The extension, when the resolved target is inside a layer `overlaysOverPage()` reports, would have to set a
     closed boolean `payload.pressedInLayer` in `click.ts` and `results.ts`. `rate-limit-notice.ts:89` already reads
     `probe.layers()` before the press.
   - The domain would read that flag in `webNodeReplayStatement` in `N/replay.ts`, which is my file. `run.ts:370`
     already passes `result.payload` into it, so no t223 file changes. It would record `produced.inLayer`, and
     `missing-target.ts` would answer a distinct code for an in-layer step on its own page (w19a's
     `core.replay.layer_absent`).
   - Core's `dry-run-gate.ts` would then set `routing: { kind: "optional" }` on that step after the replay, and put
     `madeOptional: [step]` in the feedback.
2. **The `remembered` rule is the one w19a B1 rejected.** It passes any replayed control missing from its own page,
   which "would also wave through a control that is really gone".
   - It is narrower than what w19a rejected: it applies only to replay-mode steps, and only on an exact location
     match.
   - A control renamed or removed on the same page will now pass the dry run and fail only at playback.
   - (1) would let Core tell an interruption from a page control.
3. **Call ids nothing else reads yet.**
   - `R/llm/evidence-progress/progress-trace.ts:87`'s `callIdOf` regex accepts only `dryrun.N.(P|reset)`, so the trace
     prints `-` for `dryrun.N.P.reanchor` and `dryrun.N.P.again`.
   - `R/activity/wording/tool-call.ts` titles the re-anchor reset "Putting the page back to where the Flow starts",
     which is wrong for a re-anchor.
   - `R/activity/observer.ts:38` words every dry-run code except `replayed` as "didn't work the same way again". That
     includes `remembered`, and it was already true of `verified` and `present`.
   - None of these files is mine.
4. **Re-anchor precondition.** I used the immediately preceding step (w19b) rather than "an earlier step" (the
   brief), for run 18's safety; see "What changed". If the lead wants "any earlier step", it is the `previous` line in
   `replay-draft.ts`, and it re-opens run 18's shape.
5. **C4 domain half.** w19d's frame `from` (C4 step 1, `from: { location, frame }`) is not done; it needs t223's
   `run.ts` call sites. The apply case passes here through the gated-class rule alone, which is w19d's "Core alone"
   fallback.
