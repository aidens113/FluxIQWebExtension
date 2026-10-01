# t195-w20h: steps inside a cross-origin frame survive a reload; detection inside it works

## Outcome

Done. C1 (a) to (d) and C2 are implemented, and every new case was seen to fail against the reverted source. Both
domain test directories pass (62/62), the extension runtime tests pass (235/235), the domain check is clean, and the
structure audit passed. The extension check fails, but only on three panel test files that are unchanged against HEAD
(see Open questions).

## What changed and why

D = `domain/src/runtime/llm-evidence/`.

- **`D/plan-resolution/target-packets.ts` (C1a).** The frame URL is still reachable under t223's view. The sanitized
  `WebLlmEvidenceElement.attributes` keeps `data-fluxiq-frame-url`, screened as a link. Its origin and path survive,
  and a secret query value is withheld. So no change to the page view was needed.
  - `PageTarget.frameUrlPath` is the http(s) pathname of that attribute, put through `webAutomationUrlPath`, and only
    when `frameId > 0`. It is `undefined` for the top frame.
  - `WebLlmTargetResolution` (ok) gains an optional `frameUrlPath`. `resolved()` sets it only when it is known, so the
    existing deep-equal expectations are unchanged.
  - The merged-page branch keeps the newest path any page gave (`target.frameUrlPath ?? known.frameUrlPath`).
- **`D/plan-resolution/resolve-plan-node.ts` (C1b).**
  - `Resolved` carries `frameUrlPath`.
  - When `browserFrameId` is written for a frame above 0, `browserFrameUrlPath` is written beside it from the first
    resolved entry that has a path, through `webAutomationUrlPath` again.
  - The extract node gets it from the slot. An own-list literal has none.
- **`D/plan-resolution/extraction/slot.ts` (C1c).** The resolved slot returns `frameUrlPath: binding.frameUrlPath`.
- **`D/structure/handles.ts` (C1c), with a deviation from the brief.**
  - The brief asked for `frameUrlPath?` on `WebLlmExtractionBinding`. `structure/packet.ts` (not mine) builds that type
    through `present<WebLlmExtractionBinding>`, which requires every optional key to be mentioned. Adding the field
    would have broken `packet.ts`.
  - Instead I added `WebLlmKeptExtractionBinding = WebLlmExtractionBinding & { frameUrlPath?: string }`. `retain`
    accepts it, `resolve` returns it, and `copyBinding` copies the path. Existing callers still pass a plain binding.
  - The barrel is unchanged, because nobody outside the directory needs the new name.
- **`D/structure/detect.ts` (C1c and C2).**
  - `boundTarget` returns `frameDocument {origin, path}`, read from the bound element's `data-fluxiq-frame-url`.
  - `capturedDetection` takes the bound target. When `frameId !== undefined`, `expectedOrigin` is the frame
    document's origin. If that is unknown, it is still the top page's origin, so the guard is kept.
  - The page-wide re-ask uses the same bound target.
  - The binding is retained through `present<WebLlmKeptExtractionBinding>` with `frameUrlPath`. That path is written
    by name, with no spread, because of the `contract-spread` rule.
  - A header paragraph explains this.
- **`apps/extension/src/runtime/frame-address.ts` (C1d).**
  - New `FRAME_APPEAR_WAIT_MS = 5_000`, a private `FRAME_POLL_INTERVAL_MS = 100`, and a private `REPLY_MARGIN_MS = 1_000`.
  - New `waitForFrameChoice(inputs {listFrames, now, sleep}, request {recordedFrameId, urlPath, timeoutMs, startedAt})`.
  - With no path, it answers the recorded id at once and lists nothing.
  - Otherwise it calls `chooseFrame` and re-polls only while the refusal is `web.target.not_found`. Ambiguous and
    empty-list answers are final.
  - The budget is `min(5000, timeoutMs - elapsed - 1000)`, floored at 0, or 5000 when the command has no timeout.
  - The refusal is `chooseFrame`'s, with the same text. `chooseFrame` itself is unchanged and still pure.
- **`apps/extension/src/runtime/action-runner.ts`.** `runActionInFrame` calls `waitForFrameChoice` with
  `allTabFrames(tabId)`, `Date.now` and a `setTimeout` sleep, plus `action.timeoutMs` and `startedAt`. The doc comment
  now says a path is waited for.
- **Tests.**
  - New `D/plan-resolution/tests/frame-path.test.ts` has 3 cases:
    - A framed click through `run_node` dispatches `browserFrameId: 7` and `browserFrameUrlPath:
      "/scenarios/job-board/embed/job_app"`, and the plan-resolved click carries the same.
    - A top element gets neither key.
    - A framed detection's binding has the path, and the extract node resolved from it carries `browserFrameId: 7`
      and the path.
  - `D/structure/tests/detect.test.ts` has 1 new case on port 4999 at `.../embed/confirmation?app=app-1`. The frame is
    detected, the binding location's origin and path are the frame's, and `frameUrlPath` is set. When the frame
    answers from port 5000 instead, the call rejects with `/escaped the expected origin/`.
  - `apps/extension/src/runtime/tests/frame-address.test.ts` has 4 new cases on a fake clock:
    - The frame appears on the third poll and is chosen, after 3 polls and 200 ms.
    - The frame never appears: the result is `TARGET_NOT_FOUND`, equal to `chooseFrame`'s refusal, after 5000 ms and
      51 polls.
    - The budget is clamped by `timeoutMs` less the margin, and a budget already spent polls once.
    - With no path there is no listing or wait. Ambiguous and empty-list answers do not wait.

## Commands run and observed results

- `bash .../heavy.sh "t195-w20h domain check" pnpm --filter @fluxiq-web-extension/domain check`: first run built with
  no errors (52.7 s). The final run printed `"build-cache":"reuse" ... inputs and outputs match the stamp` and exited 0.
- `bash .../heavy.sh "t195-w20h extension check" pnpm --filter @fluxiq-web-extension/extension check` exited 1, with
  only these errors:
  - `src/panel/extraction/tests/dialog-dom.ts(16,37): error TS2610: 'ownerDocument' is defined as an accessor in class 'FakeElement'...`
  - The same error in `src/panel/recording/review/tests/recording-review.test.ts(20,16)`.
  - The same error in `src/panel/settings/tests/forget-confirmation.test.ts(17,16)`.
  - `git diff --quiet HEAD -- src/panel` reports src/panel unchanged, so this is not mine.
  - There were no errors in any file I touched.
- `node .../run-dir-tests.mjs domain w20h runtime/llm-evidence/plan-resolution/tests runtime/llm-evidence/structure/tests`:
  11 files, `tests 62, pass 62, fail 0`.
- `node .../run-dir-tests.mjs apps/extension w20h runtime/tests`: 18 files, `tests 235, pass 235, fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (146 warning(s), 118 baselined)`. My files got only
  advisory `file-lines` warnings, all on files already over 400 lines:
  - `action-runner.ts` is 587 lines.
  - `resolve-plan-node.ts` is 573 lines.
  - `detect.test.ts` is 639 lines.
- **Revert check, domain.** I copied my five domain sources to scratch, ran `git checkout --` on them, ran the new
  tests, then restored them.
  - The framed click failed: `actual: undefined, expected: '/scenarios/job-board/embed/job_app'`.
  - The framed detection failed: `Error: web DOM snapshot escaped the expected origin`.
  - The detect.test cross-origin case failed the same way.
  - The top-frame case passed, as a control should.
  - With only `resolve-plan-node.ts` reverted, both the click and the extract-node path assertions failed with
    `actual: undefined`.
  - All files were restored, and the diff stat matched the pre-revert one.
- **Revert check, extension.** I mutated `waitForFrameChoice` to return the first `chooseFrame` answer, which is
  today's behaviour.
  - Three new cases failed: third-poll `actual: { refused ... }, expected: { frameId: 6 }`; never-appears
    `actual: 0, expected: 5000`; and the budget case.
  - The no-path control passed.
  - The file was restored, and `grep -c` of the mutation printed 0.

## Not verified

- No Lab, browser or live run, by the brief's rules. I did not observe a real reload in Chrome renumbering the frame
  and the path finding it again, nor the real load timing against the 5 s wait.
- I did not run the full suites, by the user's rule. Only the named directories ran. Tests elsewhere that deep-equal
  a framed resolution or binding were not run.

## Open questions or contradictions found

1. **Deviation in `handles.ts`.** The cleaner form needs a 2-line change in `D/structure/packet.ts`, which I must not
   touch: put `frameUrlPath` in `WebLlmStructurePacketInput` and the binding's `present`. That would let
   `WebLlmExtractionBinding` itself carry the path and remove `WebLlmKeptExtractionBinding`. w20j, who works in
   `D/structure/` next, could fold this in.
2. **A slow existing test.** `apps/extension/src/runtime/tests/action-runner.test.ts` case "no child frame at the path
   fails as target_not_found..." now waits out the real 5 s budget (5002 ms observed). It still passes. Adding
   `timeoutMs: 1_000` to that command would make it immediate, but the file is not mine.
3. **Duplicated helpers.**
   - The frame-URL attribute read is duplicated privately in `target-packets.ts` and `detect.ts`. `structure` cannot
     import from `plan-resolution`, which imports `structure`. The shared home would be `elements.ts`, which belongs
     to t223 and is frozen for me.
   - `REPLY_MARGIN_MS` is restated in `frame-address.ts` because `landed-check-wait.ts` does not export it.
4. **The extension check is red at HEAD.** The panel `FakeElement` `ownerDocument` TS2610 errors are pre-existing,
   and `pnpm --filter extension check` fails until someone fixes them.
5. **C3 call sites remain.** The audit's C3 call sites in `node-run/run.ts`, which pass `ran.browserFrameUrlPath` to
   `webNodeReplayStatement`, are not part of this brief and were not touched.
