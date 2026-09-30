# t194-w17: the re-author's malformed replies (run-munw7ffn-fe1cecd2, G2)

## Outcome

**Partial.**
- **G2 landed:** instrumentation and a spend-accounting correction.
- **Cause not established.** The kept evidence cannot say which malformed case fired, so no cause fix was guessed into code.
  The most likely cause and the fix it points to are proposed below.

## What the kept evidence establishes

Sources:
- `.work/run-munw7ffn-fe1cecd2/fluxiq-root/.fluxiq/global.sqlite`, the `automation.state` rows for adaptation `2b83be32`
  (the re-author) and `d423b119` (the build), read with `node:sqlite` in read-only mode;
- `.work/.../logs/core.log`, the `[FluxIQ build-trace]` lines;
- the run's `snapshots/`.

1. **There were 14 malformed replies, not 13.** The debug's own table lists 14 rows: iterations 7, 8, 12, 16, 17, 19, 20, 21,
   23, 24, 25, 28, 30 and 31. The stored trace also holds 14 `unusable` rows, all `llm.provider_malformed_response`. That is
   14 of 35 decisions, or 40%. The build (`d423b119`) had none: its only unusable row is `llm_evidence_loop.dry_run_refused`.
2. **Nothing recorded the case, the finish reason or the length.** The row, the stored trace, `decision-trace.json` and
   `core.log` carry the code alone. The build-trace line printed `code=- issues=-` for all 14, because `progress-trace.ts`
   read issue codes only from `error.diagnostic`, and an unusable-decision error carries them on itself.
3. **They were not cut at the output cap, and not an HTTP failure.**
   - A `finish_reason: "length"` reply raises `llm.provider_output_truncated` or `..._padding_truncated`, never this code
     (`deepseek/response-envelope.ts`).
   - A non-2xx reply raises `http_error`, `rate_limited` or `auth_failed`.
   - `max_tokens` was 8,000, and no reply ran long enough to reach it (point 4).
4. **They were full-length replies, not empty ones (inferred from timing).**

   | Decision | Duration (`decide`) |
   | --- | --- |
   | Iteration 5 (72 output tokens) | 2,076 ms |
   | `complete` (203 output tokens) | 2,027 ms |
   | Successful amendments (302-593 output tokens) | 2,338-4,130 ms |
   | **The 14 malformed replies** | **2,582-3,218 ms** |

   The malformed replies fall in the amendments' band. An empty, whitespace-only or near-empty reply would sit near 2.0 s.
5. **They occur only where the next decision is a full rerun.** Each run of 1-3 failures follows a successful `extract_list`
   rerun ("inspect succeeded") and ends with another `amend dN, rerun`.
   - A rerun's `input` is "the whole argument ... write every key it needs" (`flow-draft/amendment.ts`).
   - Here that argument is the whole `extractList` object: 4 fields, a 5-condition `where` with nested `read` objects,
     `paginate` and `dedupe`, nested 7-8 levels deep, with selectors that need escaped quotes (`div[itemprop=\"offers\"]`).
   - The re-author's successful amendments were uniformly 559-593 output tokens. The build's were at most 486, with a plan
     of 3.3 KB against the re-author's 8.1 KB.
6. **Their cost is missing from the re-author's accounting.**
   - Recorded: 441,137 input and 10,071 output tokens, $0.0425.
   - The 21 rows with usage sum to 439,778 and 10,025.
   - `estimatedInputTokens` (725,266) spans about 34 calls, so the 14 were sent, answered and billed, and are counted
     nowhere.
   - The harness completes a failed call's lease with no usage (`harness/run.ts`), and the loop added nothing for an unusable
     decision.
   - At the recorded $0.0020 a call, that is about $0.028 unreported (an estimate).
7. **The debug's list of emitters was incomplete, and one entry is on another path.**
   - Seven places raise the code: `provider.ts` (media type, envelope not JSON) and `response-envelope.ts` (choice count,
     message shape, missing content, a finish reason other than `stop` or `length`, and content that fails the JSON parse
     and its surplus-bracket repair).
   - `panel-command.ts:129` is the chat window's call and is not on the build path.

### What the evidence cannot tell

- Which of the remaining cases fired for any of the 14:
  - content that is not JSON (and in what way);
  - a finish reason such as `insufficient_system_resource` or `content_filter`;
  - content `null`;
  - a choice-count or shape fault.
- The finish reason and length in characters for each reply, and the exact output tokens of each.
- Whether all 14 were the same case.

The replies were never stored, and the run cannot be replayed. The timing narrows it (point 4) and points away from an
envelope or media-type fault, but it proves nothing.

## What changed and why

G2: an unusable decision now carries the malformed case, the finish reason, and the reply's length in characters and tokens.
It never carries the reply's content. All paths below are under Core
`packages/fluxiq/src/programs/automation-studio/runtime/`.

**Files named before editing** (none is claimed by a current report; only `service/**` and `result-verification/**` files
belonging to other workers were dirty in this tree): `llm/reply-account.ts` (new), `llm/provider-contract.ts`,
`llm/harness/run.ts`, `llm/evidence-loop.ts`, `llm/evidence-loop/progress-trace.ts` and
`tests/deepseek-bootstrap-exploration.test.ts`.

- **`llm/reply-account.ts` (new):** the provider-neutral account `{ case, finishReason?, contentChars?, usage? }`, with a closed
  case list and a bounding reader.
  - The cases are `media_type`, `envelope_not_json`, `envelope_shape`, `content_missing`, `finish_reason`, `content_empty`,
    `content_fenced`, `content_prefixed`, `content_not_object`, `content_unclosed`, `content_trailing`, `content_mismatched`
    and `content_invalid`.
  - The content cases are read from structure alone: where the first `{` is, whether the object closes, and whether the
    brackets match in kind.
  - They separate "cut off inside the object" (unclosed), "miscounted brackets" (mismatched, the family the earlier
    surplus-`}` repair addressed), "prose or fence around it" (prefixed, fenced, trailing) and "balanced but invalid"
    (a bad escape or an unescaped quote).
- **`llm/deepseek/response-envelope.ts` and `provider.ts`:** every malformed throw builds its account. The provider's usage is
  read leniently first, because a reply Core refuses was still paid for. The accepted path is unchanged.
- **`llm/deepseek/panel-command.ts`:** the chat path's two malformed throws carry `envelope_not_json`, or `content_empty` /
  `content_missing` with the finish reason.
- **`llm/provider-contract.ts`:** `AutomationStudioLlmProviderError` gains an optional `reply`. The normalizer passes a bounded
  copy, from real instances only, like `refusal`.
- **`llm/harness/run.ts`:** the failure diagnostic's metadata carries `providerReply`.
- **`llm/unusable-decision.ts`:** `AutomationStudioLlmUnusableDecisionError` carries `reply`, read from the diagnostic and
  bounded again. The service path (`service.ts:1597`) needs no change.
- **`llm/evidence-loop.ts`:** an unusable row gets `resultReason: <case>` and `usage: <paid usage>`.
  - Both members are already carried by every rebuilder, including `service/flow-bootstrap-commands/evidence-trace.ts`, so
    they reach the stored trace and the published steps without a `service/` edit.
  - The loop's accounting adds that usage, and the decision counts as reported, so the budget's average is not charged
    twice.
- **`llm/evidence-loop/progress-trace.ts`:** `decide throw` now prints the issue codes, plus
  `reply=<case> finish=<reason> chars=<n> out=<tokens>`, into `core.log`.
- **Behavior change (deliberate):** a malformed reply's tokens and cost now count in a build's accounting, and so against its
  budget and the $0.25 ceiling. `tests/deepseek-bootstrap-exploration.test.ts` pinned the old zero ("paid for nothing, so the
  record says so"). It now expects 9,600 / 1,200 / 10,800 tokens and each step's `resultReason: "content_unclosed"`.
- **Tests added:**
  - `llm/deepseek/tests/response-envelope.test.ts` (new): each case is built from the observed shape, a re-author rerun
    amendment. Every test asserts that no content fragment reaches the account, the message or the normalized failure.
  - `llm/tests/unusable-decision.test.ts`: the diagnostic reaches the error, bounded; the row carries the case and usage;
    the accounting counts it.
  - `llm/harness/tests/run.test.ts`: end to end through the real adapter.
  - `llm/evidence-loop/tests/progress-trace.test.ts`: the throw line.

**Where G2 stops short.** The stored and published row carries the case (`resultReason`) and the tokens (`usage`). The finish
reason and the length in characters reach only `core.log`'s build-trace line. For a content case, the finish reason is `stop`
by construction; for `finish_reason`, the word itself is only in the log. To store them on the row, the member must be
carried by `service/flow-bootstrap-commands/evidence-trace.ts` (excluded from this brief) and
`flow-bootstrap/evidence-loop-steps.ts`. A member added without both would be silently dropped, as `trace.ts` warns.

## Proposed fix (not coded, pending the next run's `reply=` case)

Most likely cause: long rerun amendments written as invalid JSON at full length.
- The timing (point 4) and the placement (point 5) both point there.
- This model has miscounted brackets live before; the surplus-`}` repair exists for that.

By case:
1. **`content_mismatched`, `content_unclosed` or `content_trailing` (bracket miscounts in deep objects).** Make a rerun cheap
   to write: let `rerun` carry a partial `input` merged over the step's previous argument (for example, only `where`),
   instead of "the whole argument". This cuts a roughly 570-token, 8-deep object to about 100 tokens. Owner:
   `flow-draft/amendment.ts` and the loop's rerun handling (`llm/evidence-loop/rerun-*.ts`), not this brief.
2. **`content_invalid` (escapes or quotes in selectors).** The same change removes most re-emitted selectors.
3. **Any content case.** Tell the model which case it was: add the case to the decision feedback beside
   `llm.provider_malformed_response`. The loop re-asked blind, and the model failed 2-3 times in a row.
4. **`finish_reason` with `insufficient_system_resource`.** Treat it as a transient provider fault and retry it inside the call
   (`provider-retry/`), rather than as an unusable decision.

Do not add a lossless-repair parser branch until the case is known. No observed shape justifies one yet.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`; `npx` commands ran in `packages/fluxiq` through
`heavy.sh`. No build, `dist` write, Lab, browser or provider call.

- `npx tsc --noEmit -p tsconfig.json`: exit 0, no output. The run before that failed on my own test stub (TS2554) and was
  fixed.
- `node scripts/structure-audit.mjs` (Core root): exit 0.
  - Output: `structure-audit: 1 baseline entries can be lowered`. I did not identify which entry.
  - An earlier run failed `[naming] ... 3 files share the prefix "provider-"`; the new module was renamed `reply-account.ts`.
- `npx vitest run src/programs/automation-studio/runtime/llm`: **76 files, 722/722 passed.**
- The same run plus the malformed-reply callers (`tests/deepseek-bootstrap-exploration`, `flow-bootstrap/generation-failure`,
  `incomplete-draft`, `loop-limits`, `recovery` progress-guard and runtime-exploration, `route-state/build-routing`,
  `service/flow-bootstrap-commands`, `tests/deepseek-recovery-requests`, `tests/service-bootstrap/tests/rejections`):
  - 93/94 files passed; 1,218/1,222 tests passed;
  - all 76 llm files passed;
  - the 4 failures were all in `service-bootstrap/tests/rejections.test.ts`: `Test timed out in 15000ms`, then teardown
    `EBUSY`/`ENOTEMPTY`.
- `rejections.test.ts` alone: **17/17 passed** (72 s). The earlier failures were timeouts under the 94-file run.
- `deepseek-bootstrap-exploration.test.ts` alone, after its update: 1 file passed.

## Not verified

- No live run: the account has not yet been seen on a real DeepSeek reply.
- I did not check that the Lab's `decision-trace.json` builder copies `resultReason` and `usage` for unusable rows. The stored
  rows do carry both members for other decisions.
- The whole Core suite (`pnpm test`) and `pnpm check` were not run.
- The recovery path's private unusable handling (`recovery/annotation/exploration.ts`, excluded) records no account.
- The new tests fail without the change by construction: they assert members that did not exist. I did not run them against
  the pre-change tree, because other workers are editing this checkout.

## Open questions or contradictions found

- The debug says 13 malformed replies (37%); its own table and the store say **14 (40%)**.
- The debug lists three emitters; there are seven on the build path, and its third (`panel-command.ts`) is not on that path.
- The debug says the re-author's calls averaged $0.0012; its accounting is $0.0425 over 21 reported calls, about $0.0020.
- **For the supervisor:** counting malformed replies' usage changes accounting and budget behavior; this is the correction of
  an under-count. Carrying the finish reason and the length on the stored row needs the `service/` rebuilder's owner.
