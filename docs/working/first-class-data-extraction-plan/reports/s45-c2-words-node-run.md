# Report: s45-c2-words-node-run (W-C2, wave 2 of S4)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t284/!FluxIQWebExtension` (branch `task/t284-read-list-s45-next-page`). D = `domain/src`.
No commits, no Core edits, no Lab, browser or provider call.

## Outcome

Done. Fail-first tests were written, 6 failed as expected, the implementation made them pass. The domain check
exits 0 and the structure audit exits 0.

## Where the replay answer carries `route` (for Core's S2 walker)

`route: "ended"` sits at the **top level of the replay answer value**, which is the execution result's
**`evidence`**: `execution.evidence.route === "ended"`, beside `ok: true`, `code: "core.replay.replayed"` and
`said`. The execution's `resultCode` stays `core.replay.replayed` and `resultReason` stays absent, so it is a
non-failure. This is the replay's counterpart of the Flow dispatch payload's top-level `payload.route`
(contract C1).

It is deliberately **not** a member of the execution result itself. Current Core's
`AUTOMATION_STUDIO_LLM_EVIDENCE_TOOL_EXECUTION_KEYS` (`AS/runtime/llm/evidence-loop-decision.ts:111`) is exact,
and an unlearned member refuses the whole call as `llm_evidence_loop.tool_result_invalid.unknown_key`. A test
pins that the execution has no `route` own-property. If S2 would rather read a result member, Core must learn
`route` in that list first. Moving it is then a one-line change in `webNodeReplayAnswer`.

## What changed and why

- `D/runtime/llm-evidence/system-instructions/instructions.ts`
  - The version is now `web-5`.
  - The Lists line gains, verbatim: "Every page of a list is a loop: read the list, then Next page on the same list, then
    amend_draft repeat on the read through Next page while it succeeds (most N for 'the first N pages'); the Flow keeps
    each row once."
  - The text is now 2,849 characters. Its test bound went from 2,800 to 3,000, and Core's bound is 4,000.
  - The header comment records web-5 and the new length.
  - No pinned prompt snapshot exists in this repository: a grep for `web-4` found only this file.
- `D/runtime/llm-evidence/tools.ts` (detect tool description)
  - The `paginate` sentences are gone.
  - In their place: "The read reads the page shown. pagination says how the list continues: every page is Next page
    on the same handle (nextPage: {list: handle}) after the read, with repeat on the read through it."
  - It is still within Core's 2,000 characters, and the comment above it was updated.
  - The description still lists `paginationBound` among the returned fields, because detection still returns it.
- `D/runtime/llm-evidence/node-run/call-words.ts`: a `web.output.dom-next_page` call is named in two ways.
  - When `nextPage.control` is a handle the build was shown, it is named by that control's name.
  - Otherwise it is named "Next page", the node's label: a detection handle is no words.
  - It is never named "paginate".
- `D/runtime/llm-evidence/node-run/replay-answer.ts`
  - `WebNodeReplayAnswer` gains `route?: "ended"`.
  - `webNodeReplayAnswer` takes an optional 8th argument, `route`.
  - New `webNodeReplayNextPage(payload)` reads `payload.nextPage` through `webAutomationNextPageAnswerValue`:
    - `ended` gives "the step ran again: the list has no next page (<stop>), so the loop over its pages ends here" and
      `route: "ended"`;
    - `moved` gives "the step ran again: moved to page N", or "moved to the next page" when the pager marks no page
      number;
    - `failed`, or no answer at all, gives nothing.
- `D/runtime/llm-evidence/node-run/replay.ts` (minimal edits)
  - New constant `NEXT_PAGE_ACTION`.
  - For a Next page, the said line and route come from `webNodeReplayNextPage`, and `readChange` is skipped, since
    Next page reads nothing.
  - The route is passed to `answer(...)`.
  - The header documents `answer: "kept"` and `route`.
  - Dispatch is unchanged: the resolved parameters go out through `resolveWebPlanNode`, as for every step.
  - A failed move arrives as `status: "failed"` and takes the existing failure path, so it carries no route.
- `answer: "kept"` needed no code change. The replay already sends reads through
  `webAutomationExtractListAloneRowsAsked`, and `run.ts` does not call it. Both facts are now proven by a test.
- `catalog.ts` needed no code change. Next page is runnable because the catalog is derived from the output-node
  definitions and the safety table, which W-A filled in.

## Tests (fail-first)

All of these extend existing files; no test file was added.

- `system-instructions/tests/instructions.test.ts`
  - The version is `web-5`.
  - The Lists line contains the sentence verbatim and still opens with the rule for acting on rows.
  - The text has no `paginate`, and the bound is 3,000.
- `tests/tools.test.ts`
  - The detect description has no `paginate`, `maxPages` or `maxScrolls`.
  - It contains "pagination says how the list continues", "Next page on the same handle" and
    `nextPage: {list: handle}`, and mentions repeat.
- `node-run/tests/catalog.test.ts`
  - Next page is runnable: its action is `web.dom.next_page`, its effect is mutate, and the Flow keeps it.
  - It is in the bound runtime's `runsNodes.runnable`, and the spelling `web.output.dom-next-page` resolves to it.
  - Its catalog bounds hold: the description is at most 240 characters, its first sentence at most 80, and each
    parameter description at most 700. None of that text teaches a page bound.
  - An exploration `core.run_node` of Next page dispatches `web.dom.next_page` with its `nextPage`.
- `node-run/tests/call-words.test.ts`: covers the Next page words, including that they never say paginate.
- `node-run/tests/replay.test.ts`
  - A replayed read sends `extractList.answer === "kept"`; an exploration read sends no `answer`.
  - A replayed Next page dispatches its request.
  - An `ended` answer passes with `evidence.route === "ended"` and no `route` on the execution.
  - A `moved` answer is a plain success line with no route.
  - A route sent beside a list that moved is not carried.
  - A failed move is `core.replay.failed` with no route.

The fail-first run gave `# tests 70 # pass 64 # fail 6`: the call-words test, the ended and moved replay tests,
the version and Lists-line tests, and the tools test. The catalog and kept-answer tests already passed, as the brief
predicted.

## Commands run and observed results

- The brief's `run-subset.mjs <domain> s45-c2 ...` followed by `node --test <bundles>`, wrapped in a scratch
  runner (`scratchpad/s45c2-run.sh`) so the bundle paths pass through cleanly.
  - The 5 changed test files gave `# tests 70 # pass 70 # fail 0`.
  - The wider set gave `bundles: 32`, `# tests 303 # pass 303 # fail 0 # cancelled 0`. It covered:
    - all 25 files of `node-run/tests/*`;
    - `system-instructions/tests/*`;
    - the tests that pin `tools.ts` and the system instructions, found by grep: `tests/tools.test.ts`,
      `tests/tool-rejection-detail.test.ts`, `harness-options/tests/{options,detect-option}.test.ts`, and
      `runtime/tests/{adapter,host-runtime}.test.ts`.
  - After a final type fix in `catalog.test.ts`, that file alone gave `# tests 10 # pass 10 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` (from the repository root): exit 0. The first run exited 2
  on TS18048 in my own `catalog.test.ts` (`runnable` possibly undefined). I fixed it and the rerun exited 0.
- `node scripts/structure-audit.mjs`: exit 0, `structure-audit: passed (172 warning(s), 118 baselined)`.
- A first attempt broke its own sed quoting, so `node --test` ran with no arguments and started discovering every
  domain test. I stopped it (TaskStop) before it finished; its output was not used.

## Not verified

- **How Core's S2 walker reads `evidence.route`.** S2 is not in this tree; the location is the contract I am stating
  above.
- **Next page with the handle form `{list: "extraction.N"}`, through exploration or replay.** That needs W-C1's
  `plan-resolution`, which is running in parallel. My tests use the literal `{item, pagination}` request, which
  resolution passes through unchanged.
- **The extension side.** Live browser behaviour and the real payload from the content script (W-D) were not
  exercised.

## Open questions or contradictions found

- **The Lists line was extended, not replaced.** The brief says the lists line "becomes" the new sentence. Replacing
  it outright would drop the t252 D8 rule ("Repetitive work is a loop ... never act on every item"), which its tests
  pin and which the design does not retire. So the sentence is appended to the same line. If a strict replacement
  was meant, say so; it would also bring the text back under 2,800 characters.
- **Call words when no control is named.** With no `control` handle, a Next page step reads "Next page". The domain's
  words have no list name for a detection handle; Core's own `list` word is filled from detection answers, not the
  call. Core's activity wording also has no verb for the `next`/`page` id words today, so how the card reads is Core's
  call (S2/S3 or t279).
