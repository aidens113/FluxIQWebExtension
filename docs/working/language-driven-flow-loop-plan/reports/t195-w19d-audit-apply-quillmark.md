# t195-w19d: read-only audit of `job-board-apply-quillmark`

Worker t195-w19d (read-only audit, brief from lane lead t195, session 4). Trees: downstream
`fxwork/t195/!FluxIQWebExtension` and Core `fxwork/t195/!FluxIQ`, both on `task/t195-live-control-flow` (downstream
HEAD `a15a465e`). Downstream paths below are relative to the downstream root. Core paths are relative to
`packages/fluxiq/src/programs/automation-studio/`. Job-board scenario paths are relative to `apps/scenario-lab/src/scenarios/job-board/`.

## Outcome

Done. The task cannot pass on this tree as it stands. Four causes would each fail the first live run, whatever the model
does. All four are in code that works today on single-document sites: the application form lives in a **cross-origin
iframe**, and the confirmation is a **label/value `<dl>`**, not a list. Two of the four were confirmed with a
provider-free probe against the compiled domain build (see Commands). A fifth cause is likely to fail playback. Six more
are risks.

## (a) The chain a correct build takes

1. **Start.** The tab is blank (navigate-and-extract task). Navigate to the board, `/scenarios/job-board/`.
2. **Board hazards, all on Rolefinch.**
   - A consent wall in shadow DOM: "Accept all" / "Reject non-essential" / "Manage choices" (`board/widgets-script.ts:37`).
   - The search form: What `q`, Where `l`, "Find jobs" (`board/results-page.ts:82-84`).
   - A job-alert offer about 4 s in, an email box plus "Get job alerts" / "No thanks". This is a sign-up the instruction
     forbids (`board/client-script.ts`, `showAlertOffer`).
   - The "Finch" chat opens itself over the job pane about 6 s in. Its only minimise control is an unlabelled "–"
     (U+2013) (`board/widgets-script.ts:9-12,69`).
   - The second pane opened on a page stalls until "Retry" (`client-script.ts:137-140`).
   - The sign-in wall ("Not now") appears from the 4th pane (`route.ts:11,41`).
   - Every 6th results page is a 429 (`route.ts:8,35`).
3. **Pick m1 among the look-alikes** (`catalog/postings.ts:39-60`). m1 is "Senior Rust Engineer", **Quillmark**, Remote
   (UK), Full-time, £85,000 – £100,000 a year, requisition QM-4471. The look-alikes:

   | Id | Title | Company | Location | Why it is wrong |
   | --- | --- | --- | --- | --- |
   | h1 | Senior Rust Engineer | Quillmark | Hybrid (London) | QM-4480 |
   | d12 | Senior Rust Engineer (Contract) | Quillmark | Remote (UK) | Day rate, QM-4475 |
   | d15 | Senior Rust Engineer | **Quillmark Labs** | Remote (UK) | Easy apply only |
   | d2 | Senior Rust Engineer | Kestrel & Vane | Remote (Europe) | Different company and region |
   | d7 | Senior Rust Engineer | Marlowe Freight | Remote (UK) | Different company, easy apply |

   Sponsored cards repeat real results through `pagead/clk`, which goes to `viewjob`. Clicking the card opens its pane:
   the card's link is intercepted and the pane appears after a 700 ms floor.
4. **Reach Quillmark's own careers site.** The pane's "Apply on company site" is `<a target="_blank" rel="noopener">` to
   `rc/clk?jk=…` (`board/pane.ts:41`).
   - It opens a **new tab**.
   - That tab is the "Leaving Rolefinch" hand-off page, which **meta-refreshes after 2 s** (it also has a
     "Continue to Quillmark" link) to `/scenarios/job-board/careers/quillmark/jobs/QM-4471` (`board/pages.ts:37-43`).
   - The careers page is on the **same origin**. Its fixed cookie bar ("Accept" / "Decline") covers the bottom 120 px
     until it is answered (`ats/careers-page.ts:54,66`).
   - The form is an `<iframe title="Talentloom job application">` served from the Lab's **other loopback port**
     (`context.alternateOrigin`), at `/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471`
     (`ats/careers-page.ts:31,36`).
5. **Fill the form, inside the frame** (`ats/embed-pages.ts:53-73`; behaviour in `ats/form-script.ts`). Every field:
   - First name `Morgan`; Last name `Ellery`.
   - Email `morgan.ellery@example.net`. Do not fill the off-screen `aria-hidden` honeypot "Confirm email" (`:59`).
   - Phone: the country `<select name=phone_country>` **opens on United States (+1)** and must become "United Kingdom
     (+44)". Then the number `07700 900418`, typed with or without its trunk 0, or as `+44…`.
   - Location: type into `location_text`, wait for the lookup (300 ms debounce plus a fetch), and click the option
     **"Bristol, England, United Kingdom"**. Typing "Bristol" offers two US Bristols first; typing "Bristol, England"
     offers only the right one (`ats/places.ts:113-137`). The field accepts nothing typed freehand.
   - CV: click "Enter manually" (`<a href="#">`), then type the CV text into `resume_text`, without the quotation
     marks.
   - Website `https://morganellery.example.net`.
   - Right to work: click the "Yes" pill, an unlabelled `div.tl-opt`.
   - Sponsorship select: "No". Notice select: "1 month" (`1-month`). Salary: `88000`, digits only. Source select:
     "Rolefinch".
   - **Untick** "Keep me in Quillmark's talent community…" (it arrives ticked; this is the forbidden sign-up).
   - **Tick** the privacy notice (required).
6. **Submit application.** This is the permission point (`send_or_publish`). The build asks here and the Lab grants
   (L1). The press only raises **Talentloom Shield**, a full-frame overlay reading "Please wait 3…1" on a disabled
   button. After 3 s the button reads **"I'm a person"** (`form-script.ts:106-120,159-167`). Pressing it sends:
   `mutate('submit-application')`, then `location.assign('confirmation?app=app-N')` **inside the frame**
   (`form-script.ts:122-158`).
7. **Confirmation, inside the frame** at `/scenarios/job-board/embed/confirmation`. It shows
   `<dl class="tl-receipt">` with the dt/dd pairs Role / Company / Reference (`dd[data-testid=application-reference]`)
   / Submitted (`ats/embed-pages.ts:93`). Expected table: one record
   `{role: "Senior Rust Engineer", company: "Quillmark", reference: TL-XXXX-XXXX}` (`candidate.ts:43-46`).

**How the reference is derived, and what makes it wrong.**
- `applicationReference` is two FNV-1a hashes over the JSON of the 15 normalised answers, formatted as `TL-AAAA-BBBB`
  (`ats/application.ts:73-80`). Normalisation (`:40-66`) folds case, spaces, a trunk 0 or `+44`, and a trailing slash.
- Each of these gives a different reference:
  - a wrong posting (`jobKey`);
  - the US dialling code left in place (`+17700900418`);
  - a US Bristol (`placeId`);
  - CV text with the quotes kept, or attached as a file (`file:`);
  - a wrong right-to-work, sponsorship, notice or source answer;
  - a salary other than `88000`;
  - `talentPool: true`, which is the default if nobody unticks it;
  - `privacy` unticked. In that case the form refuses to send at all.
- A filled honeypot stores the application flagged, with `reference: null`. The thank-you page then shows **no
  receipt**, so the extraction is empty (`state.ts:187-192`, `embed-pages.ts:93`).

## Question 3: is the site reset, and does a second application go through?

- **Yes, the state is reset.** The creation lane calls `resetScenarioLab` before playback
  (`packages/test-runner/src/flow-lane/creation/lane.ts:319`). That gives `applications: []`, the careers cookie bar
  back, `paneViews: 0` and `chatMinimised: false`. `prepareFlowPage("playback")` then blanks every fixture tab the build
  left open (`run-scenario.ts:279-299`), the careers tabs included.
- **Yes, a second application is accepted.** `submitApplication` has no duplicate check. It appends `app-N+1` and the
  page navigates to that id (`state.ts:181-195`, `form-script.ts:151-153`).
- The reference depends only on the answers, not the id. So a repeat with the same answers prints the same reference.
- The final-state oracle (`manifest.ts:209`) searches every page and frame of the origin
  (`run-scenario.ts:698`, `scenario-assertions.ts:61-67`), so the reference inside the careers tab's frame is found.
- During the build, the dry run **verifies** a step that declares `send_or_publish` and does not run it again
  (`flow-draft/verify-only.ts:96-100`), so dry runs send nothing.

## (b) Causes, ranked

### Blocks the first pass

#### C1. Steps built inside the Talentloom frame carry a frame id but no frame path, so none of them survives a reload

**Evidence.**
- A handle's element in a child frame resolves to `browserFrameId` only (`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:480`).
- `PageTarget` has no frame path (`plan-resolution/target-packets.ts:73,152`).
- The extraction binding keeps `frameId` only (`runtime/llm-evidence/structure/handles.ts:62-63`).
- In the extension, an action with no path goes to the recorded id (`apps/extension/src/runtime/frame-address.ts:47`),
  and an id the tab no longer has fails `TARGET_NOT_FOUND` at once (`runtime/action-runner.ts:469-481`).
- Recorded nodes already get a path (`domain/src/output-nodes/payloads.ts:43-47`), and the lift already reads it
  (`domain/src/client/gateway-action-parameters.ts:77`). Only LLM-built nodes miss it.
- Probe: the built click carries `browserFrameId: 7` and `browserFrameUrlPath: undefined`.

**Effect.**
- The dry run's reset re-navigates and clicks "Apply on company site" again, which makes a new tab and a new frame id.
- Playback does the same.
- So every type, select, check and click in the form, the Submit, and the confirmation read fail
  "addressed to frame N, which this tab does not have".
- The dry run refuses every completion, and the build never proposes a Flow.

**Second half of C1: the frame-path choice refuses at once.**
- Even with a path, the choice refuses at once (`frame-address.ts:51`).
- After the new tab opens, the frame exists only after the 2 s refresh plus the careers and frame loads.
- The dry run has no retry ladder.
- Core's ladder (250 ms, then 1 s; `runtime/executor/retry-policy.ts:30-33`) is shorter than that wait.
- The content script's 5 s recovery (`content/action-runtime/recovery/budget.ts:64`) never sees this refusal: it is
  made in the background worker.

**Fix spec.**
1. **Domain, `plan-resolution/target-packets.ts`.**
   - `PageTarget` gains `frameUrlPath: string | undefined`. For an element with `frameId > 0`, it is the **pathname
     only** of the element's published `data-fluxiq-frame-url` attribute (`WebLlmEvidenceElement.attributes`;
     `attributes.ts:25` screens it as a URL, and the path survives).
   - It is absent for the top frame.
   - `WebLlmTargetResolution` carries it, and `resolved()` and the merged-page branch copy it.
2. **Domain, `plan-resolution/resolve-plan-node.ts`.**
   - `Resolved` carries `frameUrlPath`.
   - Beside line 480, write `resolved.browserFrameUrlPath` when `frameId > 0` and a path is known.
   - Use the same `webAutomationUrlPath` rule that `output-nodes/url-path.ts` uses.
3. **Domain, extraction.**
   - `structure/handles.ts`: `WebLlmExtractionBinding` gains `frameUrlPath?`.
   - `structure/detect.ts`: fill it from the bound element: `boundTarget` returns its path, and the page-wide branch
     uses the target's.
   - `plan-resolution/extraction/slot.ts`: return it.
   - `resolve-plan-node.ts`: write it on the extract node exactly as for a target.
4. **Extension, `runtime/frame-address.ts` and `action-runner.ts`.**
   - Add a waiting choice. While a path names no listed child frame, poll `allTabFrames` every 100 ms for up to
     `FRAME_APPEAR_WAIT_MS = 5000`, bounded by the command's `timeoutMs` less the reply margin.
   - Only then refuse `TARGET_NOT_FOUND`, with the same texts as today.
   - Keep the pure choice pure: the poll loop takes `listFrames`, `now` and `sleep` as inputs.
5. **Coordinate with t223.** It owns `elements.ts`, `attributes.ts` and `sanitize.ts`. Either keep
   `data-fluxiq-frame-url` reachable on binding elements, or put a `frameUrlPaths: Map<target, path>` on
   `WebLlmSnapshotBinding` and read that instead. The plan-resolution files above are not t223's.

**Provider-free tests.**
- **Domain, new `plan-resolution/tests/frame-path.test.ts`.** Model it on this audit's probe
  (`scratchpad/w19d/probe-frame.mjs`).
  - Setup: a merged look holding one top element and one frame element. The frame element has selector
    `frame[7] >> form > button.tl-submit`, name "Submit application", and attributes `data-fluxiq-frame-id: 7` and
    `data-fluxiq-frame-url: http://127.0.0.1:4999/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471`.
  - `run_node` `web.output.dom-click` on that element dispatches `browserFrameId: 7` **and**
    `browserFrameUrlPath: "/scenarios/job-board/embed/job_app"` (the scenario's `EMBED_ROOT + "/job_app"`).
  - A top-frame element gets no path.
  - A framed detection's binding and the extract node built from it carry the path.
  - With the change reverted, the dispatched parameters lack the path.
- **Extension, `runtime/tests/frame-address.test.ts`.**
  - A waiting choice whose fake frame list gains the path on the third poll returns that frame.
  - One that never gains it refuses `TARGET_NOT_FOUND` after the budget.
  - It never waits when the path is absent.

#### C2. Structure detection inside a cross-origin frame always throws, so the confirmation can never be read

**Evidence.**
- A detection addressed to a frame captures that frame alone (`apps/extension/src/runtime/look-across-frames.ts:44`).
- Its snapshot's `url` is the frame's own `location.href` (`content/dom-snapshot.ts:60`), on the Lab's other port.
- `structure/detect.ts:148-151` passes the **top page's** origin as `expectedOrigin`.
- `sanitize.ts:166` throws "web DOM snapshot escaped the expected origin", which is a plain error, so a tool fault and
  not a refusal.
- Probe output: `DETECT threw: web DOM snapshot escaped the expected origin`, after
  `[["web.dom.capture_snapshot",null],["web.dom.capture_snapshot",7]]`.
- The existing framed test passes only because its fake returns the top URL for the frame
  (`structure/tests/detect.test.ts:273-286`).

**Effect.** The build cannot detect the receipt, so the Flow has no extract node. The judge then fails it with "The
created Flow has no extract node" (`creation/judgement.ts`).

**Fix spec, domain `structure/detect.ts` (not a t223 file).**
- In `capturedDetection`, when `frameId !== undefined`, the expected origin is the origin of the frame document the
  bound element was shown in. That is the element's `data-fluxiq-frame-url` from the packet, passed down from
  `boundTarget` (see C1 step 3).
- When no frame URL is known, keep refusing: do not drop the guard.
- The top-frame rule is unchanged.

**Test, `structure/tests/detect.test.ts`.**
- Add a framed case whose frame capture answers with a URL on another port: `http://127.0.0.1:4999/scenarios/job-board/embed/confirmation?app=app-1`.
- It is detected, and the binding's `location` is the frame's.
- A frame capture whose origin differs from the one the element was shown with is still a fault.
- It fails with the change reverted.

#### C3. A label/value receipt cannot be read as one record

**Evidence.**
- The page has one `<dl class="tl-receipt">` holding `dt` Role / `dd` title, `dt` Company / `dd` company, `dt`
  Reference / `dd[data-testid]` reference, and `dt` Submitted / `dd` date (`ats/embed-pages.ts:93`).
- List inference groups siblings by template signature (tag, role, test id, classes)
  (`apps/extension/src/content/extraction/infer-list.ts:98-111`). Here that yields:
  - a run of the three `dd` with no test id (title, company, date), where the **reference is excluded** by its test id;
  - a run of four `dt`, which are the labels.
- Either way the records are one-field rows, never `{role, company, reference}`.
- Aimed at the reference, nothing repeats around it, and the outward or page-wide search answers one of those runs
  (`detect-structure.ts` header).
- The model is never shown selectors, so it cannot write the recording's `dl` with `dd:nth-of-type(n)` itself
  (`plan-resolution/extraction/slot.ts` header).
- The judge compares exactly one record with keys `role`, `company`, `reference`
  (`run-expectations/extraction/judgement.ts:74-110`).

**Fix spec.** This is the extension extraction area and not a t223 file.
1. **New `content/extraction/key-value-record.ts`.** A pure rule.
   - It applies to a `<dl>` whose element children are `dt`/`dd` pairs. Allow one `dt` followed by one or more `dd`,
     optionally wrapped in a `div`, with at least 2 pairs.
   - The proposal is `{ container: <dl's parent>, item: <selector naming exactly this dl>, itemCount: 1, fields }`.
   - It has one `text` field per pair, sourced `:scope > dd:nth-of-type(k)` (or the wrapped form).
   - Each field is labelled by its `dt` text. A `dt` is page structure, like a column header (D3/D16 in
     `infer-fields.ts`'s header).
   - Coverage is 1 and confidence comes from the item selector.
2. **`infer-list.ts`.** A pick inside such a `dl` that finds no run of 3 or more nearer than the `dl` proposes the
   key-value record. A run of 3 or more enclosing the `dl` still wins, for example a list of receipts.
3. **`detect-structure.ts`.**
   - The outward search and the page-wide search offer it.
   - Rank it above thin runs and below rich runs of 2 or more items.
4. **Check `domain/src/runtime/llm-evidence/structure/packet.ts`.** It must pass a 1-item proposal through, and
   `slot.ts` must accept `minItems`/`maxItems` of 1.

**Tests.**
- **Unit, `content/extraction/tests/key-value-record.test.ts`.** Use the fake elements of `tests/fake-shadow-dom.ts`,
  built with the exact structure `renderConfirmation` emits.
  - It proposes one item and four fields labelled Role, Company, Reference, Submitted, each `dd:nth-of-type(k)`.
  - A `dl` with one pair, a `ul`, or a `dl` of bare `dd`s proposes nothing.
- **Browser coverage.** A case in `e2e/content/tests/extraction/inference.spec.ts` that reads the receipt. This is not
  provider-free and not run now.

#### C4. The dry run cannot pass a submit whose effect shows on the same page (shield), then in the frame (confirmation)

**Evidence.**
- Submit declares `send_or_publish`, so the dry run **verifies** it and does not press it (`flow-draft/verify-only.ts:96-100`).
- Steps after it are excused only when the **next** step's `replay.from` differs (`llm/node-tools/replay-draft.ts:126-128`,
  `verify-only.ts:150-155`).
- The domain writes `from: { location }` (`domain/src/runtime/llm-evidence/node-run/replay.ts:83-88`), and that
  location is the **top frame's** page URL (`node-run/run.ts:345,370,466,501-503`). So every frame step on the careers
  page has the same `from`, form or confirmation alike.
- The next step after Submit is "I'm a person", on the same page.

**Effect.**
- With Submit withheld, the shield is hidden, so "I'm a person" fails if it was declared `[]`.
- If it was declared lasting, it answers `present`, not `verified`, so it moves nothing.
- The confirmation read then finds the form and fails.
- Neither failure is excused. The draft is refused on every completion, and refused again after two replays
  (`dry-run-gate.ts`).

**Fix spec.**
1. **Domain, `node-run/replay.ts`.** `webNodeReplayStatement` takes `frame?: string`, the resolved node's
   `browserFrameUrlPath`, and writes `from: { location, frame }`.
   - Its three callers in `node-run/run.ts` (lines 345, 370, 466) pass `ran.browserFrameUrlPath` once C1 lands.
   - `run.ts` is **t223's file**. Hand these three call sites to t223, or sequence them after t223 merges.
2. **Core, `llm/node-tools/replay-draft.ts`.**
   - Set `withheldBy` for a verified step when **any** later proposed step was found somewhere else, not only the next
     one.
   - Give that step's `withheldBy` to every non-replayed outcome from that step on.
   - Rename or extend `automationStudioFlowDraftStepMovedTarget` in `flow-draft/verify-only.ts` to take the remaining
     steps, and update the header's "the next proposed step" wording.
3. **Fallback if step 1 cannot land first: Core alone.** Excuse every non-replayed step after a verified step that
   declared `send_or_publish` or `move_money`. This is looser, and it is the supervisor's call.

**Tests.**
- **Core, `llm/node-tools/tests/replay-draft.test.ts`, new case.** Use a scripted `executeTool`.
  - Steps: type (replayed); submit, declared `send_or_publish` (answered `core.replay.verified`); confirm-person,
    declared `[]`, same `from` (answered `core.replay.failed`); extract, `from.frame` = `/scenarios/job-board/embed/confirmation`
    (answered `core.replay.unreproducible`).
  - Expect `verdict.ok` with both failures `withheldBy` = the submit's position.
  - A control case: a verified step followed only by same-`from` steps, one failing, still blocks.
  - It fails against today's next-step rule.
- **Domain.** `node-run/tests/` asserts `webNodeReplayStatement({location, frame})` returns `from` with both, and with
  `frame` absent for the top frame.

#### C5. Likely: "I'm a person" is disabled for 3 s after Submit, and a gate-level `disabled` is never waited out

This blocks playback when the resolver lands on the disabled button.

**Evidence.**
- The button is `disabled` and reads "Please wait N" for 3 s (`ats/form-script.ts:106-119`).
- The click gate refuses it `ACTION_REJECTED` (`content/actions/click.ts:141-143`, `content/action-runtime/results.ts:226-230`).
- That code is not retryable (`domain/src/runtime/failure/codes.ts:204`).
- The in-page recovery absorbs `covered` and `hidden` but deliberately not `disabled`
  (`content/action-runtime/recovery/fault.ts:136`), because check, upload and select-option produce `disabled` after
  acting.
- A Flow reaches this step well inside 3 s.
- If the identity veto refuses the "Please wait 2" button (its name differs from "I'm a person"), the fault is instead
  `target_absent`. That is absorbed for up to 5 s, which covers 3 s. Which way it goes depends on the veto score of a
  selector match whose text and name disagree; this audit did not run the scorer.

**Fix spec, extension.**
- `actionRejected` takes an optional `{ beforeDispatch: true }`, carried on the failure record. Use a closed field,
  not prose.
- The actionability **gate** call sites set it: `click.ts:143`, `type.ts`, `select.ts`'s select gate, and `check.ts`'s
  first gate.
- `recovery/fault.ts` absorbs `disabled` only when it was produced before dispatch.
- It stays bounded by `RECOVERY_BUDGET_MS = 5000` (`budget.ts:64`).

**Test, `content/action-runtime/recovery/tests/attempt.test.ts`.**
- A click whose first attempt is gate-`disabled` and whose second is actionable is absorbed and succeeds.
- A `disabled` from `check.ts` after `setCheckedState` is not absorbed.
- A gate-`disabled` that outlasts the budget fails as today.

### Risk: does not always fail, but can

- **R1. A page-only verify of Submit needs the form valid at verify time.** It is not checked, and it is fine today
  because the form is re-filled first. No action.
- **R2. The draft and instruction shown to the model are capped at 4,000 bytes** (top cause 3, **t200**).
  - This instruction is about 1,050 characters, and the draft has 25 or more steps, one of them typing a 190-character CV.
  - The values the model needs late in the build (phone, salary, notice, "do not sign up") are exactly the ones the cap
    cuts.
  - Route to t200. No fix here.
- **R3. The judged dataset is the Flow's first extraction by execution order.**
  - `creation/judgement.ts` and `flow-lane/expectations.ts:203-206` (`ordered[position]`) decide this.
  - A Flow that also reads the results list to choose among look-alikes is judged on that list.
  - Fix spec, test-runner `flow-lane/creation/judgement.ts`: for a created Flow with one expected step, pair it with
    the dataset whose field names cover the expected record's keys, and fall back to execution order.
  - Test: two datasets (postings, then the receipt) pass; with the change reverted they fail. Owner: the judge lane
    (t194), or the supervisor.
- **R4. The model may declare `send_or_publish` on "Apply on company site".**
  - The Lab denies it as `control_differs` (`creation/permission-point.ts:38`, `person-simulation/permission-answer.ts`).
  - P1 then refuses that question unasked, and the domain says "do it another way or finish without it".
  - A model that pressed it again with `[]` would pass. One that finishes without it fails.
  - `core.run_node`'s description has no room (1,990 of 2,000).
  - Fix candidate: add "a press that only opens a page or form is `[]`" to the `consequences_declined` reason text in
    `domain/.../tool-rejection.ts`. That is a **t223** file, so route it there or to t195 after t223.
- **R5. Value traps the page view must show** (**t223**): the checked state of the talent-pool and privacy boxes, the
  phone country `<select>`'s selected option, the lookup's suggestion list, and the honeypot.
  - The honeypot is listed, because `rendered-elements.ts` keeps `aria-hidden`.
  - Typing into it is refused by actionability as `hidden`, since its box is at x = -10000.
  - So it cannot be filled, but the model may waste decisions on it. t223 should mark or omit off-document `aria-hidden`
    controls.
- **R6. The chat covers the apply link from 6 s, and "–" is no way out.**
  - `CLOSE_GLYPH` is `[×✕✖╳xX]` (`content/action-runtime/interference/vocabulary.ts:74`).
  - A playback whose Flow waits for the 4 s "No thanks" reaches Apply at about 5-5.5 s, close to 6 s.
  - Do **not** add a bare "–" or "−" glyph. A cart's quantity decrement uses the same glyph, and pressing it would remove
    a line.
  - Route to lane A (interference) with a narrower rule: a minimise glyph that is the last control of a layer's header
    row, on a layer that is not a dialog.
  - Test idea: the rf-assistant markup (`board/widgets-script.ts:56-77`) clears, and a quantity stepper does not.
- **R7. The hand-off page races its meta refresh.**
  - If the build recorded a press of "Continue to Quillmark" on `rc/clk`, playback presses it after about 1 s of
    tab-ready wait. The page refreshes at 2 s.
  - Usually this is in time. If the refresh wins, the step's target is gone, and in the dry run that fails.
- **R8. The new tab's activation is unverified here.**
  - Every action re-reads Chrome's active tab (`background/connection/server-command-channel.ts:184-188`), so the
    careers tab is used only if Chrome brings it to the front.
  - Playwright launches with its default switches, which include `--disable-popup-blocking`, and
    `launch-browser.ts:29` does not remove them. So the synthetic click's `target=_blank` should open a foreground tab.
  - This needs a browser check. The first Lab run will show it.

## (c) Causes that belong to other lanes

- **t223** (page view; its files):
  - C1 step 5: keep the frame URL reachable from binding elements.
  - C4 step 1: the three `from` call sites in `node-run/run.ts`.
  - R4: the `consequences_declined` wording.
  - R5: page-view marking of the honeypot, checked state, selected option and suggestions.
- **t200**: R2, the 4,000-byte draft and instruction cap.
- **t196, or t195 by the supervisor's call**: C4's Core half (`replay-draft.ts`, `verify-only.ts`), which is the dry-run
  area of top cause 1.
- **Lane A** (interference): R6.
- **Judge lane (t194) or supervisor**: R3.
- **Lane B** (`recovery/runtime-exploration.ts`): not reached by a first pass. A repair would only run on a playback
  failure.
- **t195 itself**: C1 steps 1-4 (domain plan-resolution and extension frame wait), C2 (`structure/detect.ts`), C3
  (extension extraction), C5 (extension recovery). They partition by file:
  - (i) domain `plan-resolution/*` + `structure/{handles,detect}.ts`. Detect is touched by both C1 and C2, so C1 step 3
    and C2 go to one worker.
  - (ii) extension `runtime/{frame-address,action-runner}.ts`.
  - (iii) extension `content/extraction/*`.
  - (iv) extension `content/actions/{click,type,select,check}.ts` + `action-runtime/{results.ts, recovery/fault.ts}`.

## What changed and why

Only this report. No source file was edited.

## Commands run and observed results

- **Probe** `node <scratchpad>/w19d/probe-frame.mjs`, run from `domain/`. It imports the compiled `domain/dist`
  (`dist/runtime/llm-evidence/*.js` built 2026-09-30T22:17, newer than every source it covers), drives a fake gateway,
  and makes no browser or provider call. Printed:
  - `LOOK elements: [["target.1","Accept",0],["target.2","Submit application",7],["target.3","TL-ABCD-EFGH",7]]`
  - `CLICK command parameter keys: ["browserFrameId","checkWaitMs","element","selector"]`
  - `CLICK browserFrameId: 7 browserFrameUrlPath: undefined`
  - `PRESS resultCode: web.action.succeeded`
  - `DETECT threw: web DOM snapshot escaped the expected origin`
  - `DETECT commands: [["web.dom.capture_snapshot",null],["web.dom.capture_snapshot",7]]`
- Everything else was read in source; no tests or builds were run.

## Not verified

- Live browser behaviour: whether the new tab is foreground (R8), the shield timing against the resolver (C5's
  veto-score branch), and the chat's 6 s cover in playback (R6).
- The C3 claim about which run detection answers on the receipt. It is read from `infer-list.ts` and `detect-structure.ts`;
  the walk needs a DOM and was not executed.
- C4 was traced in Core and domain code, not run.
- How the model will behave (what it declares, whether it unticks the box, which phone country it picks).

## Open questions or contradictions found

1. `runtime/frame-address.ts`'s header says Chrome renumbers a frame "every time the frame navigates". Chrome keeps a
   frame's id across its own navigations and gives a new id only to a new frame (reload or new tab). C1 holds either
   way, because the dry run and playback both open a new tab.
2. C4 needs a supervisor decision if t223 cannot take the `run.ts` call sites soon: the Core-only fallback is looser
   than the current rule that was written against runs 18, 21 and 33.
3. The task declares `permissionPoint.control: "Submit application"`, but the act that sends is "I'm a person". This is
   correct for a person-facing ask; it only matters if a model declares the class on the second button alone.
