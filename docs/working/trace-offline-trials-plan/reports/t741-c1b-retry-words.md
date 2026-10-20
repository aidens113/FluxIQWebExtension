# Report: t741-c1b-retry-words

## Outcome

Done. When the site refuses a press for now (RATE_LIMITED), the refusal the model sees now gives two
things beside `page_busy_try_later`: the wait the site asked for (`detail.retryAfterMs`) and, when
the extension confirmed it, the fact that the tab was taken back (`detail.tabReturned: true`). Both
are also said in words in `detail.next`. A refusal without them comes out exactly as before.

## What changed and why

- `domain/src/runtime/llm-evidence/tool-rejection.ts`
  - `WebLlmToolRejectionDetail` has two new optional fields, each with a doc comment:
    `retryAfterMs?: number` and `tabReturned?: true`.
  - `rejectionDetail` accepts `retryAfterMs` and `tabReturned`. It keeps `retryAfterMs` only when it
    is a positive safe integer, and keeps `tabReturned` only when it is `true`.
  - New private helpers `retryWords` and `joinedNext`. `retryWords` writes the wording. `joinedNext`
    puts it after the reason's own `next`, or uses it alone when the reason has none.
    `page_busy_try_later` has no `next` today. The wording is generic:
    "The site asked to wait N second(s) before this is made again." and "The tab was taken back to
    the page it showed before the press, so anything the press had opened, such as a menu, is closed
    again." N is rounded up to whole seconds, at least 1.
- `domain/src/runtime/llm-evidence/action-failure/refusal.ts`
  - New `siteWait(result)`, read on RATE_LIMITED only, and never when the status is `timed_out`.
    - The wait is the record's own numeric `retryAfterMs`. It is read with an `in` check, because
      `WebFailedActionResult.failure` does not declare it.
    - `tabReturned` is set when `actual` matches the extension's fixed words for a confirmed return
      (`TAB_RETURNED`, the wording `click-landing.ts` `returnWords` uses for the "returned" case). An
      unconfirmed or failed return sets nothing.
    - The page path in `actual` is never passed on.
  - The plain-reason branch of `webActionFailureRefusal` spreads `siteWait(result)` into
    `rejectionDetail`.
- Tests:
  - `action-failure/tests/refusal.test.ts` has two new tests. They use the extension's own sentence
    shape on a library catalogue path.
    - A record with a 5 s wait and a returned tab gives `retryAfterMs: 5000`, `tabReturned: true`,
      and `next` naming both, and the path does not leak.
    - The edge cases: a bare RATE_LIMITED stays `{ reason: "page_busy_try_later" }`; an unconfirmed
      return sets no `tabReturned`; a bad wait (-1, 1.5, NaN, "5000") is dropped; another code with
      the same words says neither; a `timed_out` status says neither.
  - `tests/tool-rejection-detail.test.ts` has one new test of `rejectionDetail` itself. It checks
    the exact wording, rounding a wait under a second up to 1 second, dropping 0, 2.5 and `false`,
    and that a reason with its own `next` keeps it with the wait after it.
  - I added no new test files, because `llm-evidence/tests/` is close to the 25-file budget.

## Commands run and observed results

All commands ran from `domain/` with `DOMAIN_TEST_BUILD_LABEL=t741-c1b`.

- I wrote the tests first and ran
  `node scripts/test-domain.mjs action-failure/tests llm-evidence/tests/tool-rejection-detail`. It
  printed `# tests 37 # pass 34 # fail 3`. The 3 failures were the new tests (`retryAfterMs`
  undefined, expected 5000).
- After the change, the same command printed `# tests 37 # pass 37 # fail 0`.
- `node scripts/test-domain.mjs node-run/retries/tests rejection-next/tests llm-evidence/tests/page-refusal llm-evidence/tests/press`
  printed `# tests 70 # pass 70 # fail 0`.

## Not verified

- No typecheck (the shared rules forbid it), and the domain test build bundles without
  type-checking. Two constructs rely on TypeScript narrowing:
  - `failure?.code !== X` returning early, which leaves `failure` defined;
  - `"retryAfterMs" in failure`, which narrows an object type that does not declare the property
    (TS 4.9+).

  The lead's typecheck should confirm both.
- No test checks the whole node path from the gateway's record to the model's packet (capture.ts,
  `node-run/verify.ts`, `uncertain-outcome.ts`) for the new fields; `node-run/retries/` was not mine
  to change. All three callers pass the gateway result to `webActionFailureRefusal` unchanged, and
  the domain adapter keeps `retryAfterMs` on the record (`runtime/adapter.ts:264`). So the fields
  should get through, but I did not see that happen.
- No live run, and no Core prompt pins checked. Nothing in Core or in the domain's schema text names
  these detail fields (I searched for the sibling field `filtersDropped`, which appears only in
  domain runtime files).

## Open questions or contradictions found

- `repeated-refusal.ts` (`repeatedRejectionDetail`) passes back a fixed list of detail fields.
  `retryAfterMs` and `tabReturned` are not on that list, so a repeated refusal drops both, and the
  wait wording with them. The fix is two lines there:
  `retryAfterMs: detail?.retryAfterMs, tabReturned: detail?.tabReturned`. I do not own that file.
  Core's repeat guard exempts retry-later answers, so this case may rarely repeat.
- `action-failure/result.ts` `WebFailedActionResult.failure` declares only `code` and `actual`.
  Adding `retryAfterMs?: unknown` there would make the read plain and would let tests pass
  `retryAfterMs` inline. My tests build the record through a helper instead. Not my file.
