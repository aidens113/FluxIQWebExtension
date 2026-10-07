# s45-i: overlay label and step naming (U-B3-3 remainder)

## Outcome

Done. A control that lays its words out on separate lines is now named "12 Double Rolls $16.47" in three
places:

- the step result's `control`;
- the draft's `does.target`;
- the chat and overlay heading. Both this and `does.target` come from `describeCall`.

The resolved element identity is unchanged. Its `visibleText` is still the captured "12 Double Rolls$16.47",
which the page compares.

## Root cause

I traced this against the live run `lab-runs/2026-10-06/run-mux6pndp-16feb842/steps`. Two separate paths read
the identity's glued text.

1. **`does.target`, the chat and the overlay, on every call that names a handle.**
   - Core's `flow-draft/entry.ts:200` writes `does` from `step.words`. Core's `flow-draft/step-words.ts`
     and `activity/observer.ts:254` both get those words by calling the domain's `describeCall`.
   - `describeCall` is `tools.ts:350`, which calls `webLlmCallWords` (`node-run/call-words.ts`). It resolved
     the handle through the packet store and named the control with `nameOf(resolved.element)`, which is
     `accessibleName ?? visibleText`. That is the captured, glued text.
   - So `does.target` was glued even when the press itself was named correctly. At step 0022 the result said
     `control: "12 Double Rolls"`, and the decision request at step 0039 shows `does: target: 12 Double Rolls$16.47`.
   - Nothing in the extension builds this label; it shows Core's activity sentence.
2. **`control` in the step result, through the identity fallback** (`node-run/observed-control.ts:50`).
   - The fallback runs when the look before the press does not describe the handle. In this run that was step
     0038, the call `rerun.11` after `replay: reset`.
   - The reset put the product page back at `/ip/.../418830127`, without `?variant=5510202`. The rerun
     pressed `t905`, a handle shown only on the `?variant=` page.
   - `target-packets.ts` resolves a bare handle against every remembered page, so `t905` resolved from the
     earlier look. `current.evidence` did not contain it, so the name came from the identity: glued.
   - The same fallback applies to any handle remembered under another location, or kept from an earlier look
     that was cut short.

## What changed and why

The approach: the resolution carries a display-only `words` value beside the identity, never inside it.

- **`plan-resolution/element-identity.ts`**: new `webPlanElementWords(element, identity)`.
  - It returns the identity's own name (`accessibleName ?? visibleText`), spelled as the packet's `readable`
    when the two differ only by spacing. The spacing rule is `webLlmReadableWords`.
  - It returns nothing when the identity has no name. That covers a secret control and a withheld name, so
    it never produces words the identity would not already carry. The header comment explains why.
- **`plan-resolution/target-packets.ts`**:
  - `PageTarget` and the `ok` resolution gain an optional `words`. It is set only when it differs from the
    identity's name, and checked again by `spacedName`.
  - In a bare merge of several pages, `words` is kept only when the pages agree and the words still respace
    the merged identity's name.
  - Resolutions for controls without `readable` are unchanged, so existing deepEqual tests still hold.
- **`node-run/call-words.ts`**: a control resolved from a shown handle is named `words ?? nameOf(element)`.
  A step that carries only its own `parameters.element` is still named as written, and no `words` key is
  read from parameters.
- **`node-run/observed-control.ts`**: `webObservedControl` takes an optional `shownWords`. The identity
  fallback respaces its name with `webLlmReadableWords({ readable: shownWords }, name)`, which changes the
  name only when it matches by spacing alone.
- **`node-run/run.ts`**: a new `shownWords(run, written)` resolves `firstHandle(written)` bare from
  `run.stores.targets`, as `describeCall` does, and passes the result to `webObservedControl`.
- **Tests**:
  - `node-run/tests/shown-handle-past-cap.test.ts` gains a run-level test. A button chip is shown at
    `?variant=`, and the look before the press, at the bare address, lacks it. The test asserts:
    - `describeCall` gives `{target: "12 Double Rolls $16.47"}`;
    - the result's `control` and `draft.control` give "12 Double Rolls $16.47";
    - `ranWith.parameters.element.visibleText` is still "12 Double Rolls$16.47".
  - `plan-resolution/tests/target-packets.test.ts` gains a test of `words` beside the glued `visibleText`.
    It also checks that a plain control has no `words` and that a password input is given no words and no
    name.
  - `node-run/tests/call-words.test.ts` gains a test:
    - a resolution with `words` names the control by them, for a press and for `describe_element`;
    - an identity-only step is named as written;
    - an injected `words` key on `parameters.element` is ignored.
  - The node-run tests folder is at 25 files, so no new file was added.
- **Line endings**: my edits had left the eight touched files as CRLF in the working tree. I converted them
  back to LF, and `git ls-files --eol` now shows `w/lf` for all eight.

## Commands run and observed results

- Fail-first, before any source change: `run-subset.mjs <domain> s45-i` on the two new tests, then
  `node --test` printed `# pass 6 # fail 2`.
  - The run-level test failed with actual `{ target: '12 Double Rolls$16.47' }` against expected
    `'12 Double Rolls $16.47'`. This was the `describeCall` assertion.
  - The target-packets test failed: `words` was undefined against expected `'12 Double Rolls $16.47'`.
- After the resolution and `call-words` changes, before the `observed-control` change: `# pass 7 # fail 1`.
  The run-level `control` assertion failed with actual `'12 Double Rolls$16.47'`, which confirms the
  `observed-control.ts:50` fallback path.
- After all changes, the subset printed `# tests 405 # pass 405 # fail 0`. It was 57 test files, listed in
  scratchpad `s45-i-files.txt`:
  - every `node-run/tests/*`;
  - every `plan-resolution/tests/*`;
  - every `page-view/tests/*` and `page-view/*/tests/*`;
  - every domain test that mentions `describeCall`, `webLlmCallWords`, `.control`, `webObservedControl` or
    `createWebLlmTargetPackets`.

  I ran it again after the LF normalization and got the same result. On the way, one run failed because my
  `t40` fixture collided with the next-page test's `known.t40`. I renamed the fixture to `t50`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`:
  - the first run exited 2 with TS2379, an `exactOptionalPropertyTypes` error at `observed-control.ts:64`;
  - after the fix it exited 0, and it exited 0 again after the LF normalization.
- `node scripts/structure-audit.mjs`: exit 0, `structure-audit: passed (172 warning(s), 118 baselined)`.
  None of the warnings is in a file I touched, apart from the existing advisory that `node-run/run.ts` is
  790 lines; it was 777 at HEAD.

## Not verified

- No live run, browser or Lab, per the brief. I traced the root cause from the recorded run's step files only.
- That the extension overlay shows nothing but Core's activity sentence. I relied on the s45-g report for that
  (`background/activity/headline.ts`) and did not read the extension.
- No full domain suite was run.

## Open questions or contradictions found

- **Steps named from their identity alone are still glued.** These are steps that carry no handle the build
  was shown, such as a test run's or dry run's steps and recorded nodes. `call-words.ts` names them from
  `parameters.element`, and the stored identity has no readable spelling. Fixing this needs one of:
  - a display field on the stored identity. That lives in `actions/types.ts`, which is Must-not-touch here,
    and the field would persist in the Flow;
  - a reverse lookup in the packet store by selector.
- **The step target `["div", "12 Double Rolls$16.47"]`** that s45-g mentions is built from the identity's
  `tagName` and `visibleText`. I left it unchanged, because the brief says `visibleText` must stay glued.
- Within this tree, `target-packets.ts` and `call-words.ts` also hold other uncommitted lane work: the
  reload renumber marks and the next-page naming. My edits sit on top of that work. I did not change it.
