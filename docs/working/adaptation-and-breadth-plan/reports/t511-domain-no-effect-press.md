# t511 domain half: a press that changed nothing (worker report)

## Outcome

Partial. Everything the brief let me edit is done and tested. The fix still
has to be wired into `domain/src/runtime/llm-evidence/node-run/run.ts`, which
the brief did not give me. Adding the outcome fields to `outcome.ts` also needs
that run.ts change. `present<WebNodeOutcome>` makes every optional key a
compile error until the call site writes it, so I reverted my `outcome.ts`
edit to keep the tree compiling. Both changes are written out below, ready to
apply.

## Cause, proved from the run's views

The cause is in `node-run/run.ts:runWebOutputNode`, line 424:

    const changed = after === undefined ? undefined : current === undefined || JSON.stringify(after.evidence) !== JSON.stringify(current.evidence);

This compares the two packets whole, including each element's `box` and
`onViewport` and the viewport's `scrollY`. In run `run-mv6qrcdu-a31b44b8`,
`diff 0036-tool-core.run_node/page.txt 0038-tool-core.run_node/page.txt`
(the look before the Apply press against the look after it) shows only these
differences:

    3c3  VIEW ... scrolled to y=151   ->   VIEW ... scrolled to y=170
    25d24 / 29a29   "--- on screen ---" marker moved
    60d59 / 62a62   "--- below the fold ---" marker moved

`t467 dialog "Change location"`, `t471 select "Radius" ="10 miles"`,
`t482 button "Apply" marked` and the chip `t283 "Kelford · Within 20 mi" open`
are identical on both sides. So 0038 answered `status: "succeeded"` and
`pageChanged: true` (a 19-pixel scroll) with no `changed` list, and the
existing `unchangedPress` ("press the same control once more") never fired,
because it requires `pageChanged === false`. The extension's click result is
not at fault: it says the click landed on the target (`validation.actual: "the
point 238,379 landed on the target"`), which was true.

## What changed and why (owned files)

- `node-run/press-effect/no-effect.ts` (new): `webPressNoEffect(node, before,
  after, handle, presses)`. **Definition of no effect:** the node dispatches
  `web.dom.click`; both looks exist; neither capture is truncated; the look
  after is not `busy` or `pendingNavigation`; the location, title and
  `navigation.timeOrigin` are the same; no loading indicator came up; the same
  element handles appear in the same order, wordless and hidden ones included;
  and every page-view line (`page-view/line/facts.ts`, through the existing
  `webPageChangeWalk`) has the same words and state tokens. Those tokens
  include value, checked/unchecked, open/closed (aria-expanded), pressed
  (aria-pressed), selected, current, marked, disabled and select options.
  Only these are set aside: element geometry and on-screen position (they are
  not line facts), `focused`, `covered-by …` and `covers N`. A toggle that
  only flips aria-pressed, a disclosure that only opens, or a counter whose
  text changes therefore stays a success. The sentence names the control, then
  the open dialog it is in (the nearest ancestor with `isDialog`, through
  `inDialog` and `parent`) as still open, and tells the model to treat the
  press as having done nothing.
- `node-run/press-effect/settled.ts` (new): `webPressSettled(node, before,
  after, handle, steps)`. This is the press's own retry. When the first look
  shows no effect, it looks again every 250 ms for up to 1.5 s. Then it presses
  once more, through `steps.pressAgain`, which the caller leaves out when the
  call declared a lasting consequence, and waits the same way again. Only then
  does it return `noEffect`. If the second press changed the page, it returns
  `pressedAgain` instead. A look that comes back unreadable ends the wait,
  because the page has gone somewhere. The total wait is at most 2 x 1.5 s.
- `node-run/press-effect/press-words.ts` (new): `webPressedControlWords`, the
  one way both sentences name the control, e.g. `"Save" (t6)`.
- `node-run/press-effect/index.ts`: exports the three new functions and the
  types.
- Tests (fail-first, generic "Display settings" dialog with no scenario words):
  - `press-effect/tests/no-effect.test.ts`: 9 unit tests of the definition:
    scroll-only, focus only, the dialog closing, aria-pressed, aria-expanded,
    checked, a value, a text change, a wordless element appearing, a new
    address, title or document, loading, truncation, a missing page, and a
    node that is not a press.
  - `press-effect/tests/press-settled.test.ts`: 7 tests of the wait, the second
    press, the hold-back and the bounds, on a fake clock.
  - `press-effect/tests/no-effect-press.test.ts`: 4 tests through the real
    runtime on a stub page that scrolls 19 px with every press. 3 of them stay
    red until run.ts is wired.

## Commands run and observed results

- Fail-first, before the modules existed:
  `DOMAIN_TEST_BUILD_LABEL=t511-domain node scripts/test-domain.mjs press-effect/tests/no-effect-press`
  -> `not ok 1` (expected `'no_effect'`, actual `'succeeded'`), `not ok 2`,
  `not ok 3`, `ok 4` (toggle); `# pass 1  # fail 3`. This reproduces 0038.
  The unit tests failed to build: `Could not resolve "../no-effect"` and
  `"../settled"`.
- After the change:
  `DOMAIN_TEST_BUILD_LABEL=t511-domain node scripts/test-domain.mjs press-effect/tests`
  -> `# tests 59  # pass 56  # fail 3`. The only failures are
  no-effect-press tests 12-14, which need the run.ts wiring. All earlier
  press-effect tests and the 16 new unit tests pass.
- `npx tsc -p tsconfig.json --noEmit` (domain) -> exit 0;
  `npx tsc -p tsconfig.test.json --noEmit` (domain) -> exit 0.
- `node scripts/check-extension.mjs` (apps/extension) -> exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (193
  warning(s), 646 baselined)`. The first run failed on a conditional spread in
  my e2e test, which I then fixed.

## Not verified

- The run.ts wiring and the `outcome.ts` fields below are not applied, not
  typechecked and not run.
- On real sanitized captures, the judgement was exercised only by the e2e
  test, which cannot reach it until the wiring is in. The unit tests use
  hand-built fixture packets.
- No Lab or live run. I did not check whether the fixture's "second press
  applies" control actually takes on a second press.
- Playback: a saved Flow's press step presses once. A page that needs two
  presses would need the same settle logic on playback. That is Core or
  runtime-adapter territory and is not done.

## Open questions or contradictions found

1. The brief assumed the outcome is assembled in `outcome.ts`. It is only the
   type: the assembly, the `changed` comparison and the dispatch are all in
   `run.ts:runWebOutputNode`, which I do not own.
2. The tool execution stays `ok` with `web.action.succeeded` and `addable`. A
   distinct result code would touch `vocabulary.ts`, `packages/test-runner` and
   Core's loop. The model-visible `status` becomes `no_effect`.
3. `llm-evidence/tests/press.test.ts` ("reports a press that changed nothing
   ...", line 231) asserts one click and `unchangedPress`. It must be updated
   with the wiring, and every test that presses an unchanging stub page will
   take up to about 3 s more.

## Continuation (coordinator granted run.ts, outcome.ts, press.test.ts)

### Outcome

Partial. The wiring is applied, and every file I own passes. Ten tests in four
files I do not own now fail. Each one counts the presses sent to a stub page
that never changes when pressed, and the new behaviour presses such a control
a second time on purpose. They need their expected counts updated, or their
stubs changed so a press changes something.

### What changed

- `node-run/press-effect/unchanged-page.ts` (new): `webPageUnchanged(before,
  after)`. This is the definition of "the same page", taken out of
  `no-effect.ts` so that `pageChanged` and the no-effect judgement read one
  rule. The pages must have the same address, title and document (`timeOrigin`
  where both have one), the same busy, navigating and loading-indicator state,
  and the same elements by handle and in the same order. Every page-view line
  must have the same kind, words and state tokens, with `focused`,
  `covered-by …` and `covers N` set aside. Geometry and scroll are not line
  facts. `no-effect.ts` now uses it, and adds that both captures were whole
  and the page is not still loading.
- `node-run/run.ts` (`runWebOutputNode`, 776 lines, budget 800):
  - The look after the act goes through `webPressSettled`. For a press that
    changed nothing, it waits up to 1.5 s, presses once more through
    `webNodeDispatchWithRetries` unless `declared` holds a non-empty
    consequence, and waits up to 1.5 s again.
  - Line 424 now reads `changed = current === undefined ||
    !webPageUnchanged(current.evidence, after.evidence)`, replacing the
    whole-`JSON.stringify` comparison. Position, scroll and focus alone are
    therefore not a change, for every node.
  - The outcome now sets `status: "no_effect"` when `noEffect` is said, and
    carries `noEffect` and `pressedAgain`. `unchangedPress` is said only when
    no `noEffect` is.
- `node-run/outcome.ts`: the new fields are in
  `WebNodeRanOutcome = WebNodeOutcome & { noEffect?; pressedAgain? }`, which
  both of run.ts's outcome literals use. I did not add them to
  `WebNodeOutcome` itself, because `present<WebNodeOutcome>` would then force
  `written-step.ts` (not owned) to write them, and a written step presses
  nothing.
- `llm-evidence/tests/press.test.ts`: the coordinator's message said
  `node-run/tests/press.test.ts`, which does not exist; this is the file whose
  line 231 the report named. The test "a press that changed nothing" now
  expects `status: "no_effect"`, `pageChanged: false`, a `noEffect` sentence
  saying "was pressed twice", no `unchangedPress`, and the clicks
  `["#inert", "#inert"]`.
- `press-effect/tests/no-effect-press.test.ts`: the lasting-consequence case
  now declares `["modify_existing"]`. The free-text consequence it had before
  was refused as a call, so that test was not reaching the press.

### Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t511-domain node scripts/test-domain.mjs press-effect/tests`
  -> `# tests 59 # pass 59 # fail 0`.
- `... test-domain.mjs llm-evidence/tests/press.test` -> `# tests 12 # pass 12 # fail 0`.
- `... test-domain.mjs press-effect/tests node-run/tests llm-evidence/tests/press.test node-run/retries/tests`
  -> `# tests 339 # pass 329 # fail 10`, all in files I do not own, all on
  the number of presses:
  - `node-run/retries/tests/dispatch.test.ts`, 3 tests: "an exploring press
    the page turned away as busy ..." (`[1,2]` -> `[1,2,3]`), "... succeeds on
    the fourth attempt" (`[1,2,3,4]` -> `[1,2,3,4,5]`), "a press answered once
    ..." (`[1]` -> `[1,2]`).
  - `node-run/tests/covered-press.test.ts`, 3 tests: "a timed popup opens over
    the control ...", "a layer that opens beside the page ... (C2)", "an
    element that merely overlaps the control ...". The last click is now
    repeated.
  - `node-run/tests/run.test.ts`, 2 tests: "a node run reads a handle written
    the old way, `target.N` ..." (`#go` x2 -> x4), and "write must be a
    boolean ..." (line 342: `2 !== 1`).
  - `node-run/tests/shown-handle-past-cap.test.ts`, 2 tests: "a handle from
    the packet just shown is pressed ...", "a control pressed from an earlier
    look ..." (one click -> two).
  Each of these stubs answers a click with an unchanged page. I recommend
  making each stub's press change something, such as a status line, so these
  tests keep testing what they were written for and do not pay the up-to-3 s
  settle wait. Updating the expected counts also works. I did not edit them,
  because they are not mine.
- `npx tsc -p tsconfig.json --noEmit` -> exit 0;
  `npx tsc -p tsconfig.test.json --noEmit` -> exit 0 (domain).
- `node scripts/check-extension.mjs` -> exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (193
  warning(s), 646 baselined)`. The first run failed with `statement-packing`
  at run.ts:416 (the sleep lambda), which I then unpacked.

### Not verified

- The full domain suite was not run. Tests elsewhere that press an unchanging
  stub page will also see a second press, a `no_effect` status and up to 3 s
  of extra wait.
- No Lab run, so 0038's real page has not been seen judged as no effect.
- On playback, a saved Flow's press still presses once.

## Continuation 2 (test stubs; coordinator granted the four test files and node-run tests)

### Outcome

Partial. Every node-run test passes, and in node-run only the tests that are
meant to wait still go through the settle wait. Four tests in
`llm-evidence/tests` fail. They are outside node-run and outside what I was
granted, so they are listed below and not edited.

### What changed

Every changed stub now changes something visible when pressed (a status line,
a press counter or a cart line), so each test still checks what it was written
for, pays no settle wait and gets no second press. No expected press count was
raised.

- The four granted files:
  - `node-run/retries/tests/dispatch.test.ts`: a "Coupon collected" status
    line once a press lands.
  - `node-run/tests/covered-press.test.ts`: a status line set by the store
    button and by the product link.
  - `node-run/tests/run.test.ts`: a "Pressed N times" line. The list-page
    caller passes `0`.
  - `node-run/tests/shown-handle-past-cap.test.ts`: a status line that
    appears only after a press, so the first look's `PAGE_LENGTH` still
    holds.
- Other node-run files, under "fix them the same way if they are in node-run".
  A probe found each one going through the settle wait:
  - `node-run/held-literals/tests/memory.test.ts`
  - `node-run/tests/arrival.test.ts`
  - `node-run/tests/cleared-wait.test.ts`
  - `node-run/tests/draft-control.test.ts` (`stub`, `popupStub`, `storeStub`)
  - `node-run/tests/replay.test.ts` (the status line is appended to whatever
    elements a test supplies)
  - `node-run/tests/unwritten-consequences.test.ts`
  - `node-run/retries/tests/effect-check.test.ts`, `lasting-act.test.ts` and
    `uncertain-outcome.test.ts` (a cart line counting every command sent)
- Tests that really are about an unchanging page now assert the new outcome:
  - `node-run/press-effect/tests/press-changes.test.ts`, "a press that changed
    nothing, a look and a navigation say no changes": `status` is
    `"no_effect"`.
  - `node-run/press-effect/tests/press-choice.test.ts`, "a press that left the
    pressed control's choice as it was says nothing about a choice": both
    presses are `"no_effect"`.
  - `llm-evidence/tests/press.test.ts` (from continuation 1) and
    `press-effect/tests/no-effect-press.test.ts` were already asserting it.

### How the remaining waits were found

I temporarily added a `console.log` to `press-effect/settled.ts`. It printed
the pressed control and the calling test file from the stack, and I ran the
whole llm-evidence directory with it. I restored the file afterwards:
`grep -c T511 settled.ts` gives `0`. On the last probe run, the only node-run
tests that went through the wait were `press-settled` (unit), `no-effect-press`,
`press-changes`, `press-choice` and `press.test`, all intended.

### Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t511-domain node scripts/test-domain.mjs llm-evidence/node-run/`
  (node-run with press-effect and retries) -> `# tests 343 # pass 343 # fail 0`,
  exit 0.
- `... test-domain.mjs llm-evidence/tests/` -> `# tests 205 # pass 201 # fail 4`:
  - `tests/page-refusal.test.ts` "a press behind a modal is refused
    blocked_by_dialog ... can be pressed next" (`#open-search` pressed one
    more time).
  - `tests/tool-rejection-detail.test.ts` "a node given a control it cannot
    act on is told which node can ..." (`#store-7 button` pressed twice).
  - `tests/tools.test.ts` "presses any observed control, refuses only a handle
    it never showed ..." (`#submit` and `#action` each pressed twice).
  - `tests/tools.test.ts` "reports a successful press with unchanged parsed
    evidence as no progress". This one really is about an unchanging page:
    it should assert `status: "no_effect"` and the second press, not the old
    command list.
- The whole `runtime/llm-evidence/` directory, once ->
  `# tests 1073 # pass 1065 # fail 8`: the 4 above, plus 4 outside both
  node-run and `llm-evidence/tests`:
  - `page-find/tests/run.test.ts` "a handle a search printed is one a press
    binds ..." (`#account` x2).
  - `plan-resolution/tests/pressed-with-effect.test.ts` "words exploration
    pressed with no effect stay plain text ...". This really is an unchanging
    page and should assert `no_effect`.
  - `state-digest/tests/call-route-states.test.ts` "page captures for one
    decision (action that runs): still 2 ..." (15 captures, not 2).
  - `state-digest/tests/call-state-digests.test.ts` "page captures for one
    decision (action that runs): 4 digested around the call ..." (17, not 4).
  These next files pass but still go through the settle wait (up to about
  3 s each) because their stubs never change:
  - `control-spot/tests/declared.test.ts`
  - `plan-resolution/tests/act-effect.test.ts`
  - `plan-resolution/tests/frame-path.test.ts`
  - `plan-resolution/tests/resolve-plan-node.test.ts`
  - `tests/stable-handles.test.ts`
  Each should get the same status-line fix.
- `npx tsc -p tsconfig.json --noEmit` -> exit 0;
  `npx tsc -p tsconfig.test.json --noEmit` -> exit 0.
- `node scripts/check-extension.mjs` -> exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (193
  warning(s), 646 baselined)`.

### Not verified

- The full domain suite outside llm-evidence.
- No Lab run.
- Playback still presses once.

## Continuation 3 (final: the rest of llm-evidence's stub tests)

### Outcome

Done. The whole `runtime/llm-evidence/` directory passes: 1073 of 1073
tests. Every test that still goes through the settle path does so on purpose,
because it is about a press that changes nothing. Only test files changed; no
source file did.

### What changed

The same rule throughout: a stub page shows a status line, or opens a menu,
when a press lands. Where the line could change a count a test asserts, it
appears only after the first press.

- **Status line or similar added:**
  - `tests/page-refusal.test.ts`: a "Search open" line once Search people
    lands. The refusal page still has 46 lines.
  - `tests/tool-rejection-detail.test.ts` (`labWith`): an "Acts done: N" line
    after the page's controls.
  - `tests/tools.test.ts` ("presses any observed control…"): a "Pressed N
    times" line. The comment that called the page unchanging was updated.
  - `page-find/tests/run.test.ts`: pressing Account opens the menu, so "Your
    orders" becomes visible.
  - `state-digest/tests/call-route-states.test.ts` and
    `call-state-digests.test.ts`: a `pressed` page on the decision "action
    that runs", passed to the fake as `onClick`.
  - `control-spot/tests/declared.test.ts`: an "N confirmed" line.
  - `plan-resolution/tests/frame-path.test.ts`: a status line on the top
    document after a press.
  - `plan-resolution/tests/resolve-plan-node.test.ts` (the check-allowance
    test): a "Submitted" line.
  - `tests/stable-handles.test.ts` (`runtimeOver`): a status line after a
    press. The outdated "comes back `no_progress`" comment was updated.
- **Genuinely about an unchanging page, now asserting `status: "no_effect"`:**
  - `tests/tools.test.ts`, "reports a successful press with unchanged parsed
    evidence as no progress". It also checks that the first three commands are
    unchanged, that there are exactly two clicks, and that every other command
    is a look. The number of looks depends on the clock, so it is not pinned.
  - `plan-resolution/tests/pressed-with-effect.test.ts`, "words exploration
    pressed with no effect stay plain text…". Clicks are now `[MESSAGE,
    MESSAGE]`.
  - `plan-resolution/tests/act-effect.test.ts`, "no effect is answered where no
    act's identity is…". The Share press is documented as changing nothing.
  - `state-digest/tests/call-state-digests.test.ts`, "digests are stable across
    calls on an unchanged page…", for its last press ("an action that changes
    nothing").

### Commands run and observed results

- A probe run (a temporary `console.log` in `press-effect/settled.ts`, since
  removed: `grep -c "T511\|console.log" settled.ts` gives `0`) over
  `runtime/llm-evidence/` -> `# tests 1073 # pass 1073 # fail 0`. The settle
  path was entered only by `press-settled` (unit), `no-effect-press`,
  `press-changes`, `press-choice`, `tests/press`, `tests/tools` (the
  no-progress case), `pressed-with-effect`, `act-effect` and
  `call-state-digests` (the stability test). All of these are intended.
- Clean run: `DOMAIN_TEST_BUILD_LABEL=t511-domain node scripts/test-domain.mjs runtime/llm-evidence/`
  -> `# tests 1073 # pass 1073 # fail 0`, about 98 s, exit 0.
- `npx tsc -p tsconfig.json --noEmit` -> exit 0;
  `npx tsc -p tsconfig.test.json --noEmit` -> exit 0.
- `node scripts/check-extension.mjs` -> exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (193
  warning(s), 646 baselined)`.

### Not verified

- Domain tests outside `runtime/llm-evidence/` were not run.
- No Lab run.
- Playback of a saved Flow still presses once.

## Original wiring proposal (now applied, kept for reference)


### outcome.ts diff

```diff
diff --git a/domain/src/runtime/llm-evidence/node-run/outcome.ts b/domain/src/runtime/llm-evidence/node-run/outcome.ts
index bba7a494..e5312698 100644
--- a/domain/src/runtime/llm-evidence/node-run/outcome.ts
+++ b/domain/src/runtime/llm-evidence/node-run/outcome.ts
@@ -14,7 +14,11 @@ export type WebNodeOutcome = {
   ok: true;
   /** The node that ran, as the catalog names it. */
   node: string;
-  /** The command's own status, as the page reported it. */
+  /**
+   * The command's own status, as the page reported it -- except a press that
+   * landed and changed nothing even after its own wait and second press, which
+   * is `no_effect`, never `succeeded`, with `noEffect` saying so (t511).
+   */
   status: string;
   /** Whether the page looked different afterwards. Absent where it was not compared. */
   pageChanged?: boolean;
@@ -26,6 +30,23 @@ export type WebNodeOutcome = {
    * decisions without ever pressing twice in a row.
    */
   unchangedPress?: string;
+  /**
+   * Said with `status: "no_effect"`, and only on a press: it landed, was waited
+   * on and, where it may be made twice, pressed once more, and nothing on the
+   * page changed -- no line appeared or went, none changed its words, value or
+   * state -- naming the open dialog it sits in, if any, as still open
+   * (`./press-effect/no-effect.ts`, `./press-effect/settled.ts`, t511).
+   * Classifieds step 0038 of `run-mv6qrcdu-a31b44b8` pressed Apply in an open
+   * dialog, nothing changed, and the answer was `succeeded`. Never beside
+   * `unchangedPress`, whose advice to press again this has already taken.
+   */
+  noEffect?: string;
+  /**
+   * Said where the first press changed nothing and only the press's own second
+   * press changed the page: the answer is that second press's
+   * (`./press-effect/settled.ts`, t511).
+   */
+  pressedAgain?: string;
   /**
    * The node ran and the page it left could not be read, however long it was
    * waited for (`../capture.ts`, `captureAfterAction`). The packet then has no
```

### 2. node-run/run.ts (runWebOutputNode)

Import: add `webPressSettled` to the `./press-effect` import.

Replace (around line 406)
    const settled = await captureAfterAction(run.gateway, run.sessionId, run.request, run.request.signal);
    const after = settled === undefined ? undefined : run.restamp(settled);
    if (after) run.shown(after);
with
    const settled = await captureAfterAction(run.gateway, run.sessionId, run.request, run.request.signal);
    const lookAgain = async () => {
      const look = await captureAfterAction(run.gateway, run.sessionId, run.request, run.request.signal);
      return look === undefined ? undefined : run.restamp(look);
    };
    // A press that changed nothing is waited on and, unless its call declared a
    // lasting consequence, pressed once more before it is reported as having had
    // no effect (`./press-effect/settled.ts`, t511; the user's every-node-retries rule).
    const lasting = Array.isArray(declared) && declared.some((entry) => typeof entry === "string" && entry !== "");
    const pressed = await webPressSettled(node, current, settled === undefined ? undefined : run.restamp(settled), webPlanFirstTargetHandle(written), {
      look: lookAgain,
      pressAgain: lasting ? undefined : async () => (await webNodeDispatchWithRetries(run, { definitionId: node.definitionId, effect: node.effect, declared }, { actionType: node.actionType, parameters: webNodeDispatchParameters(node, ran), metadata: toolMetadata(run.request) }, undefined, webNodeEffectCheck(run, ran))).result.status === "succeeded",
      sleep: async (ms) => { await new Promise((resolve) => setTimeout(resolve, ms)); assertActive(run.request.signal); },
      now: () => Date.now()
    });
    const after = pressed.after;
    if (after) run.shown(after);

Line ~424, `changed` stays, but the pressed-target store must not count a no-effect press:
    if (changed === true && pressed.noEffect === undefined && node.definitionId === PRESS_NODE_ID && named !== undefined) run.stores.targets.pressed(...)

Outcome literal (~line 442):
      status: pressed.noEffect === undefined ? result.status : "no_effect",
      pageChanged: pressed.noEffect === undefined ? changed : false,
      unchangedPress: changed === false && pressed.noEffect === undefined && node.definitionId === PRESS_NODE_ID ? PRESS_AGAIN : undefined,
      noEffect: pressed.noEffect,
      pressedAgain: pressed.pressedAgain,
Robot-check outcome literal (~line 216): add `noEffect: undefined, pressedAgain: undefined`.

Left as is (supervisor's call): the tool execution stays ok with
`web.action.succeeded` and `addable: node.proposes`; a distinct result code
would touch vocabulary.ts, packages/test-runner and Core's loop.

### 3. tests/press.test.ts, "reports a press that changed nothing ..." (line 231)
Its stub page never changes, so after step 2 the press is judged no effect and
pressed twice. Expected becomes:
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal((pressed.evidence as { status?: string }).status, "no_effect");
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, false);
  assert.match(String((pressed.evidence as { noEffect?: string }).noEffect), /pressed twice/u);
  assert.equal("unchangedPress" in (pressed.evidence as object), false);
  assert.deepEqual(clicked, ["#inert", "#inert"]);
(Takes about 3 s of real settle wait.) Other tests that press a stub page that
never changes would also slow by up to 3 s and see `no_effect`; grep for
`unchangedPress` and `pageChanged, false` after applying.

### Acceptance
`DOMAIN_TEST_BUILD_LABEL=t511-domain node scripts/test-domain.mjs press-effect/tests llm-evidence/tests/press`
-> `no-effect-press.test.ts` (3 tests now failing) turns green.
