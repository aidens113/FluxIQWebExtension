# What "Looking at the page… Done" repeated really was

Read-only investigation, 2026-09-30. Nothing was run, edited, or committed apart from this file.

## Outcome

Done. Every "Looking at the page" / "Done" pair is **(b)**: a real `web.dom.capture_snapshot`
command that reached the extension and succeeded. None is (d), a UI event with no operation behind it.

Most of these pairs are not looks the model asked for. They come from Core's own state-digest
bookkeeping. The build loop takes a full page capture before and after every tool call. It also
takes one each time it answers a repeated look from memory. So (c) as written, "answered from
memory with no extension call", never happens: every answer from memory still sends one capture
to the extension.

The surface the user watched is the side panel's **"Right now" card**, not the on-page activity
overlay. The card's `running` row reads "FluxIQ is working / Looking at the page". Its `done` row
reads "Done / Last step: Looked at the page".

**The five pairs before FluxIQ did anything** were in lane B's first build, `t193`
`run-munneauy-de8663ed` (bigbox; build 05:14:48–05:15:50Z). The brief's list did not include this
run, but its build falls inside the user's viewing window. The five pairs came from:

- 3 captures for the free first look: a digest before it, the look itself, and a digest after it.
- 2 captures before the first action: the navigate call's digest before it, and the node's
  pre-action page read.

Only then did the navigation run. Those five pairs involved 1 provider call, and that call chose
*navigate*. There were 0 model-requested looks and 0 other extension actions.

Every build opens the same way. The same build later showed about 18 look/done pairs in a row
(iterations 7–17), with 11 provider calls and no action between them.

## What changed and why

Only this report was written.

## Evidence

### 1. Where the words come from (label trace)

- The extension's **side-panel "Right now" card** produces the words:
  - `apps/extension/src/panel/copy/step-copy.ts:47` maps `web.dom.capture_snapshot` to "Looking at
    the page" / "Looked at the page".
  - `apps/extension/src/panel/simple/now-copy.ts:48` shows the `running` row ("FluxIQ is working" +
    present tense).
  - `now-copy.ts:53` shows the `done` row ("Done" + "Last step: Looked at the page").
- The card is driven by extension runtime command status, not by Core's activity stream:
  - `apps/extension/src/background/connection/server-command-channel.ts:177` calls
    `runtimeStatus.startAction(payload.action)` for **every** `execute_action`.
  - `runtime-status.ts:41` (start) and `:53` (finish) handle the status. Nothing filters by
    `metadata.source` or purpose.
- Core's activity hub never says "looking at the page":
  - `runtime/activity/observer.ts:24-27` says "Using core.run_node" and "Using core.run_node:
    web.inspect.succeeded".
  - Its phase `done` appears only at the end of a build or run (`activity/build.ts:17`,
    `activity/run.ts:9`).
- The observer wraps `decide`/`executeTool`/`checkCompletion` but **not `captureStateDigest`**. So
  the digest captures never reach Core's activity stream. They reach only the extension's
  command-status card.
- Screenshots confirm the card. Lane C's screenshots
  (`scratchpad/t194/shots/run01/*.png`, 05:19:24–05:24:14; contact sheet at
  `scratchpad/lookrep-t194-sheet.png`) show the card alternating between "FluxIQ is working /
  Looking at the page" and "Done / Last step: Looked at the page".
- **No on-page activity overlay was visible** in the two full frames I opened (05:19:40, 05:23:44).
  Neither frame has a card in the bottom-right of the page. Why the overlay is absent is not
  established.

### 2. The operation behind each pair (capture accounting)

Captures per loop step, from the code at Core `f0dbbd6` (t193/t194/t195 Core worktrees) and the
domain at ext `defcbe2d`:

| Step | `capture_snapshot` commands to the extension | Source |
| --- | --- | --- |
| Free first look | 3 | Core `runtime/llm/evidence-loop.ts:408` digest before, domain look (`node-run/run.ts:202`, `currentPage`), `evidence-loop.ts:410` digest after |
| Model look (run_node capture_snapshot) | 3 | `evidence-loop.ts:588` + `run.ts:202` + `evidence-loop.ts:590` |
| Model action that runs (click, navigate, extract_list) | 4 + the action | digest, `run.ts:222` currentPage, action, `run.ts:335` captureAfterAction (≥1, retried every 250 ms while unreadable), digest |
| Action the domain refuses before acting (target_unobserved) | 3 | digest, currentPage, digest |
| detect_repeating_structure | about 4 | 2 digests + `structure/detect.ts:84` and `:128` |
| Look answered from memory (`already_answered`) | 1 | `runtime/llm/decision-handlers/answer-check.ts:38` fresh digest |
| amend / unusable / complete | 0 | (dry-run replays not counted; see "Not verified") |

A digest is a full round trip. The domain's `captureStateDigest`
(`domain/src/runtime/llm-evidence/tools.ts:355-390`) calls `captureEvidence`
(`capture.ts:316-324`), which sends `web.dom.capture_snapshot`, then hashes the packet and throws
it away. The domain's own comment at `node-run/run.ts:193-195` warns against exactly this: "taking
one before it and one after it would make the cheapest thing a build does cost three". Core's
loop does it anyway, through the digest hook
(`runtime/service/flow-bootstrap-commands/state-digest.ts`, wired at `runtime/service.ts:1552,1567`).

**Timing supports this.** From the `FLUXIQ_BUILD_PROGRESS_TRACE` lines in t193
`run-munnq7vz-98c3481c/logs/core.log`:

- A look tool takes 98–125 ms.
- Each gap between "loop start" and "tool start", between "tool end" and "decide start", and
  between "decide end" and "tool start" is 100–140 ms. That is one capture per gap.
- An answered iteration shows "decide end" followed by the next "decide start" about 107 ms later,
  with no tool line. That is the answer-check capture.

**Counts from Core's own records** (`snapshots/flow-lane.json` → `build.evidenceLoop.steps`, with
`usage` meaning a provider call). The capture counts are estimates from the table above:

| Build | Decisions | Provider calls | Model looks run | Looks answered from memory | Real non-look actions | Actions refused before acting | Est. capture commands |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t193 run-munneauy (lane B, 05:15Z) | 1–18 (all) | 18 | 3 | 9 | 3 | 2 | about 39 |
| t193 run-munnq7vz (lane B, 05:24Z) | 1–20 | 20 | 5 | 5 | 4 | 3 | about 60 |
| t194 run-munnhi5q (lane C, 05:16Z) | 1–20 | 20 | 0 | 0 | 15 (incl. 6 extract_list reruns) | 0 | about 79 + dry runs |
| t195 run-munnop9n (lane D, 05:22Z) | 1–20 | 19 | 1 | 0 | 9 (incl. reruns) | 2 | about 56 |

The t195 build at 05:11Z (`run-munnetuw-1bba61e6`) never started a build. Its side-panel page
crashed ("page.goto: Page crashed"), with 0 provider calls.

Sequence for t193 `run-munneauy` iterations 7–17, from 05:15:19 to 05:15:50Z:

1. Look (3 captures).
2. Two answered repeats (1 each).
3. A look that ran (3, or 4 with its answer check).
4. Seven answered repeats (1 each).

That is about 18 look/done pairs, 11 provider calls, and no click or navigation. Iteration 18 then
ended the build with `flow_bootstrap.evidence_repeat_without_progress`.

### 3. t189's repeat handling

- **t193 run-munneauy: it fired, and the model did not follow it.**
  - The `already_answered` rows (iterations 8, 9, 11–17) are written only by
    `decision-handlers/answered-request.ts:44-69`. That path always pushes the answered-request note
    and calls `noProgress.redirect(iteration, answeredAgain >= 2)` (line 73). So a note went in on
    each of the 9 answers, and the immediate redirect was due from the second answer out of the
    same result (iteration 9).
  - The model asked again seven more times. The no-progress guard ended the build at iteration 18,
    as designed.
- **t193 run-munnq7vz:** answered repeats appear at iterations 11, 13–16, 21, 26, 34, 36, 42 and 44.
  Real actions in between reset the count, and the build ran to the iteration limit (64,
  `evidence_iteration_limit`).
- **t194: it did not apply, by design.**
  - There is no `already_answered` row at all. The repetition was six amend→rerun cycles of
    `dom-extract_list` (iterations 8–19, page unchanged) plus three `dry_run_refused` decisions
    (21–23).
  - A rerun the model asks for is exempted from the repeat policy (`evidence-loop.ts:536-545`,
    `rerunning`), and a rerun's changed answer bytes count as progress
    (`evidence-loop/no-progress.ts`).
- **What the records cannot show:** the text of the note. Neither `decision-trace.json` nor
  `flow-lane.json` keeps note content, `timesAsked`, or whether a redirect was shown. So "Nth time,
  no action since" cannot be confirmed as the wording the model read.

### 4. Is the first observation itself several pairs?

Yes. The free first look is 3 captures: digest before, the look, digest after. It carries no
provider call. The navigate that follows adds 2 more before it acts.

- In t193 `run-munneauy`, iteration 0 `pageState` is `unchanged`: both digests came back, so these
  captures succeeded and each one shows "Done".
- In t194 `run-munnhi5q` and t195 `run-munnop9n`, iterations 0–1 are `unobserved`. At least one
  digest came back `page_unreadable`, which only happens when the capture's result status was not
  `succeeded` (`capture.ts:331`). Those builds' opening captures probably showed "A step didn't
  work" rather than "Done". This is not verified.

## Cause, owning files, and who should fix it

1. **Cause, in Core with the domain behind it (t189's area, `runtime/llm/**`):**
   - Core's evidence loop digests the whole page before and after every tool call, including the
     initial look (`runtime/llm/evidence-loop.ts:408,410,588,590`).
   - It re-captures once per repeat it answers from memory
     (`runtime/llm/decision-handlers/answer-check.ts:38`).
   - The domain's `captureStateDigest` (`domain/src/runtime/llm-evidence/tools.ts:355-390`)
     answers each digest with a fresh `web.dom.capture_snapshot` round trip instead of hashing the
     packet the tool just captured.

   The result: a look costs 3 extension captures, an action costs 4 plus the action, and an answer
   from memory costs 1.

   Recommended fix:
   - The digest reuses the packet the step already has. A look's after-digest is its own packet. An
     action's after-digest is `captureAfterAction`'s packet. A before-digest equals the previous
     step's after-digest when nothing ran in between.
   - The answer check should not capture when no action has run since the answering call.

   This touches `runtime/llm/**`, `runtime/service/flow-bootstrap-commands/state-digest.ts`, and the
   domain's `llm-evidence/tools.ts`.
2. **What the user sees (t191's area, the activity UI):**
   - The "Right now" card reports Core's internal digest reads as user-visible steps.
   - It says "Done / Last step: Looked at the page" in the middle of a build that is still thinking.
   - The on-page activity overlay did not appear in the screenshots at all.
   - Digest captures carry the same metadata as the step they bracket (`capture.ts:185-186`:
     `source: "llm-evidence-runtime"`, the step's own `callId`), so the extension cannot tell them
     apart today. Separating them needs a marker from the domain, for example a distinct `source`
     for digests and answer checks. After that, the card can either ignore those reads or show
     Core's activity phase while a build is live.

## Commands run and observed results

All commands were read-only.

- `ls`/`find` over the lane run folders, and `cat` of `summary.json`, `events.ndjson`, `logs/*.log`
  and the lane launch scripts and logs.
- A `node -e` dump of `snapshots/flow-lane.json` `build.evidenceLoop.steps` for the 4 builds (tables
  above).
- `grep build-trace logs/core.log`:
  - t193 run-munnq7vz: 257 trace lines.
  - t195 run-munnop9n: 184 trace lines.
  - t193 run-munneauy: 0 trace lines.
- `git -C fxwork/<lane>/!FluxIQ rev-parse HEAD` → `f0dbbd6` for t193, t194 and t195.
  - t193/t195 Core have uncommitted edits in `runtime/llm/evidence-loop.ts`, `service.ts` and
    others, plus the untracked `progress-trace.ts`.
  - t194 Core is clean.
- Tally script `scratchpad/lookrep-count.js` (counts above).
- A PowerShell contact sheet of the "Right now" card crops from the t194 screenshots
  (`scratchpad/lookrep-t194-sheet.png`).

## Not verified

- **No extension-side command log.** The run bundle does not record the `server.action` commands
  the extension received, so the capture counts are derived from code paths plus trace timing, not
  counted.
  - Instrument: have the Lab record each command (actionType, `metadata.source`, `callId`, status,
    timestamps) into the bundle.
  - Or add `digest start/end callId phase` lines to `evidence-loop/progress-trace.ts` by wrapping
    `captureStateDigest`.
- **The screenshots cover a different moment.** They are lane C's and start at 05:19:24. No
  screenshot covers t193's opening five pairs.
- **Whether the failing opening captures showed "A step didn't work"** in t194 and t195.
- **Captures inside dry-run replays** (`decision_unusable dry_run_refused`, `replay.ts`) were not
  counted.
- **The 9–24 s between Lab `runtime.dispatch` and "loop start"** is unaccounted for. It may hold
  further captures.
- **t193/t195 ran with uncommitted Core edits.** The code I read at f0dbbd6 plus those edits is
  assumed to match the dist they ran; t193's first run shows no trace lines, so its dist may predate
  those edits.
- **Why the activity overlay is absent** from the screenshots.

## Open questions or contradictions found

- **The domain contradicts itself.** `node-run/run.ts:193-195` says a look must be one round trip.
  Core's digest hook makes it three.
- **`answer-check.ts` captures even when no action ran since the answering call.** The file's own
  header justifies the capture for a page that moves by itself. In practice it made every one of the
  9 answered repeats in t193 run-munneauy a visible "Looking at the page".
- **The "Right now" card said "Add an AI model key: To do"** while live DeepSeek builds were running
  (t194 screenshots). This is a separate UI inaccuracy for t191.
- **Rate-limit page.** In t194 (05:19–05:24) the page showed everything-store's "Sorry, you're going
  a little too fast" rate-limit page while extract_list reruns and dry runs repeated. That is a
  separate finding for lane C.
