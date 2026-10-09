# W16: t378 documentation (worker report)

## Brief

### Brief: t378-w16-docs (worker)
- Repository: FluxIQ Core and downstream, documentation only. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (both on `task/t378-candidate-feedback`).
- Task: bring the authored current-state design docs in line with t378 (no history narrative beyond a short "since t378" where the doc already dates changes). Read the lead report `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback.md` (Decisions D1-D6) and the worker reports beside it in `t378-candidate-feedback/` (w1-w13; read the Outcome and "What changed" sections, verify each claim you document against the source in T before writing it). Then update:
  1. Core `T/!FluxIQ/docs/architecture/automation-studio/flow-authoring.md` and `llm-flow-bootstrap.md` (whichever describes candidate mode and the script): the refusal feedback contract (`step`, `label`, `line`, `instead`; whole-Flow issues; the test that enforces it); `repeat most:` placement; a run of refusals counted by the same issues; the candidate-mode repeat note; the unclosed-reply repair; the script statements `optional: yes` inside a span, `only after:`, `repeat pace:`; plan node `paceMs` -> Flow node `metadata.paceMs`; the wait node pauses; the retry wait credits elapsed time; pace honoured, raised after a hinted failure, and kept by promotion; trial feedback names what a step absorbed. If a Core runtime/executor doc covers the wait node or retries, update it there instead.
  2. Core `client-gateway.md`: check W11's `step.row` entry is accurate; fix only if wrong.
  3. Downstream `T/!FluxIQWebExtension/docs/architecture/page-evidence.md` and/or `element-identity.md`: for a candidate submission a handle resolves only if a tool answer printed it; a candidate press on a target with no control role is refused unless exploration pressed it with an effect; exploration itself is unrestricted.
  4. Downstream `extension-client.md`: cards name the act kind (choose, tick, type, press), the control and the row; a retried press reads as one card; the overlay wraps instead of cutting; the unusable-reply row is a status.
- Owns: those doc files only.
- Must not touch: source, tests, the working documents other than nothing (do not edit any file under `docs/working/`), generated references, any other tree.
- Definition of done: from `T/!FluxIQ`, `node scripts/structure-audit.mjs --rule docs-links` passes; from `T/!FluxIQWebExtension`, `node scripts/structure-audit.mjs` shows no violation in a doc you touched. Never commit.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w16-docs.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Done. Four docs updated, `client-gateway.md` checked and left unchanged. Every claim written was checked against the source in T first. One claim in a worker report is still true in source and is documented as a known gap: the executor does not yet skip a guarded group's optional step (W8).

## What changed and why

- **Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`** (this is the doc that describes candidate mode; `flow-authoring.md` covers the legacy draft, so I left it alone). Under "Explicit candidate authoring" I added three subsections:
  - **"What a refused candidate is told"** covers:
    - the issue contract `{code, path?, message?, step?, label?, line?, instead?}`;
    - the locator: `script-locator.ts`, `locate-issue.ts`, and `cause` for derived nodes;
    - the JSON plan form: name as `step`, key as `label`, no line;
    - the four `WHOLE_FLOW` codes;
    - the `instead` sentence, including `submit: true` being a press;
    - `next` quoting each step at most 120 characters;
    - the enforcing corpus test and its source scan (`refusal-locator-corpus.test.ts`);
    - the digest refusal kind (`code@line`), and the run warning that lists recurring issues;
    - the candidate repeat note: the key is `flow`/`plan` only, it carries the refusal's issues, and it has no legacy wording.
  - **"Script statements a candidate may write"** covers:
    - `repeat most:` placement and the `repeat_most_misplaced` code;
    - `optional: yes` inside a span;
    - `only after:` guarded groups and their refusals;
    - `repeat pace:` units, range and codes;
    - plan `paceMs` (1 to 600,000, `bootstrap.invalid_pace`) becoming `metadata.paceMs`;
    - the known runtime gap from `optional-step.ts`, with its `it.fails` tripwires.
  - **"What a trial says it absorbed"** covers `absorbed`, the `said` and `paces` fields, and how promotion raises `paceMs` (`learnedPaces` and `raisedPaces`).
  - Also in this doc, under "Provider transport": one paragraph on the unclosed-reply repair (`unclosed-content.ts`). It runs only on `stop`, the closed text must parse, and the raw reply stays logged.
- **Core `docs/architecture/automation-studio.md`** (Router Runtime). This is the doc that already covers the defensive retries. I added a "Waits, retry waits and pace" paragraph covering:
  - the shared abort-aware wait;
  - the Wait node's timed pause, which settles `succeeded` with `pause` and continues;
  - the credited retry hint (whole tenths of a second, `hintedWaitMs`/`creditedMs`, the slow-down words);
  - pace: held per arrival, retries not paced, learned from hints and grown by half up to 60 s, authored pace never lowered, `attempt.pace` and `trace.pace`.
- **Core `client-gateway.md`**: W11's `step.row` paragraph is accurate against the sources:
  - `contracts/src/client-gateway.ts:201` declares `row?: string`;
  - `activity/step/started.ts:42-43` is the only emitter;
  - `bounded.ts:38` cuts it to the title bound.

  I did not edit it.
- **Downstream `docs/architecture/page-evidence.md`** ("What A Model Reads"). I added three bullets:
  - **A candidate names only what it was shown:** under `view_history` a handle resolves only if evidence printed it (page-view lines, repair candidates, line-leading handles in any tool answer, including a detection's `at`). An echoed refusal input and mid-line handles do not count. An unprinted handle is refused `web.handle.unknown`.
  - **A candidate press needs a control:** `web.handle.not_a_control` (also inside Run Output, confirmed by `press-control.test.ts:89`). The bullet gives the pressable rules and the exception for a press during exploration that changed the page. Next page is exempt.
  - **Exploration itself is unrestricted.**
- **Downstream `docs/architecture/extension-client.md`**:
  - the "Asking the AI model again" row is status, and the chat draws it as a note;
  - the overlay is 384x84 with a two-line detail, wrapped by `fit-lines.ts` (keep whole sentences first, cut at a word last);
  - the card head uses the act name (`ACTIVITY_ACTION_VERB_NAMES`, e.g. Choose, Tick, Press key, Next page), the control name from printed evidence (`call-context.ts`), and the row from `step.row`;
  - a retry folds into one card ("Done on the 2nd try. ...", `retried.ts`), with its conditions.

## Commands run and observed results

- `node scripts/structure-audit.mjs --rule docs-links` (from `T/!FluxIQ`) -> `structure-audit: passed (0 warning(s), 0 baselined).`, exit 0.
- `node scripts/structure-audit.mjs` (from `T/!FluxIQWebExtension`) -> `structure-audit: passed (184 warning(s), 257 baselined).`, exit 0. `grep "docs/"` over the output: no lines, so the audit reported nothing for any doc.
- Source checks (grep/sed in T) for each documented claim. Among them:
  - `refusal-locator-corpus.test.ts:26-31` (`WHOLE_FLOW`);
  - `submission-refusal.ts:80-96`;
  - `outcomes.ts:366-371`;
  - `candidate-feedback.ts:34-45`;
  - `response-envelope.ts:117-136`;
  - `repeat-pace.ts:27-33,74,88`;
  - `plan/parsing.ts:130-133`;
  - `adaptation.ts:234`;
  - `pace-keeper.ts:33,36,82`;
  - `credited-hint.ts:13-16`;
  - `timed-pause.ts:28-29`;
  - `executor/contracts.ts:274`;
  - `optional-step.ts` (unchanged shape rule);
  - `guarded-loop.test.ts:111,166` (`it.fails`);
  - `target-packets.ts:95-125,268,318,488`;
  - `resolve-plan-node.ts:523,728`;
  - `tools.ts:463`;
  - `status-pill.ts:107,344-345`;
  - `retried.ts` header;
  - `model-thought.ts:26`;
  - `messages.ts:233-237`.

## Not verified

- I did not render the docs. Only the link and structure audits were run.
- Behaviour was not exercised. The docs describe the source as written, and the worker reports' test claims were not re-run.
- The extension card's control name relies on Core's `call-context.ts` fallback. I read W11's description and the file list but did not trace it end to end in the extension.

## Open questions or contradictions found

- W8's runtime gap is still open in source: `executor/step-skip/optional-step.ts` does not recognise a guarded group's optional step, so an absent notice spends recovery on every pass. The doc states this as a known gap. It needs to be removed when the executor fix lands and the `it.fails` tripwires become plain tests.
- W11's build-failed ending cannot yet name steps, because the failure diagnostic only carries codes. The brief did not ask me to document this, so I did not.
- `flow-authoring.md` was deliberately not edited. It describes the legacy draft, and the candidate material fits `llm-flow-bootstrap.md`.
