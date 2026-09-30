# t181-b: Simple Mode recording UX (steps with Remove, analysis, preview, test, save)

## Outcome

Done. Two DOM pieces and their pure models are under
`apps/extension/src/panel/simple/recording/`. Nothing outside that directory was
touched, and nothing is wired into `simple-view.ts` or `now-card.ts`; the
supervisor does that wiring.

## What changed and why

The layout uses subdirectories, not a flat folder. Flat, `recording-steps`,
`recording-review` and `recording.css` would be three `recording-*` siblings,
and the naming rule fails a shared prefix at 3.

- `recording/index.ts`: the barrel. It uses explicit named exports because no
  other panel barrel uses `export *`.
- `recording/recording.css`: all classes use the `recording-` prefix and all
  colours come from tokens. It reuses `.card`, `.primary-button`,
  `.small-button` and `.notice` from shell.css.
- `recording/plain-words.ts` (`plainWords`): collapses whitespace and cuts to a
  maximum length. It drops anything that looks like a selector, XPath, id, hex
  or uuid, dotted id, or URL. Both the step list and the preview use it.
- `recording/payload-fields.ts` (`payloadFields`): the one defensive
  "is this a plain object" reader.
- `steps/step-rows.ts` (`stepRows`): parses a `getRecordingLog` reply into
  `{id,label,detail?}` rows, newest first.
  - Only the person's own actions count as steps: dom.click, input, change,
    submit, keydown, wheel and scroll, and browser.navigation.
  - Connection, recording, snapshot, dom.mutation and `Evidence:` entries are
    skipped.
  - A navigation's detail is cut to its hostname.
  - When the detail is a selector, the step falls back to words with no name,
    such as "Clicked something" or "Changed a field".
- `steps/steps-model.ts` (`reduceSteps`, `REMOVE_UNSUPPORTED`): a pure reducer
  for how each Remove can end.
  - A removed id is filtered from later log reads.
  - `unsupported` sets `removable=false` for good and shows the brief's
    sentence. The sentence clears when the recording ends and is never shown
    again, because no Remove button can be pressed after that.
  - Any other failure shows `result.sentence` (with the detail as the tooltip)
    until a Remove succeeds.
- `steps/recording-steps.ts` (`createRecordingSteps`): shown while
  `recordingState` is `recording` or `paused`. The heading reads "Recording
  paused" while paused.
  - It reads `getRecordingLog {page:1,pageSize:5}` whenever `eventCount`
    changes. A sequence number drops out-of-order replies and replies that
    arrive after the recording ends.
  - Each row has Remove, with `aria-label` "Remove step: <label> <detail>". It
    sends `removeRecordingStep {entryId}` and reads the log again on success.
  - The `// SEAM(t180): pause/resume` comment marks where Pause goes, in the
    header. No pause message was added.
- `review/generated-preview.ts` (`generatedPreview`): parses
  `{payload:{result}}` defensively.
  - It accepts a proposal at `result.proposal` or `result` itself.
  - It looks for the Flow at `result.flow`, `proposal.flow`, or `proposedFlow`.
  - The name comes from flow name or title, then proposal title or name,
    falling back to "Your new automation".
  - Step lines come from `nodes` or `steps`, as an array or a map. Each line is
    the first plain label, title, name, `data.label` or `data.title`. There are
    at most 8 lines, and `more` counts the rest.
  - `proposalId` and `flowId` are kept only to send back with Test and Save.
- `review/test-outcome.ts` (`testOutcome`): `passed` means
  `runSummary.status === "succeeded"`. `interventions` is a positive integer or
  0.
- `review/review-model.ts` (`reduceReview`, `previewOf`, `NOTHING_TO_PREVIEW`):
  the phases are hidden, offer, analyzing (stage analyzing→building), preview,
  testing, tested, saving, saved, unavailable, and failed(sentence, detail,
  preview?).
  - An offer appears on a status that goes from recording or paused to idle
    while `connectionState==="connected"`.
  - The first status only sets the baseline.
  - The review hides when a new recording starts, or on dismiss.
  - A result applies only in the phase that asked for it.
  - `unsupported` at any step moves to unavailable.
  - A failure keeps the preview, so Test and Save stay available.
- `review/review-view.ts` (`reviewView`, `REVIEW_COPY`): the words and buttons
  for each phase, as data. The brief's exact sentences are used. The line reads
  "AI activated N time(s)" only when N > 0. Busy phases leave only Done enabled.
- `review/recording-review.ts` (`createRecordingReview`): sends
  `generateFromRecording`, `testGeneratedAutomation` and
  `saveGeneratedAutomation`. Test and Save carry `proposalId` and `flowId` only
  when they are known.
  - "Building the automation..." replaces "Analyzing your steps..." after
    2.5 s.
  - A `review` counter drops replies from an earlier review.
  - The card redraws only when the phase changes, so a status push never
    rebuilds a button under the pointer or focus.
  - The Open FluxIQ button is `createOpenFluxIQButton(request,{label:"Open FluxIQ",look:"primary"})`.
    It sees every status through `observe`.
- Tests, in 5 files:
  - `recording/tests/plain-words.test.ts`
  - `steps/tests/step-rows.test.ts`
  - `steps/tests/steps-model.test.ts`
  - `review/tests/payload-parsing.test.ts`
  - `review/tests/review-model.test.ts`, which covers both review-model and
    review-view

## Commands run and observed results

- `powershell (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory` gave
  1729348 KB on the first read, which is under 2 GB, so I did not run anything.
  It gave 2010412 KB on the re-read, and I ran the checks after that.
- `npx tsc -p tsconfig.json --noEmit`, from apps/extension: no output, exit 0.
- `npx tsc -p tsconfig.test.json`: no output, exit 0.
- `EXTENSION_TEST_BUILD_LABEL=t181-b node scripts/test-extension.mjs`: exit 0,
  with `# tests 1099`, `# pass 1099` and `# fail 0`. The 26 new tests are
  ok 846–871.
- `node scripts/structure-audit.mjs`, from the repo root, which the brief did
  not require: `structure-audit: passed (114 warning(s), 120 baselined).` No
  finding names `simple/recording`.
- Every file is at most 127 lines.

## Not verified

- **The DOM pieces:** `recording-steps.ts` and `recording-review.ts` have no
  test, because the node test runner has no DOM. Nothing is mounted in a
  browser either: they are not wired, and the brief allowed no live runs.
- **The payload shapes:** the real shape of Core's
  `generate-recording-proposal` result is not verified. I did not read Core,
  because it is outside the brief, so the parser guesses several field
  spellings.
- **Whether the log holds steps:** I did not check whether the 5 newest log
  entries while recording are usually steps. Snapshot and mutation entries are
  logged too, so the visible list can be shorter than 5, or empty for a moment.
  The brief fixed the page size at 5.

## Open questions or contradictions found

1. **Test and Save request fields.** `testGeneratedAutomation` and
   `saveGeneratedAutomation` do not document their request fields in
   `relay/messages.ts`. I send `proposalId` and `flowId` when the preview
   carries them. The t182 relay needs to agree on these names, or messages.ts
   should document them.
2. **Remove's aria-label.** The brief says "Remove step: <label>". I append the
   detail ("Remove step: Clicked "Add to cart"") so that several "Clicked" rows
   can be told apart. Drop the detail if the Lab presses the button by an exact
   name.
3. **When the offer appears.** A recording that ends while disconnected gets no
   offer, even after reconnecting, because the brief says "while connected".
   Opening the panel after a recording ended gives no offer either, because the
   first status is only the baseline.
