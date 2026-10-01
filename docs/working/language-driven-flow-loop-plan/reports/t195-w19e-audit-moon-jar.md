# t195-w19e: audit of photo-social-moon-jar-price before its first live run

Read-only audit. Both trees are on `task/t195-live-control-flow`: downstream `fxwork/t195/!FluxIQWebExtension` and Core
`fxwork/t195/!FluxIQ`. Below, "D/" means the downstream tree and "R/" means Core's
`packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. The first live run **cannot pass as the tree stands**, for one reason (cause 1): the answer is a single product card in
a direct-message reply, and no path in this tree reads a single record into a table.
- Structure detection only proposes runs of three or more, or record pairs.
- Aimed at the card, it searches outward and finds the inbox's three thread rows.
- After any detection, a literal list read is refused `extraction_required`.
- A `web.dom.extract` read produces no dataset, so Core's answerability check refuses the Flow.

Everything else in the chain works on paper:
- typing into the content-editable composer;
- Send appearing and being asked about, then granted by L1;
- the dry run checking Send instead of sending again;
- the Lab resetting state before playback;
- the list read waiting up to 10 s for the reply, which takes about 2-3 s.

Six risks and two routed items follow cause 1.

## What changed and why

Only this report was written. No source file was edited. A scratch probe lives in this session's scratchpad (`w19e/probe.mjs`).

## (a) The chain a correct build takes

From `apps/scenario-lab/src/scenarios/photo-social/`.

1. **Start** at `/scenarios/photo-social/` (the home feed). The site keeps all of its state on the server:
   - the cookie dialog sits over a scrim that takes every click (`client/overlay-script.ts`);
   - "Decline optional cookies" sets consent to `essential` (manifest `OPENING`);
   - "Not Now" answers the notifications prompt, which makes the app inert about 1.2 s after load, on the home feed only;
   - the messages dock (`fl-dock`, open shadow root) expands over the bottom right about 1.5 s after load on every page
     except the inbox and threads.
2. **Find Saltmarsh Goods.** It has **no look-alike accounts**: the look-alikes are all of Harbourlight Studio
   (`data/accounts.ts:16-26`). The shop is `saltmarsh.goods`, "Saltmarsh Goods", unverified, with the bio "Ceramics and linen
   from the Saltmarsh coast. One-of-one pieces. DM to buy." The visitor already follows it. It is reachable from:
   - the feed;
   - search (also a recent search);
   - the dock's thread link;
   - Messages, then the inbox row "Saltmarsh Goods";
   - its profile.
3. **The post.** The shop's newest post (2026-10-01, a 3-slide carousel) reads "Speckled moon jar, one of one. 28 cm tall,
   satin white glaze with iron speckle. DM for price." (`data/network-posts.ts:17`).
   - The price is nowhere on the post or its comments (`tests/scenario.test.ts:168`).
   - The shop's product page is reachable only from the reply's card (`pages/elsewhere.ts:30`).
   - Distractors: "Small moon jar, sold." (09-10) and the studio's reel "Throwing a moon jar in sixty seconds."
4. **Open the thread.**
   - On the profile, the div-button "Message" runs `location.href = …/direct/t/saltmarsh.goods/`
     (`client/core-script.ts:99-101`).
   - Alternatively, use the inbox row or the dock link.
   - The thread already holds "Thanks for following! New pieces drop most Fridays." (`data/threads.ts:10`).
5. **Type.**
   - The box is `<div contenteditable role="textbox" aria-label="Message…">`.
   - Beside it is a honeypot: `input[name="subject"]` labelled "Leave this field empty", positioned off-screen at -10000px
     (`pages/direct.ts:50`, `look/stylesheet.ts:115`).
   - Filling the honeypot blocks the account for good (`state.ts:139-142`).
   - "Send" is `hidden` until an `input` event leaves text in the box (`pages/direct.ts:53`,
     `client/direct-script.ts:19`). Enter also sends.
6. **Send.** Send has a lasting effect and is the task's point (`send_or_publish` at "Send"). Pressing it:
   - posts `send-message` (`fetch`, `src/html.ts:34-35`);
   - the server appends the visitor's message and, **in the same state change**, the shop's instant reply
     (`state.ts:143-145`).
7. **The reply.**
   - The page shows the visitor's bubble at once, then fetches `…/messages?from=<shown>`.
   - It then shows "saltmarsh.goods is typing…" for 1,800 ms (`client/direct-script.ts:11, 33-42`), then the reply.
   - There is no polling: the page fetches once per send. A reload renders the reply from the server at once.
   - The reply wording depends on whether the message matches `/moon\s*jar/iu` (`data/threads.ts:15-25`):
     - **If it matches:** bubble "Hi! Thanks for asking. Here it is:", followed by a card
       `<a href="…/saltmarsh.goods/shop/speckled-moon-jar/"><img alt="Speckled moon jar"><div><span>Speckled moon jar</span><span>€68.00</span><span class=meta>One of one · ships in 3–5 days</span></div></a>`
       (`pages/direct.ts:20-27`).
     - **If it does not match:** "Hi! Thanks for your message. Which piece are you asking about? Send us its name and we
       will reply with the price." There is no card.
     - "moon-jar" with a hyphen does **not** match (probe below).
8. **Expected dataset** `extract-moon-jar-price`: exactly one record, `{item: "Speckled moon jar", price: "€68.00"}`
   (`manifest.ts:202`, `data/threads.ts:5`; the euro sign is U+20AC).
9. **The workflow's final state is also judged on playback** (`manifest.ts:203`;
   `test-runner/src/flow-lane/creation/lane.ts` → `judgeCreatedFlowOracles`, `oracles.ts`). It requires:
   - consent `essential`;
   - outbox `saltmarsh.goods 1`, meaning exactly one message sent;
   - blocked `clear`.

## (b) Causes, ranked

### Blocks the first pass

**1. No way to read one record (the reply card) into a table.** The build cannot finish with a correct Flow.

Evidence:
- Only `web.dom.extract_list` yields records (`D/domain/src/output-nodes/definitions.ts:46-48`; `web.dom.extract` answers
  one value and declares no records path, per `output-nodes/extract-list/records-path.ts`).
- Core refuses a Flow with no records-producing step when the instruction asks for a table:
  `bootstrap.cannot_answer_instruction` (`R/flow-bootstrap/answerability/check.ts:68-76`).
- `extract_list` is told to name a detected list by handle (`output-nodes/extract-list/catalog-text.ts`, description).
- Once any detection was issued in the build, a literal `{item: css}` is refused `web.handle.extraction_required`
  (`D/domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:431`).
- Detection needs a run of 3 or more (`D/apps/extension/src/content/extraction/infer-list.ts:46`), or a record pair: two
  siblings with a named template, each holding 2 or more values (`record-pair.ts`).
- The card has no same-template sibling at any level. The probe of the scenario's own markup shows the conversation area as
  `[div.bubble, div.bubble+bubbleMine, div.bubble, a.card2]`, with exactly one card.
- Aimed at the card, `detectAround` therefore gets no proposal and returns `nearestRichRun`
  (`detect-structure.ts:134-145, 154-161`). The nearest rich run outward is the inbox's **3 thread rows** (name + preview;
  the probe shows 3 `threadRow`s), which carry no price.
- The domain's targeted fallback asks page-wide (`structure/detect.ts` header), which gives the same list or a thinner one.
- The product page (from the card link) has the same shape: one `h1` and one `p`, so no run.

Effect: the model is shown the thread list.
- If it reads that list, the dataset is wrong.
- If it writes a literal read, it is refused.
- If it uses `web.dom.extract`, answerability refuses the Flow.
- Otherwise the build ends at the no-progress guard or the deadline.

Fix spec (A, recommended): **detection offers the one record it was aimed at, beside the list it found outward.**
- Extension, new file `apps/extension/src/content/extraction/lone-record-level.ts`. It exports the pure
  `chooseLoneRecordLevel(levels)`:
  - `levels` run from the target outward, at most 5 (the target plus 4 ancestors), each
    `{cell, boundary, contentFields, holdsRun, namedExactly}`;
  - return `undefined` at the first `boundary` (body, `main`/`[role=main]`, or a `NON_DATA_REGIONS` region) or the first
    `holdsRun`;
  - skip `cell` (TD/TH);
  - return the first index with `contentFields >= 2 && namedExactly`.
- Extension, new file `apps/extension/src/content/extraction/lone-record.ts`. It exports `loneRecordAround(target)`, which
  builds those levels from the DOM:
  - `contentFields` = `contentFieldCount(inferFields(el, [el]))`;
  - `holdsRun` = `largestRunsFirst(el).length > 0`;
  - `namedExactly` = `generalizedItemSelector([el], selectorFor(el.parentElement))` matches only `el`.
  - It returns a proposal `{container, item, itemCount: 1, fields, confidence: item.confidence × mean coverage × 0.5}` with
    no pagination.
  - One export per file, as the structure audit requires. Add both to `extraction/index.ts` if the barrel lists the
    directory.
- Extension, `detect-structure.ts` `detectAround` (lines 134-146): when the target is not inside an item of the answered
  run, or there is no run, compute `loneRecordAround(first)`.
  - With no other answer, answer the lone record.
  - Otherwise answer the run as now, with `record: lone` beside it.
  - Never answer the lone record **instead of** a run. Doing that would regress the everything-store cart, where a model
    aimed at the subtotal must still get the cart lines (`run-mulum3x7-18ceeb75`).
- Domain, `domain/src/extraction/structure-detection.ts`: the `ok: true` variant gains `record?: WebAutomationExtractionProposal`.
  The existing proposal parser validates it, with `itemCount === 1`.
  - If `apps/extension/src/shared/protocol.ts` mirrors this type, keep it in step.
- Domain, `domain/src/runtime/llm-evidence/structure/{detect.ts, handles.ts, packet.ts}`:
  - issue a second extraction handle for `record`, in the same store and scope, so it is also an "own" list for
    `plan-resolution/own-extraction-list.ts`;
  - the packet carries `record: {handle, itemCount: 1, fields}` and one closed sentence: "record is the one item you aimed
    at, read as a one-row table; name its handle in extractList when the instruction is about that item".
  - This sentence is not in t223's `tools.ts`.
- Docs: the structure-detection passage of `docs/architecture/page-evidence.md`, or wherever the worker finds detection
  documented.
- On playback this fixes the wait as well. The Flow keeps `{item: <card selector>, fields}`, and the read waits up to
  10,000 ms for 1 item (`D/apps/extension/src/content/extraction/page-render.ts:159`; `minItems` defaults to 1). The reply
  card appears about 2-3 s after Send, and nothing else matches the card selector before then.
- Smaller alternative (A′), not recommended: answer the lone record only when the outward search finds no rich run. That
  does not help the thread page, because the thread list is found. It only helps the product page, which needs one more
  click on playback.

Tests (provider-free):
- `apps/extension/src/content/extraction/tests/lone-record-level.test.ts`, on level descriptors transcribed from the
  scenario's card:
  - aimed at the price span, `[span{cf 0}, div{cf 3}, a{cf ≥3}]` → 1;
  - aimed at the card, `[a{cf ≥3}]` → 0;
  - the cart heading, `[h2{0}, header{1}, section{holdsRun}]` → `undefined`;
  - a boundary before any rich level → `undefined`;
  - a TD level is skipped.
- `domain/src/runtime/llm-evidence/structure/tests/detect.test.ts`, with a new capture in `captured-detections.ts`. The
  capture is a detection answer carrying the thread-list proposal plus a `record` proposal written from the scenario's
  markup, with class names from `photoLook(238).cls`. Assert:
  - two handles are issued;
  - the packet names the record;
  - `resolveWebPlanNode` of `extractList: {handle: <record>, fields: {item: <name key>, price: <price key>}}` resolves to
    the card's item and its two field selectors;
  - with (c) and (d) reverted, the test fails.
- `apps/scenario-lab/src/scenarios/photo-social/tests/scenario.test.ts`, new case pinning the markup facts the fix relies
  on, as in the probe:
  - after a named send there is exactly one card;
  - the area's children are `[bubble, bubble+mine, bubble, card2]`;
  - the card holds three spans, the second reading "€68.00";
  - the inbox has 3 thread rows.
- The DOM walk itself can only be proven in a browser: an `apps/extension/e2e/content/tests/extraction/` spec on the thread
  page rendered from the scenario's modules. **That spec is a browser run. It needs the lead's decision**, because this brief
  and the current stop forbid browser runs. It is not part of the provider-free proof.

### Risks (each can fail the first run; none is certain)

**2. The dry run blocks on steps the site remembers: cookie decline, notifications "Not Now", dock collapse.**
- If the model declared `[]` for these presses, the dry run replays them (`R/flow-draft/verify-only.ts:96-100`).
- Its reset is a navigation only (`D/domain/src/runtime/llm-evidence/node-run/replay.ts` header). The dialog, the prompt
  and the expanded dock are gone, because consent, notifications and the dock are server state, so each step answers
  `target_not_found`, which becomes `unreproducible` (`replay.ts:214, 222`).
- `unreproducible` blocks every time (`R/flow-draft/dry-run.ts` header). Only `optional` or `only_if` exempts a step.
- `present` passes only in verify mode (`R/llm/node-tools/replay.ts:143-150`).
- Cost: at least one refused completion, an amendment and two more replays (`dry-run-gate.ts:69`). A model that drops the
  steps instead still passes on playback, because the interference defence (F1) declines the cookie wall.
- This is shared with both other photo-social tasks and with any consent site.

Fix sketch, for the owner to spec:
- `replay.ts` `replayStep`: a `target_not_found` on a press whose target was inside an open modal layer when recorded
  (`front-layer.ts`/`layers.ts` marks), on the same page location the step acted on, answers `core.replay.present`.
- Core `replay.ts:143-150` accepts `present` in replay mode for such steps.
- Test: `node-run/tests/` with a fake gateway answering `target_not_found` for a dialog-marked step → `present`, and Core's
  dry-run verdict passes it.

**3. Exactly one message, and it must name the piece.**
- A first message such as "How much?", or "moon-jar" with a hyphen, draws "Which piece…?" and no card (probe).
- If the model then sends a second message and both sends stay in the Flow, playback sends two. The outbox is then
  `saltmarsh.goods 2`, and the final-state oracle fails (`manifest.ts:203`).
- With the second send, the build state also holds two exchanges.
- This is model behaviour. No product fix is recommended. Loosening the fixture's `/moon\s*jar/iu` to accept a hyphen is
  the lead's call.

**4. Send declared `[]`.** Then nothing asks:
- the lane fails with `permissionPoint: "not_asked"` (`test-runner/src/flow-lane/creation/lane.ts`
  `assertGrantedAtPermissionPoint`);
- the dry run re-sends, because a `[]` step is replayed.

The wording that should prevent this is already in place: "a node that sends … names its class", and "the press that
submits the post is send_or_publish" (`R/llm/node-tools/run-node.ts:77-78`). This is model behaviour.

**5. A stray earlier extraction in the Flow.** The lane pairs the expected step with the Flow's **first** extraction
(`test-runner/src/flow-lane/creation/judgement.ts:28-55`). If the model reads the thread list first and keeps that step,
it is the one judged. This is cause 2 of the top-causes list ("draft is a transcript"), owned by **t196**.

**6. Consent must be declined.** Final state requires `essential`. If the model presses "Allow all cookies" during the
build and the step stays in the Flow, playback fails the oracle. This is shared with the giveaway task, and it is model
behaviour.

**7. The post-Send look comes too early.**
- `captureAfterAction` waits only for an unreadable page (`D/domain/src/runtime/llm-evidence/capture.ts:503`). The model's
  first packet after Send most likely shows "saltmarsh.goods is typing…" and no card yet.
- Its next look shows the card.
- Wait nodes exist (`definitions.ts:132-133`, observe), and the Flow does not need one, because the read waits for itself.
- Low risk.

### Checked and not a cause

- **Typing.** `web.dom.type` handles a content-editable host. Per character it dispatches `keydown`, `beforeinput`, the
  insert at the caret, `input` and `keyup` (`apps/extension/src/content/action-runtime/keyboard/{type-text,text-edits}.ts`).
  The `input` event bubbles to the page's `syncSend`, so Send unhides. The read-back uses `textContent`.
- **The honeypot.** Typing into it is refused `hidden` by actionability (`action-runtime/actionability.ts:54`).
- **Send's handler.** It starts a `fetch` at once, so F20's ignored-press re-press never fires.
- **The gate at Send.**
  - The domain requires `consequences` on a mutating node (`node-run/run.ts:303-306`).
  - Core asks; L1 grants at the declared point when `missing` includes `send_or_publish` and the control is named "Send"
    (`person-simulation/permission-answer.ts`, `flow-lane/creation/permission-point.ts:33-41`).
  - "Send" is carried because the gate keeps every string shown to the model and finds the name in the post-type packet
    (`R/action-permissions/gate.ts:226-245, 366-373`).
  - After the grant, the plan step is permitted.
  - P1 keeps an earlier decline from blocking this ask: the Lab denies a declared send on "Message", or a keypress on
    "Message…".
- **The dry run of a draft that sends.** It does **not** send again. A step that declares a class is checked in verify
  mode (`R/flow-draft/verify-only.ts:96-100`, `D/domain/.../node-run/verify.ts`). After the type step replays, Send is
  visible, so the check reports `verified`. The read then replays against the build's own exchange, which the reset
  navigation re-renders from the server: 1 record where 1 was produced.
- **Playback has no gate** (`R/flow-bootstrap/adaptation.ts:344-346`, by design), so Send runs once.

## Task 3: reset and replay

- **Yes, the Lab resets the site's state between the build and the judged playback.**
  - `lane.ts:318-319` calls `resetScenarioLab` → `POST /__control/reset` → `store.reset()`
    (`apps/scenario-lab/src/server.ts:110-112`), which brings back `createPhotoState()`. This happens before
    `prepareFlowPage("playback")`.
  - Photo-social keeps no state in the browser, so after the reset the cookie dialog, the notifications prompt, the
    expanding dock and an empty outbox are all back.
- **On playback, the message gets its reply the same way.**
  - The playback's message is the run's first. The server rule answers every message to the shop at once
    (`state.ts:144`), with the card when the text names the moon jar.
  - The page shows the reply about 1.8 s after its fetch, and the list read waits for it.
  - Without the reset, a second message would draw a second card: the probe shows outbox `saltmarsh.goods 2` and 2 cards.
    That would fail both the count and the final state.

## (c) Belongs to other lanes

- **t223** (page view): the build needs these in the packets that follow the relevant actions:
  - Send, once it is no longer `hidden`;
  - the composer named "Message…";
  - the card's text.

  t223's fixture tests should cover a `[role=button][hidden]` control that unhides after an `input` event. The detect
  tool's description in `tools.ts` is t223's; fix 1 does not need it changed.
- **Lane B** (`R/recovery/runtime-exploration.ts`): a repair during an authorised playback that presses Send again would
  make the outbox 2. It still settles a decline as silence (w18 open question 1).
- **t196**: risk 5 (the draft as a transcript, with a stray extraction step) and the replays inside a build (top cause 1).
  A `rerun` of Send inside the build sends again silently once it has been granted.
- **The verify/present owner, t193 (`t193-wH`), or t195**: risk 2's dry-run rule for remembered dialog steps. This needs a
  change on both sides: Core `replay.ts` and domain `node-run/replay.ts`.

## Commands run and observed results

- `node --test apps/scenario-lab/dist/scenarios/photo-social/tests/scenario.test.js`. This is the scenario's pure unit
  file; it runs no browser and the dist is newer than the src. It printed `# tests 12`, `# pass 12`, `# fail 0`.
- `node <scratchpad>/w19e/probe.mjs`. It imports the built scenario modules, applies `consent` and `send-message`, and
  renders the thread. It printed:
  - the conversation area's opening tags: `div.<bubble>`, `div.<bubble> <bubbleMine>`, `div.<bubble>`, `a.<card2>`;
  - `cards on page: 1` and `thread rows: 3`;
  - `outbox relay: saltmarsh.goods 1`;
  - messages `['me','Hi! How much is the speckled moon jar?',null]` and
    `['saltmarsh.goods','Hi! Thanks for asking. Here it is:','€68.00']`;
  - `second send (no reset): outbox saltmarsh.goods 2 cards 2`;
  - `hyphenated 'moon-jar' draws card: false`.

## Not verified

- I ran no browser, Lab or model. The DOM conclusions in cause 1 come from reading `infer-list.ts`, `largest-runs.ts`,
  `record-pair.ts` and `detect-structure.ts`, plus the string-level probe. They were not executed against a DOM.
  - Specifically, I did not run `detectStructure` on the thread page. "The thread list is the nearest rich run" is
    reasoned, not observed.
  - `MAX_SIGNATURE_CLASSES` was not checked. It decides whether the visitor's bubble shares the shop bubbles' signature.
    Either way the bubbles are thin and the card stays unpaired.
- I did not check how t223's new page view presents the Send control, the card or the honeypot.
- I did not check the dry-run feedback's exact wording for `unreproducible`, or whether it names `optional`.
- I did not check how `inferFields(el, [el])` scores a one-item run's coverage. The fix assumes coverage 1.

## Open questions or contradictions found

1. **Does fix 1's DOM proof get a browser run?** It would be a content e2e spec on photo-social's own markup, which is one
   of the ten realistic scenarios. This brief and the stop say no browser. Without that run, the provider-free proof covers
   the level rule, the domain handles and the fixture's markup facts, but not the walk itself.
2. **Should the fixture accept "moon-jar"?** Its own wording is "a message that names the piece" (`data/threads.ts:14-15`).
   Loosening the regex is a realism call, not a fix, so I recommend leaving it unless the lead disagrees.
3. **Which lane owns risk 2?** It spans Core (`llm/node-tools/replay.ts`) and the domain (`node-run/replay.ts`).
