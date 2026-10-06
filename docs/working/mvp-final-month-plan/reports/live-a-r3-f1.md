# live-a-r3-f1: root cause of the dead Space Grey step (run-mux6n7m4-8273e7a0)

Read-only trace. Trees: downstream `fxwork/t262/!FluxIQWebExtension` (`<down>`), Core `fxwork/t262/!FluxIQ` (`<core>` = `packages/fluxiq/src/programs/automation-studio/runtime`).

## Outcome

Done. There are two defects, and they cancel each other out. A third, smaller defect lets the first hide.

1. **Resolver (extension).** A role-less, text-less `div` whose only name is a `title` attribute cannot be resolved once its selector drifts. Level 1 never reads `accessibleName`, and it never reads `title`. Level 2 never enumerates the div. So s11 is `web.target.not_found` on every page, including one that plainly shows it (`t76 clickable "Space Grey" marked`).
2. **Draft reversal (Core).** The Flow keeps draft step 17, "Space Grey **on**" (press 0046). It was recorded from a start state that only draft step 9 produced. Step 9 was "Space Grey **off**" (presses 0018/0024/0036), and the model dropped it. `reversal.ts` rule (b) exists for exactly this case, but kept steps 11, 12 and 16 lie between the two halves, so the rule is blocked. On a fresh page Space Grey is preselected, so if s11 ever resolved it would un-choose the colour, and Add to cart would refuse with "Please select a Color.".
3. **Masking (domain + Core).** The build test and playback both read "target not found" as "target gone". The page read the domain already holds shows the control, but nothing compares the two, so defect 1 passes as `core.replay.remembered` and then as a `state_routed` skip.

## What changed and why

Nothing in either tree. Only this report was written, as the brief required.

### Q1: Why `{tagName:"div", accessibleName:"Space Grey"}` matches nothing on a page with `div[title="Space Grey"]`

- **When the step was recorded, `title` is the name.** `<down>/apps/extension/src/content/identity/accessible-name.ts:53` reads `title`/`alt`. `describe-element.ts:105` stores the result as `accessibleName`, and `describe-element.ts:94` stores the same value as `name` through `authoredNameAttribute` (accessible-name.ts:65-69, aria-label, then title, then alt). The created node's identity comes from the packet in `<down>/domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts:97-105`. It holds `tagName`, `role` (undefined for a plain div), `accessibleName` = the packet name, `selector`, and `visibleText` (absent, because the swatch's only child is `<img alt="">`). That matches call.json for 0070 and 0083 exactly: three signals.
- **When it is replayed, neither `accessibleName` nor `title` is read at Level 1.**
  - `fingerprintMatches` (`<down>/apps/extension/src/content/action-runtime/resolve-target.ts:479-497`) passes everything except `visibleText` to `findClosestFingerprint`.
  - `ElementFingerprint` (`<down>/apps/extension/src/content/element-finder.ts:3-12`) has no `accessibleName` field, and `findClosestFingerprint` (element-finder.ts:21-55) never reads one.
  - Its only name lookup is `fingerprint.name`, matched against `[aria-label]` or `[name]` and never `[title]` or `[alt]` (element-finder.ts:42-45). So a recorder-made node that carries `name: "Space Grey"`, taken from the title by `authoredNameAttribute`, would miss too. The writer and the reader disagree on what `name` means.
  - The selector `#fb1g3cqvc > …` is anchored on `rotatingId` (`scenario-lab/.../markup/shell.ts:40-47`, `item.ts:57`), so it is stale by design.
  - There is no xpath, id, test id or class to fall back on.
  - The text fallback exits at resolve-target.ts:486 because there is no `visibleText`.
- **Level 2 would read `title`.** `candidateFingerprint` calls `accessibleNameFor` (`identity/candidates.ts:211`). But the pool is empty (Q2).

### Q2: Why "0 controls of the same family" for a role-less clickable div

- The family is `{tagName:"div"}` with no role. `candidateFamily` (resolve-target.ts:428-431) gets no role because the identity carries none.
- `collectTargetCandidates` enumerates only `CANDIDATE_SELECTOR` (`identity/candidates.ts:118-121,151`): `a[href], button, input, select, textarea, summary, label, [role], [tabindex], [onclick], [contenteditable]`. The swatch matches none of these. Its click handler is bound with `addEventListener` (`client/item-script.ts:99-107`), and its pointer cursor comes from CSS (`styles/stylesheet.ts:136`). So it is never examined, and `inFamily` never sees it.
- The page view calls it `clickable` by different rules. One is the page-world press-listener probe (`describe-element.ts:78`, `pageListensForPress`, t229). The other is the snapshot's `cursor` (`<down>/domain/src/runtime/llm-evidence/page-view/element/kind.ts:58-59`).
- So the model can see and press a control that the resolver cannot enumerate. The not-found sentence "0 control(s) of the same family are on the page" (`notFound`/`familySeen`, resolve-target.ts:642-673) is then stated as a fact about the page, and it is false.

### Q3: What makes the build test say `remembered`, and playback route forward? Can either tell "present but unresolvable" from "gone"?

**Build test (0070, 5.2 s, the press went out):**
1. `<down>/domain/src/runtime/llm-evidence/node-run/replay.ts:339-343` reads the page first. `targetAbsentBefore` (replay.ts:467-478) returns false because an element named "Space Grey" is in the read, so the press is sent.
2. The client answers `web.target.not_found`. replay.ts:372 routes any `TARGET_NOT_FOUND` to `webNodeReplayMissingTarget`.
3. `missing-target.ts:59-72` answers `core.replay.remembered` when the current location equals the step's `from.location`.

The domain reads only the failure code and the location. The `before` read that showed the control is thrown away once the press is sent. **It cannot tell the two cases apart.**

**Playback (0083):**
1. `<core>/executor/state-routing/could-not-run.ts:17-19` treats any failure in category `target_not_found` as "cannot run".
2. graph-run.ts:545-551 calls `decideAutomationStudioStateRoute`. In decision.ts:67-107 the page matched s12's recorded pre-state, giving record outcome `routed`, direction forward.

Core reads only the category; its own comment says `target_ambiguous` is excluded because "something matched, so the page has the target". **It cannot tell the two cases apart either.** The fix belongs at the source: the extension should not report "not found" for a control it can name (Q5 fix 1), and the domain should not call it remembered when its own read shows the control (Q5 fix 3).

### Q4: What would this Flow do in playback if resolution were fixed? Could anything in the build have refused or warned?

**Playback with resolution fixed.**
- The fixture's start state is `defaultChoice` = `colors[0]` = Space Grey (`catalog/skus.ts:24-25`), and the client toggle clears an already-chosen option (`item-script.ts:102`).
- s11 would resolve `div[title="Space Grey"]` (marked in 0083's page.txt) and un-choose it.
- s12, Add to cart, would then be refused by the page with "Please select a Color." (`item-script.ts:124-125`), and the cart would stay empty.
- The build test would have caught this the same way: its reset is a navigation, so Space Grey arrives chosen. The resolver defect is what turned that real failure into `remembered`.

**How the draft got here** (final draft list in `steps/0060-decide/request.txt`):

| Draft step | Press | Toggle | State |
| --- | --- | --- | --- |
| 9 | Space Grey, presses 0018 / reruns 0024, 0036 | each "un-chose", `toggle {key:t940,to:off}` | dropped by the model at 0050 |
| 11 | 7-in-1 | | kept |
| 12 | Spain | | kept |
| 16 | quantity 3 | | kept |
| 17 | Space Grey, press 0046 | "chose", `to:on`, act `a1.colour` | kept |
| 18 | Add to cart | | kept |

**Can Core already refuse it?** Yes. The `toggle` statement already crosses to Core (`<down>/domain/src/runtime/llm-evidence/node-run/run.ts:505`, `press-effect/toggle.ts`; Core `flow-draft/step.ts:165`). `<core>/flow-draft/reversal.ts` rule (b) says that a kept toggle whose same-key partner is out of the Flow and went the other way must leave. It does not fire here for two reasons:
- **The between-steps check blocks rule (b) as well as rule (a).** reversal.ts:62-63 skips the pair whenever any kept, proposable step lies between the halves, and it runs before the disposition branch at reversal.ts:64-72. The reason given for that check, that an in-between step may need the temporary state, applies only to keeping a pair. Under (b) the earlier half is already out of the Flow, so playback never produces the temporary state. The later press can only flip the control the wrong way. The only rule (b) test (`flow-draft/tests/reversal.test.ts:127`) has nothing between the halves.
- **Reversal never runs on a drop.** `<core>/flow-draft/amendment/apply.ts:224` calls `automationStudioFlowDraftDropReversals` only when `disposition === "kept"`, and so does `llm/evidence-loop.ts:214,480`. In this run the drop at 0050 shared a decision with an `add`, so reversal did run, and was then blocked by the check above. A decision that only drops would never reach it at all.

**Owner:** `<core>/flow-draft/reversal.ts`, plus the call site in `amendment/apply.ts`. The general rule is to fold each key's toggles in draft order. The arrival state is the first recorded toggle's start state, the opposite of its `to`. Any kept toggle whose `to` equals the state the kept steps before it already produce would flip the control the wrong way, so it leaves the Flow with `cancels` naming its partner. If that is judged too strong, it could be a refusal the model sees instead. Rule (b) is one case of this rule.

### Q5: Smallest fixes, highest value first (none applied)

**1. Extension: resolve by accessible name, counted.** File: `<down>/apps/extension/src/content/action-runtime/resolve-target.ts`, `fingerprintMatches`.
- Change: after the stable lookups miss, if `target.accessibleName` is set, scan `root.querySelectorAll(target.tagName || "*")` and keep the elements whose `accessibleNameFor(el)` (normalized) equals it. Bound it by `MAX_TEXT_SCAN` and count every match, like the `visibleText` scan beside it, so two same-named controls stay ambiguous. The existing veto and record gate then apply unchanged.
- Smaller alternative, in `element-finder.ts:42-45`: add `[title]`/`[alt]` to the `name` query and read `accessibleName` as well. But that returns one element uncounted, which is what this module's header warns against.
- Failing test, in `<down>/apps/extension/e2e/content/tests/identity-resolution.spec.ts`, beside the existing resolver specs (the unit stub DOM answers only `"*"`):

```ts
test("a role-less div named only by its title resolves by that name once its selector drifts", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend",
      '<div id="g2"><div class="sw" title="Space Grey" style="width:40px;height:40px;cursor:pointer"><img alt=""></div>' +
      '<div class="sw" title="Silver" style="width:40px;height:40px;cursor:pointer"><img alt=""></div></div>');
    document.querySelectorAll(".sw").forEach((el) => el.addEventListener("click", () => el.setAttribute("data-pressed", "yes")));
  });
  const reply = await harness.runAction({
    commandId: "title-named-swatch", actionType: "web.dom.click",
    selector: "#g1 > div:nth-of-type(1)",
    options: { element: { tagName: "div", accessibleName: "Space Grey", selector: "#g1 > div:nth-of-type(1)" } }
  });
  expect(reply).toMatchObject({ status: "succeeded" });
  await expect(page.locator('[title="Space Grey"]')).toHaveAttribute("data-pressed", "yes");
  await expect(page.locator('[title="Silver"]')).not.toHaveAttribute("data-pressed", "yes");
});
```

Today this fails with `web.target.not_found`, "0 control(s) of the same family".

**2. Domain: a not-found press whose control the page read shows is `failed`, not `remembered`.** File: `<down>/domain/src/runtime/llm-evidence/node-run/replay.ts`, around replay.ts:372, with a helper next to `targetAbsentBefore`.
- Change: when `result.failure.code === TARGET_NOT_FOUND` and the whole `before` read, taken at `from.location`, holds a control-kind element whose `name` equals `parameters.element.accessibleName`, answer `core.replay.failed`. Suggested wording: "the page shows a control named "<name>" but the step could not find it".
- The match must be restricted to the recorded record: when `element.context.record` is present, require the control's `within` to equal `record.text`. Otherwise the bigbox "Set as my store" case (run-munri5gr), where other cards still hold the label, becomes `failed` instead of `remembered`/`unreproducible`.
- Match on `name` only, not on `text`/`ownText`. The `Color: <b>Space Grey</b>` label (t74) carries the same words.
- Failing test, in `<down>/domain/src/runtime/llm-evidence/node-run/tests/replay-remembered.test.ts`. It reuses that file's `stub` (whose click answers `web.target.not_found`), with `page()` returning `interactiveElements: [{ tagName: "div", selector: "#fresh > div", accessibleName: "Space Grey", hasClickHandler: true }]`:

```ts
test("a replayed press the page still shows by name, but could not be found, fails rather than being remembered", async () => {
  const site = stub(CHECKOUT); // page(): one div named "Space Grey", hasClickHandler
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const value: JsonObject = { replay: "step", node: CLICK, consequences: [], from: { location: CHECKOUT },
    parameters: { selector: "#stale > div", element: { tagName: "div", accessibleName: "Space Grey", selector: "#stale > div" } } };
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.17", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
  assert.equal(answered.resultCode, "core.replay.failed");
});
```

Today it answers `core.replay.remembered`.

**3. Core: rule (b) is not blocked by steps between, and reversal runs on a drop.** Files: `<core>/flow-draft/reversal.ts` (move the between-steps check at :62-63 inside the `earlier.disposition === "kept"` branch) and `<core>/flow-draft/amendment/apply.ts:224` (also call it when a kept step becomes dropped). This is a Core edit, so the supervisor has to announce the boundary crossing. Failing test, in `<core>/flow-draft/tests/reversal.test.ts`:

```ts
it("run mux6n7m4: a re-press that undoes a step the model dropped leaves even with kept steps between", () => {
  const steps = draft([
    { from: "s0", to: "s1", disposition: "dropped", toggle: off(), acts: [] },
    { from: "s1", to: "s2", disposition: "kept" }, // 7-in-1
    { from: "s2", to: "s3", disposition: "kept" }, // Spain
    { from: "s3", to: "s4", disposition: "kept" }, // quantity 3
    { from: "s4", to: "s5", disposition: "kept", toggle: on(), acts: ["a1.colour"] }
  ]);
  expect(automationStudioFlowDraftDropReversals(steps).map((step) => step.position)).toEqual([5]);
  expect(steps[4]!.cancels).toBe("d1");
  expect(inFlow(steps)).toEqual([2, 3, 4]);
});
```

Today this returns `[]` and the step stays in the Flow. Also add a test to `amendment` that a lone `{step: 1, change: "drop"}` on the kept "off" half takes the kept "on" half out.

**4. Extension: enumerate the controls the page view calls clickable.** File: `<down>/apps/extension/src/content/identity/candidates.ts`.
- Change: when the family names a tag and no role, also enumerate `tagName` elements that `pageListensForPress`/`hasClickHandler` accept, or that have a pointer cursor. Keep `MAX_SCANNED`.
- This makes Level 2 able to recover a swatch whose title also changed, and makes the "N controls of the same family" count true.
- Lower value than fix 1, because fix 1 alone resolves this run. Test in `<down>/apps/extension/e2e/content/tests/identity-resolution.spec.ts`: the same injected swatch with a stale selector and `accessibleName: "Space Gray"` should fail with "1 control(s) of the same family", or resolve by score. Today it reads "0 control(s)".

Value order: 1 (removes the false not-found) and 3 (removes the wrong-way press) are each enough to fix one of the two defects. Fix 1 alone would turn this run's Flow from a silent pass into a build-test failure on Add to cart, so 1 and 3 should land together. Fix 2 stops the next resolver gap from passing as `remembered`. Fix 4 is robustness.

## Commands run and observed results

All read-only:
- `cat`/`sed`/`grep` over the run folder `steps/` (0017, 0018, 0019-0059, 0060 request.txt, 0070, 0075-0086) and over the source files cited above.
- A `python -c` JSON summary of steps 0020-0059 and 0075-0086. Observed: reruns 0024 and 0036 both said `This press un-chose "Space Grey"`; 0046 said `This press chose "Space Grey"`. The final draft lists step 9 as `dropped` and step 17 as `kept`, `act: a1.colour`, with steps 11, 12 and 16 kept between them.
- `grep '"toggle"|"cancels"'` over the run folder found nothing, so the draft's toggle and cancels fields are not dumped to run artifacts.

No tests, builds, Lab, replay or paid commands were run.

## Not verified

- The draft's actual `toggle` values on steps 9 and 17. They are inferred from the `choice` sentences, which share `chosen-state.ts` with `toggle`, because the run artifacts do not record them.
- The exact amendment order inside decision 0050 (drop 9, then add 17) and therefore that reversal ran with step 9 already dropped. Either way the between-steps check blocks rule (b).
- None of the proposed tests were run. The e2e test assumes `harness.runAction` accepts `accessibleName` inside `options.element`, as other specs pass `name`. `openHarness("basic-form")` was chosen as an existing fixture without checking its layout.
- The veto's verdict on a title-only match after fix 1. It should pass on an exact `accessibleName` agreement, but this was not traced through `identity/veto.ts`.

## Open questions or contradictions found

- The `reversal.ts` header lists rule (b) as separate from "pairing", but the code applies pairing's between-steps check to both rules. The comment and the code disagree.
- The not-found failure says "0 control(s) of the same family are on the page" while the page view lists the control as `clickable`. The resolver's idea of a control (`CANDIDATE_SELECTOR`) and the page view's (press listener or cursor) have drifted apart since t229.
- `ElementFingerprint` in `element-finder.ts` has no `accessibleName`, but `RecordedTarget` in `resolve-target.ts` declares one and passes it through. The type allows the field to be dropped silently.
