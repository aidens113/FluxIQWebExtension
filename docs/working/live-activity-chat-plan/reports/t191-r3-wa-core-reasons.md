# t191-r3-wa: Core shows the model's reason for every step in the activity stream

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ` (branch `task/t191-extension-chat-ui`). Nothing was committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Every model decision in a build or a recovery exploration now produces its own `thought` row. The row names the action in plain words and carries the model's own stated reason. The run recovery ladder, the model's run diagnosis and patch answer, the start of a result repair, and the end of the result check each produce a row too. A refused completion is now explained in words, not issue codes.

## What changed and why

### The reason, kept beside the decision (brief item 1)
- New `R/activity/decision-reason.ts`, which exports `automationStudioActivityDecisionReason = { attach(decision, reason), of(decision) }`. It keeps the reason in a **WeakMap keyed on the object `decide` returns**. Nothing is added to the object as a key.
- Why not a `reason` field: the loop's grammar (`llm/evidence-loop-decision.ts`, `exactKeys`) refuses a decision that has an unknown key. The loop also builds the model's next context from the decision it parsed. A field would therefore either make every decision invalid or leak into the next context. With the WeakMap, a copy or parse of the decision cannot carry the reason. This is tested: `JSON.stringify` of the decision and a spread copy both come back without it.
- `R/service.ts` (the bootstrap `decide`, formerly line 1598) and `R/recovery/annotation/exploration.ts` (formerly line 425) now return `automationStudioActivityDecisionReason.attach({ ...decision, usage }, response.summary)`. The object's shape is unchanged. The wrappers between these functions and the observer (`routing.observing` and the retry loop in `runtime-exploration.ts`) both pass the same object through, so the observer receives the object that holds the reason.

### Observer (brief item 2): `R/activity/observer.ts`
- The decide-start row ("Deciding the next step", thinking, started) is unchanged.
- When `decide` returns, the observer sends one event. It sends none when the reason is empty or absent, or when the decision cannot be read. The event is:
  - `tool_call`: phase `exploring` (from `wording/tool-call.ts`; the draft tool itself gives `building`), label = title = the action, e.g. "Clicking “Get a free quote”".
  - `amend_draft`: phase `building`, "Updating the draft Flow".
  - `complete`: phase `verifying`, "Checking the Flow is finished".
  - `detail = { kind: "thought", title, text: reason, status: "succeeded" }`.
- A refused completion's `detail.text` is now words, not `issueCodes.join(", ")`, e.g. "Sent back because some steps point at things that weren't seen on the page and it doesn't yet do everything that was asked. 2 things need fixing." This comes from `wording/completion-refusal.ts`, which reads the feedback's `refusal`/`refusals` codes. Codes it does not know fall back to a plain sentence.
- I rewrote the header rule. It now lists what is shown (the model's stated reason, bounded) and what never is (decision input values, amendments, gathered evidence, codes in sentences).

### Repairs and judgement (brief item 3)
- New `R/activity/thought.ts`, exporting `emitAutomationStudioActivityThought({ phase, title, text, status?, ref?, max? })`. It sends the thought row with label = title and sends nothing when the text is empty.
- `R/executor/graph-run.ts` (after the ladder decides, next to the existing "Recovery started" at line 567): sends a `repairing` thought with Core's own words for the rung (`wording/recovery-choice.ts`): "Trying the step again", "Waiting for the page to catch up", "Clearing what was in the way", "Moving on: the step's result is already there", or "The quick fixes didn't help", each with a one-sentence reason. The ladder is Core's logic and involves no model, so these words are Core's.
- `R/recovery/annotation/annotate.ts` (**outside the three sites the brief named; see Open questions**): in the recovery that follows a failed run, the model's diagnosis only exists in this file. It now sends a `repairing` thought "Working out what went wrong" with the diagnosis summary (at most 480 characters). It sends a second one after the patch call: "Deciding how to repair the step", or "Deciding the step can't be repaired" for `no_repair`, with that answer's summary. Both are single emission calls, which is within the restricted-directory rule.
- `R/recovery/refuted-result/repair.ts:159`: the existing step row is kept. After it comes a `repairing` thought, "Fixing the Flow so its result answers the request", whose text is the verdict sentence plus the check's screened finding and advice (at most 600 characters).
- `R/result-verification/verify.ts`: when the check ends (both return paths, after one call or two), a `check` row is sent, phase `verifying`, title "Result check":
  - "The result answers the request": `succeeded`.
  - "The result doesn't answer the request": `failed`.
  - "Couldn't confirm the result answers the request" (model disagreed or unconfirmed): `failed`, because this is not a pass (fail-closed).
  - The text is the verdict sentence, plus "What it found: …" and "What to change: …" when the model gave them. The words come from the new `R/result-verification/check-activity.ts` (`automationStudioResultCheckActivity`). Checks that skip or are settled by Core's own observation return before the start row, so they send no end row either.

### Prompt (brief item 4): `R/llm/deepseek/system-prompt.ts:34`
The instruction now reads: "Return minified JSON. Write summary as one plain sentence under 240 characters for the person watching: what you do next, on what, and why. When completing, …". The 240-character bound in the schema is unchanged.

### Contract comment (brief item 5): `packages/contracts/src/client-gateway.ts`
Comment only; the shape is unchanged. It now says that a `thought` row's text is the model's own stated reason, or its diagnosis or verdict: whitespace collapsed, token-shaped runs hidden, bounded (240 characters for a decision's reason). The comment keeps "never raw evidence a tool gathered, tokens or secrets".

### Barrels
`R/activity/index.ts` and `R/activity/wording/index.ts` export the new pieces. `R/result-verification/index.ts` exports `check-activity.ts`.

## Example events (from tests)
```
{ phase: "thinking",  label: "Deciding the next step", detail: { kind: "thought", title: "Deciding the next step", status: "started" } }
{ phase: "exploring", label: "Clicking “Get a free quote”", detail: { kind: "thought", title: "Clicking “Get a free quote”", text: "Clicking the quote button to open the form the request asks about.", status: "succeeded" } }
{ phase: "building",  label: "Updating the draft Flow", detail: { kind: "thought", title: "Updating the draft Flow", text: "Because the draft now covers the request.", status: "succeeded" } }
{ phase: "verifying", label: "Checking the Flow is finished", detail: { kind: "thought", ..., status: "succeeded" } }
{ phase: "verifying", label: "The proposed Flow was sent back to be fixed", detail: { kind: "check", title: "Completion check", status: "failed", text: "It needs changes before it can be used, and it goes back to be fixed. One thing needs fixing." } }
{ phase: "repairing", label: "Working out what went wrong", detail: { kind: "thought", title: "Working out what went wrong", text: "The button moved.", status: "succeeded", ref: "n1" } }
{ phase: "verifying", label: "The result doesn't answer the request", detail: { kind: "check", title: "Result check", status: "failed", text: "The result was judged not to answer ... What it found: Only three listings were saved What to change: Read every page of results" } }
```

## Redaction note
- Every model text that reaches the stream goes through `automationStudioActivityReasonText` (`R/activity/wording/reason-text.ts`), which does the following:
  - withholds the whole text if it contains "PRIVATE KEY";
  - replaces with "…" any run of 20 or more token characters (`[A-Za-z0-9+/_=-]`) that has both a letter and a digit, and any such run of 32 or more;
  - collapses whitespace;
  - bounds the length: 240 for decision reasons, 480 for the diagnosis and patch summaries, 600 for verdict text.
- The result-check text is also screened upstream, in `repair-directive.ts`.
- The reason is never written into decision-context rows, the trace, or the model's next context, because the WeakMap keeps it out of anything that copies the decision.
- What is still shown: the model's own words about the person's page, e.g. a button's name or what it saw. That was the purpose of the brief, and the contract comment now says so.
- My first version called Core's `screenAutomationStudioLlmEvidence` through the `llm` barrel. That created an import cycle: activity imported the llm tree, which is imported through the service. `runAutomationStudioLlmHarness` was undefined when service.ts loaded, and service-bootstrap tests failed with `flow_bootstrap.internal_error` (a TypeError). Importing the leaf module directly broke the structure audit's barrel rule. The final version therefore has no runtime import of llm from activity and applies its own shapes, which are broader than the screen's.

## Commands run and observed results
- `npx vitest run R/activity R/result-verification R/recovery/refuted-result/tests R/recovery/annotation R/executor/tests --minWorkers=1 --maxWorkers=2 --testTimeout=60000`: **47 files, 562 tests passed**. This was after the import fix.
- `npx vitest run R/activity R/result-verification/tests/check-activity.test.ts R/tests/service-bootstrap/tests/generation.test.ts --minWorkers=1 --maxWorkers=2 --testTimeout=60000`: **10 files, 64 tests passed**. This was after the final reason-text rewrite.
- Earlier, before the import fix, a broad batch was run: R/recovery/annotation, llm deepseek, evidence-loop-provider, no-repair-response, stages registry, executor, tests/service-bootstrap, deepseek-bootstrap-exploration, deepseek-recovery-requests, tests/refuted-result, tests/service-adaptation. Failures:
  - generation.test.ts: 6, caused by the cycle, now fixed.
  - Timeouts at 15 s or 60 s in subflow, reauthor-service, iterating-recovery and adaptive-loop, plus one EBUSY sqlite unlink.
  - permission.test.ts: 2.
- Rerun after the fix with `--maxWorkers=1 --testTimeout=60000` on permission, generation, iterating-recovery, adaptive-loop and subflow: **4 files passed; 26 passed, 2 failed**, both in permission.test.ts.
  - "builds a Flow whose steps have no lasting consequence without asking anything" timed out at 60 s in that batch and **passes alone**.
  - "goes ahead with nothing permitted, and keeps what the instruction asked for…" fails with `flow_bootstrap.permission_required`. **This failure predates my change**: I saved my changes to all 13 tracked files as a patch, reversed it (`git apply -R`), ran the test (same failure), and reapplied the patch (`git apply`; 13 files changed again).
  - reauthor-service "reaches the re-author … diagnosis_only run, with no grant" **passes alone** (timeout raised to 180 s).
  - 18 node processes from other work were running on the machine at the time.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t191 wa core check" pnpm --filter fluxiq check`: tsc `--noEmit` finished with no errors and exit 0 (`"step":"fluxiq:check" ... "ms":43702`).
- `node scripts/structure-audit.mjs`: `passed (201 warning(s), 354 baselined)`. The one new warning is `activity/` at 17 source files, past the 15-file advisory level (the hard limit is 25).

## Not verified
- No Lab run, browser run or model call. Nothing yet shows that the DeepSeek model follows the new summary instruction, or how the extension renders the new thought rows.
- The ladder thought in graph-run.ts and the diagnosis and patch thoughts in annotate.ts are covered by typecheck and by the existing executor and annotation suites passing. No test asserts those particular events.
- The full `pnpm test` / `pnpm check` for the whole repository was not run; only the `fluxiq` package check.
- permission.test.ts "goes ahead with nothing permitted…" still fails; I showed it fails the same way with my changes reversed.

## Open questions or contradictions found
1. **Scope:** `annotate.ts` was not among the brief's named sites, but the model's diagnosis for a failed-run repair exists only there. The graph-run ladder site involves no model, so there was no model text to show at the named site. I added two emission calls in annotate.ts, which the restricted-directory rule allows. The supervisor should confirm this is wanted.
2. **Pinned phase:** a model `tool_call` to the draft tool gets phase `building`, not `exploring`, taken from `wording/tool-call.ts` so that it matches the tool row that follows it. Every other tool call gets `exploring`, as the brief pinned.
3. **Pre-existing failure:** permission.test.ts "goes ahead with nothing permitted…" fails on this tree without my changes (`flow_bootstrap.permission_required`).
4. **Contract wording:** the contract comment previously said "never observed target content". It now allows the model's own reason, which can name on-page things. This is the brief's intent, but the extension lane should know.
