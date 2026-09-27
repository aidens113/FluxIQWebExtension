# t400 — Core timeout patch re-review

## Verdict

**GO.** The corrected timeout patch matches t395's narrow recommendation. Exactly three new
`60_000` per-test timeout arguments appear in the three assigned Core test-file diffs, and each is
attached to the named full-suite-sensitive `it()` case. The patch does not change the global
Vitest timeout, worker/file concurrency, hooks, or production code.

No Core or downstream source was edited. I did not run any suite, build, provider, live, panel,
browser, or Lab command. This report is the only write.

## Read-only diff findings

I inspected the working-tree diff only for:

- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/llm-grants.test.ts`;
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flows/tests/canonical-persistence.test.ts`; and
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flows/tests/scale-pages.test.ts`.

The three added timeout arguments attach to exactly the cases specified by t395:

1. `binds and revokes a diagnosis-only execution grant without persisting session identity`;
2. `requires an explicit per-run grant for global-to-domain Call Flow execution`; and
3. `persists Flow expansion summaries with paged run and adaptation detail reads`.

There are two older `60_000` local timeouts later in `scale-pages.test.ts`; they are unchanged by
this patch. Thus the claim is three **new** locally budgeted cases, not three total occurrences in
the current files. A fixture timestamp value of `nowMs: 60_000` is also unrelated to Vitest's
timeout API and unchanged.

The `llm-grants.test.ts` working-tree diff also contains earlier test-expectation and test-name
changes unrelated to this timeout correction. They do not alter production behavior or timeout,
worker, or concurrency configuration. The timeout portion itself is the single third argument on
the named `it()` call. The other two assigned diffs likewise add only their named local timeout,
apart from the opening comment correction in `scale-pages.test.ts`.

## Comment and proportionality review

The corrected scale-file comment is accurate for the local policy it documents:

- the file now has three fixture-heavy cases with 60-second local budgets;
- the suite-wide 15-second hang guard remains distinct and untouched;
- it attributes the newly necessary headroom to full-suite contention rather than functional
  slowness;
- it does not propose changing worker concurrency; and
- it preserves the explicit sub-500 ms page/search assertions in the 10,000-summary case, so the
  local wall-clock allowance does not replace that targeted performance contract.

The 60-second choice is proportionate to the recorded evidence and existing convention. In t395's
authorized full suite, the three cases reported 18,845 ms, 14,670 ms, and 15,075 ms, with two
failing at the 15,000 ms ceiling and the passing case retaining only 330 ms (2.2%) headroom. The
same cases took about 2.5–3.3 seconds in serial isolation and at most 4.1 seconds in the narrow
three-process contention probe. A 60-second local ceiling gives the full-suite load substantial
headroom without weakening the 15-second default for the rest of the suite, and it reuses the
file's established timeout rather than introducing another policy value.

## Validation limits

`git diff --check -- <three assigned paths>` completed with no whitespace-error finding. Git
printed only its existing LF-to-CRLF working-copy warnings for the three files. I also inspected a
zero-context diff and the current `it()`/`60_000` associations. Per brief, I did not run a syntax
compiler, focused test, root suite, build, or any provider/live command. The required closure proof
remains one green Core root `pnpm test` on the supervisor's idle validation lane.
