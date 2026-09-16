# w2-live-campaign-catalog — instruction catalog and live campaign runner

Worker report, 2026-09-16. No live provider calls were made, and `pnpm lab run`
was never invoked without `--dry-run`.

## Outcome

**Done.** The work has two parts:

- **Instruction catalog.** 36 plain-English tasks across 11 scenarios: 6 `form`,
  14 `extract` and 16 `navigate-and-extract`. It has a 9-test guard, exported
  through a new scenarios barrel.
- **Campaign runner.** `pnpm lab:campaign` runs selected catalog tasks one at a
  time through `pnpm lab run ... --llm-task create-flow --instruction-task <id>`.
  It retries only this machine's RAM-fault signatures and writes
  `test-runs/campaigns/<timestamp>/summary.md` and `.json`. It has 9 tests of its
  own, run against a stubbed Lab.

**There are no `navigate`-only tasks.** No pure-navigation scenario declares a
playback goal or an expected dataset, so nothing in the manifests can judge one
(see "Open questions").

## What changed and why

| File | Change |
| --- | --- |
| `apps/scenario-lab/src/scenarios/live-instructions.ts` (new) | Exports exactly `LiveInstructionTask` (the type) and `LIVE_INSTRUCTION_TASKS` (a frozen array of frozen tasks). Task literals are type-checked, not cast. |
| `apps/scenario-lab/src/scenarios/index.ts` (new) | The scenarios directory had no barrel. This one holds only the catalog export and its type. |
| `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts` (new) | Checks: ids are unique kebab-case; each task names a real scenario, a known kind and a declared variant. A goal task needs a declared `playbackGoal` and a primary-workflow variant that is not expected to fail. A dataset task needs exactly one workflow that declares `expectedDatasetId` in its resolved `expected.extracted`, with its variant belonging to that workflow, a stated count or record list, and no expected failure. Extract step ids are unique across each scenario's workflows. Every scenario with a goal or a dataset has at least one task. No instruction contains a selector-like token (14 named patterns, and the check is itself tested on both recipe-like and goal-like text). The catalog is frozen. |
| `scripts/lab/live-campaign.mjs` (new, 375 lines, 7 exports) | The campaign runner, described below. |
| `scripts/lab/tests/live-campaign.test.mjs` (new) | 9 tests. Every run uses an injected executor or a stub Lab script (`FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT`) plus a stub catalog (`FLUXIQ_LAB_CAMPAIGN_CATALOG`). `pnpm lab:test` picks them up, so `pnpm check` runs them. |
| `package.json` | One script entry: `"lab:campaign": "node scripts/lab/live-campaign.mjs"`. |

### How `expectedDatasetId` resolves (the lane must follow this)

`expectedDatasetId` is the `step` of an `expected.extracted` entry. The task type
the brief fixed has no `workflowId` field, so the owning workflow is found by
searching the primary workflow and each `workflows[]` entry. The match is the
one whose resolved expectation (with `variantId` armed, when given) lists that
step. The catalog test guarantees exactly one match per task, and that the
variant belongs to that workflow.

12 of the 31 dataset tasks live in a secondary workflow:

| Dataset step | Workflow |
| --- | --- |
| `extract-all-pages` | `paginated-extraction` |
| `extract-numbered-pages` | `numbered-pages` |
| `extract-search-results` | `search` |
| `extract-in-stock` | `in-stock-only` |
| `extract-images` | `with-images` |
| `extract-any-inventory` | `empty-table` |
| `extract-cheapest` | `sort-by-price` |
| `extract-every-post` | `extract-until-end` |
| `extract-paged-posts` | `extract-by-load-more` |
| `read-customer-book` | `extract-customer-list` |
| `extract-admins` | `filter-members` |
| `extract-cards` | `extract-card-labels` |

The rest are primary-workflow datasets: `extract-page-one`, `extract-inventory`,
`extract-loaded-posts`, `extract-order-details` and `read-account`. A
workflow-scoped variant such as `short-catalog`, `no-results`,
`load-more-button`, `no-rows`, `short-book` or `sorted-by-activity` resolves only
with that workflow selected.

### Runner behaviour

- **Selection.**
  - Tasks are chosen by id (kept in the order given), by `--kind K[,K]`, or with
    `--all`. `--limit N` applies last, and combining ids with `--kind` or
    `--all` is refused.
  - **A live run with no selection is refused.** A `--dry-run` with no selection
    shows every task.
- **Command per task.**
  - The planned command is `pnpm lab run <scenario> [--variant v] --live-llm
    --llm-profile lab-create-flow --llm-provider deepseek --llm-model
    deepseek-chat --llm-task create-flow --instruction-task <id> [Lab options
    after --]`. The profile, provider and model can be overridden.
  - It is spawned as `node scripts/lab/run-lab.mjs` with the same arguments,
    which is exactly what `pnpm lab` runs.
  - The campaign sets `--live-llm`, `--llm-*` identity, `--llm-task`,
    `--instruction-task`, `--variant` and `--workflow` itself; passing any of
    them after `--` is refused.
- **Execution.**
  - One task at a time, with `npm_config_workspace_concurrency=1`. Any
    differently-cased copy of that variable is removed first.
  - Child output is streamed to the terminal and saved to
    `<campaign>/logs/<task>.attempt-N.log`.
- **Catalog load.** Before the catalog is imported, the scenario lab is compiled
  into the Lab instance's own output directory (`resolveLabInstancePaths`), under
  the Lab's build lock (`withBuildLock`). `--no-build` skips this step.
- **Retries** (`ramFaultSignature`, up to `--max-attempts`, default 3, maximum 5).
  - **Retried** signatures:
    - exit code `3221225477`, its signed form `-1073741819`, or either number in
      the output (for example pnpm's `ELIFECYCLE ... exit code 3221225477`);
    - exit code 139, `SIGSEGV`, or the text "Segmentation fault";
    - the runner's `process.startup` category, taken from the result line or
      from the stderr refusal;
    - a JS `SyntaxError`, `TypeError`, `ReferenceError` or `RangeError` together
      with a path inside pnpm's own `dist`, `bin` or `lib`.
  - **Never retried:** an attempt that printed a run result (`runId` and
    `verdict`), whatever else its output contains, unless the result's category
    is `process.startup`.
  - The scenario-lab build gets the same retry policy, judged on exit code only.
- **Summary row** (rewritten after every task, so an interrupted campaign still
  leaves one). Each row has:
  - task, scenario, variant, kind, instruction;
  - `runId`, and `verdict` (`passed`, `failed`, `inconclusive`, or `no-result`);
  - `flowCreated`;
  - `actionTypes`: the distinct *executed* action types, taken from
    `evaluation.actions`, falling back to `run.json`, then `flow-lane.json`;
  - `judgement`: a goal task uses `evaluation.oracleVerdict`. A dataset task
    uses `evaluation.extraction`, which passes only when at least one step was
    judged, no step is `not_run`, and every judged step has
    `observedRecords == expectedRecords` and, where records are listed, has
    every record matched. `[]` fails; `null` means not measured;
  - `providerCalls`, from `snapshots/live-llm.json` `observed.calls`;
  - `reportedTokens` and `reportedCostUsd`: sums of the provider-reported
    per-call `totalTokens` (or input plus output) and `estimatedCostUsd`. They
    never use `accounting`, `totalEstimatedCostUsd` or `charged`, which include
    reservations. A test proves this using a bundle whose accounting says
    999,999 tokens and $9.99;
  - `callsWithoutReportedTokens`;
  - `failureCategory`: the rig category, the refusal category, or
    `ram-fault: <signature>`;
  - `automationFailure`, written as `category/code`;
  - `issueCodes`: the union of per-call `validationCodes`, recovery-intervention
    codes, runtime-patch `issueCodes`, `flow-lane.json` `proposalIssues`, and
    the failure codes. Only code-shaped strings are kept, so free text is
    dropped;
  - `attempts` and `ramFaults`;
  - `runnerMessage`: only when there was no result, cut to 240 characters, with
    long token-like strings redacted.
- **Exit code:** 0 only when every task's verdict is `passed`.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (in `apps/scenario-lab`): exit 0.
- `node scripts/build-scenario-lab.mjs`, then
  `node --test dist/scenarios/tests/live-instructions.test.js`: 9 tests, 9
  passed, 0 failed.
- **Catalog negative probes** (each edited the compiled catalog, ran the tests,
  then restored it; the restored catalog passed 9/9):

  | Break | Tests that failed |
  | --- | --- |
  | `short-catalog` pointed at `extract-page-one` | test 4 |
  | `moved` changed to `save-and-exit` (a variant expected to fail) | test 3 |
  | `data-testid` added to an instruction | test 7 |
  | A duplicate id | test 1 |
  | `auth-gate` removed from coverage | tests 4 and 6 |
  | A made-up variant | tests 2 and 4 |

- `node --test scripts/lab/tests/live-campaign.test.mjs`: 9 tests, 9 passed.
- **Runner negative probes** (each edited `live-campaign.mjs`, ran the tests,
  then restored it; `cmp` confirmed the restore and the tests passed 9/9):

  | Break | Tests that failed |
  | --- | --- |
  | Retrying a run that reported an outcome | tests 4 and 6 |
  | Reading tokens from Core's accounting | test 5 |
  | Dropping the concurrency override | tests 6 and 8 |
  | A dry run that executes | test 7 |
  | Retrying every non-zero exit | test 6 |

- `pnpm lab:campaign --dry-run`: exit 0. It printed
  `# 36 task(s), one at a time, npm_config_workspace_concurrency=1; ...`
  followed by 36 `pnpm lab run ... --llm-task create-flow --instruction-task <id>`
  lines. The scenario-lab build ran first, silently.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (57 warning(s),
  17 baselined)`, exit 0. None of the findings is in my files; the only
  scenario-lab match is the pre-existing `product-catalog/format.ts`
  exported-values warning.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test`: `# tests 236`,
  `# pass 236`, `# fail 0`, exit 0.
- `pnpm check`: exit 0. Output included the structure tests (`# tests 96`,
  `# pass 96`), `lab:test` (`# tests 24`, `# pass 24`; the log shows the new
  campaign tests among them), `structure-audit: passed`, and every package
  check `Done`.
- No RAM-fault reruns were needed.

## Not verified

- **No live run, by instruction.** The create-flow lane does not exist yet.
  Today's `lab run` would refuse these commands in three ways:
  - `--instruction-task` is an unknown option (`rejectUnknownOptions` in
    `packages/test-runner/src/commands.ts`);
  - `--variant` without `--flow` is refused ("--variant requires --flow");
  - `live-llm-plan.ts` refuses `--llm-task create-flow` ("has no live Flow-lane
    runner").

  The campaign would record each of these as `no-result` with the refusal
  category, and would not retry it.
- **The summary reader is untested against a real create-flow bundle.** It
  follows today's bundle shapes (`evaluation.json`, `run.json`,
  `snapshots/live-llm.json`, `snapshots/flow-lane.json`, checked against
  `test-runs/run-mu4ovip2-b15551d3`). If the new lane writes a different
  snapshot, or its own judgement field, `summarizeTask` needs a line added.
- **`actionTypes` are the executed action types,** not the saved Flow's node
  types, because no bundle currently publishes the latter.
- **No instruction was tried against a model,** so whether the wording produces
  the expected column names is untested.
- **The pnpm-internal-error signature is modelled on the documented
  `bunction` crash** (a path inside pnpm's `dist` plus a JS error name). It was
  tested only on synthetic text.

## Open questions or contradictions found

1. **Pure navigation and three named scraping scenarios have nothing to judge
   by.** `navigation`, `long-document` and `dynamic-list` declare neither a
   `playbackGoal` nor any `expected.extracted`, in any workflow or variant, so
   none has a task. The kind `navigate` therefore has no tasks. The same is true
   of `basic-form`, `iframe-checkout`, `ambiguous-targets`, `delayed-ui`,
   `failure-surfaces`, `reconnect`, `modal-flows`, `file-transfer`,
   `intermediate-state`, `keyboard-forms` and `storefront-checkout`, and of the
   navigation-only workflows in `admin-console` (`browse-to-customer`,
   `switch-settings-tab`) and `member-directory` (`remove-invitations`). All of
   these declare only `expected.finalState`.
   - **Recommendation:** either add a `playbackGoal` to those manifests (a
     scenario-owner change I was barred from), or add
     `judgeBy: "final-state"`. The second is a type change the brief fixed.
2. **The lane must find the workflow from `expectedDatasetId`, as described
   above,** because the task type has no `workflowId`. The alternative is for
   the campaign to pass `--workflow`. I did not do that, because the brief's
   command form omits it and the lane's handling of `--workflow` together with
   `--instruction-task` is not yet defined. If the supervisor prefers an
   explicit field, adding an optional `workflowId` to the type would be a
   one-line change plus a test assertion.
3. **`auth-gate-account-summary` needs a secret.** The instruction deliberately
   omits the password. The lane must supply the manifest's declared secret
   `auth-gate-password` (from `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD`) to the
   created Flow.
4. **Variants I left out,** because their runs are expected to fail and so
   cannot be judged by a goal or a dataset:
   - `identity-drift/save-and-exit`, `multi-tab/popup-blocked` and
     `auth-gate/expired`;
   - `infinite-feed`'s unarmed `extract-by-load-more` workflow (its expectation,
     10 posts, contradicts any natural "collect every post" instruction).
5. **Two defaults are guesses.** The default profile id `lab-create-flow` is my
   invention, and the model `deepseek-chat` is the one the earlier live runs
   recorded. The lane owner should confirm the profile id.
6. **Pre-existing, not changed:** `run-lab.mjs` calls `owner.pid` in its build
   lock `onWait`, but `withBuildLock` documents that `owner` may be `null`. The
   campaign guards this case (`owner?.pid`); `run-lab.mjs` does not.

## Full task list

| # | Task id | Scenario / variant | Kind | Judged by | Instruction |
| --- | --- | --- | --- | --- | --- |
| 1 | `instruction-only-form-submit` | instruction-only-form | form | playback goal | Fill in the form with Ada as the name and the Team plan, then submit it. |
| 2 | `llm-target-drift-activate` | llm-target-drift | form | playback goal | Activate the recorded target exactly once, and leave the page's mode as it is. |
| 3 | `identity-drift-rename` | identity-drift | form | playback goal | Rename the workspace to Aurora Field Team and save the settings. |
| 4 | `identity-drift-rename-moved-save` | identity-drift / moved | form | playback goal | Rename the workspace to Aurora Field Team and save the settings. |
| 5 | `identity-drift-rename-relabelled-save` | identity-drift / text-only | form | playback goal | Rename the workspace to Aurora Field Team and save the settings. |
| 6 | `identity-drift-rename-redesigned-save` | identity-drift / renamed-redesign | form | playback goal | Rename the workspace to Aurora Field Team and save the settings. |
| 7 | `product-catalog-first-page` | product-catalog | extract | dataset `extract-page-one` | Scrape the products shown on the first page of the catalog into a table with columns name, price, rating and url. |
| 8 | `product-catalog-first-page-reworded-prices` | product-catalog / text-variant | extract | dataset `extract-page-one` | Scrape the products shown on the first page of the catalog into a table with columns name, price, rating and url. |
| 9 | `product-catalog-first-page-sparse-cards` | product-catalog / sparse-cards | extract | dataset `extract-page-one` | Scrape the products shown on the first page of the catalog into a table with columns name, price, rating and url. |
| 10 | `product-catalog-first-page-absolute-links` | product-catalog / absolute-links | extract | dataset `extract-page-one` | Scrape the products shown on the first page of the catalog into a table with columns name, price, rating and url. |
| 11 | `product-catalog-all-pages` | product-catalog | navigate-and-extract | dataset `extract-all-pages` | Scrape every product in the catalog, across all of its pages, into a table with columns name, price, rating and url. |
| 12 | `product-catalog-all-pages-short-catalog` | product-catalog / short-catalog | navigate-and-extract | dataset `extract-all-pages` | Scrape every product in the catalog, across all of its pages, into a table with columns name, price, rating and url. |
| 13 | `product-catalog-all-pages-link-pagination` | product-catalog / link-pagination | navigate-and-extract | dataset `extract-all-pages` | Scrape every product in the catalog, across all of its pages, into a table with columns name, price, rating and url. |
| 14 | `product-catalog-numbered-pages` | product-catalog | navigate-and-extract | dataset `extract-numbered-pages` | Scrape every product in the catalog by visiting each numbered page in turn, with columns name, price, rating and url. |
| 15 | `product-catalog-search-lamp` | product-catalog | navigate-and-extract | dataset `extract-search-results` | Search the catalog for "lamp" and scrape every product the search returns with columns name, price, rating and url. |
| 16 | `product-catalog-search-no-results` | product-catalog / no-results | navigate-and-extract | dataset `extract-search-results` | Search the catalog for "lamp" and scrape every product the search returns with columns name, price, rating and url. If nothing matches, an empty table is the right answer. |
| 17 | `product-catalog-in-stock` | product-catalog | navigate-and-extract | dataset `extract-in-stock` | Show only the products that are in stock, then scrape all of them across every page with columns name, price, rating, url and availability. |
| 18 | `product-catalog-photos` | product-catalog | extract | dataset `extract-images` | For each product on the first page of the catalog, collect its name, the address of the photo it shows, the photo's alt text, and the address of any photo the card is still holding back to load later, with columns name, image, imageAlt and deferredImage. |
| 19 | `product-catalog-photos-lazy` | product-catalog / lazy-images | extract | dataset `extract-images` | For each product on the first page of the catalog, collect its name, the address of the photo it shows, the photo's alt text, and the address of any photo the card is still holding back to load later, with columns name, image, imageAlt and deferredImage. |
| 20 | `data-table-inventory` | data-table | extract | dataset `extract-inventory` | Scrape the whole inventory table with columns product, category, price and stock. |
| 21 | `data-table-inventory-reordered-columns` | data-table / column-reorder | extract | dataset `extract-inventory` | Scrape the whole inventory table with columns product, category, price and stock. |
| 22 | `data-table-inventory-large` | data-table / large-table | extract | dataset `extract-inventory` | Scrape the whole inventory table with columns product, category, price and stock. |
| 23 | `data-table-inventory-may-be-empty` | data-table | extract | dataset `extract-any-inventory` | Scrape the inventory table with columns product, category, price and stock. If every product has been delisted, an empty table is the right answer. |
| 24 | `data-table-inventory-empty` | data-table / no-rows | extract | dataset `extract-any-inventory` | Scrape the inventory table with columns product, category, price and stock. If every product has been delisted, an empty table is the right answer. |
| 25 | `data-table-cheapest-product` | data-table | navigate-and-extract | dataset `extract-cheapest` | Sort the inventory by price from lowest to highest and record only the cheapest product, with columns product, category, price and stock. |
| 26 | `infinite-feed-first-forty` | infinite-feed | navigate-and-extract | dataset `extract-loaded-posts` | Scroll the neighbourhood feed until 40 posts are showing, or until the feed runs out, and collect every post that has loaded with columns title, author and published, where published is the post's exact timestamp. |
| 27 | `infinite-feed-first-forty-short-feed` | infinite-feed / end-early | navigate-and-extract | dataset `extract-loaded-posts` | Scroll the neighbourhood feed until 40 posts are showing, or until the feed runs out, and collect every post that has loaded with columns title, author and published, where published is the post's exact timestamp. |
| 28 | `infinite-feed-every-post` | infinite-feed | navigate-and-extract | dataset `extract-every-post` | Collect every post in the neighbourhood feed, loading more until the feed says there is nothing left, with columns title, author and published, where published is the post's exact timestamp. |
| 29 | `infinite-feed-load-more` | infinite-feed / load-more-button | navigate-and-extract | dataset `extract-paged-posts` | Collect every post in the neighbourhood feed, pressing Load more until no more posts appear, with columns title, author and published, where published is the post's exact timestamp. |
| 30 | `multi-tab-order-details` | multi-tab | navigate-and-extract | dataset `extract-order-details` | Open the details of purchase order PO-4472, record its order number, supplier, status, buyer, delivery date and total with columns order, supplier, status, buyer, delivery and total, then go back to the order list and confirm the review of PO-4472. |
| 31 | `auth-gate-account-summary` | auth-gate | navigate-and-extract | dataset `read-account` | Sign in as demo.user with the demo password you have been given, then read the account holder, plan and balance from the account page with columns holder, plan and balance. |
| 32 | `admin-console-customer-book` | admin-console | extract | dataset `read-customer-book` | Scrape every customer in the customer list, not just the ones on screen, with columns company, reference, plan and mrr. |
| 33 | `admin-console-customer-book-short` | admin-console / short-book | extract | dataset `read-customer-book` | Scrape every customer in the customer list, not just the ones on screen, with columns company, reference, plan and mrr. |
| 34 | `member-directory-hollis-admins` | member-directory | navigate-and-extract | dataset `extract-admins` | Find the members whose name matches "hollis" and who are admins, and scrape them with columns id, member, role, team and status. |
| 35 | `member-directory-hollis-admins-by-activity` | member-directory / sorted-by-activity | navigate-and-extract | dataset `extract-admins` | Find the members whose name matches "hollis" and who are admins, and scrape them with columns id, member, role, team and status. |
| 36 | `sensitive-input-card-labels` | sensitive-input | extract | dataset `extract-cards` | List the saved cards with columns label and expiry. Leave the unlock codes out entirely. |

**Scraping and navigation scenarios with no expected dataset (and no playback
goal):** `navigation`, `long-document`, `dynamic-list`. Every other scenario the
brief named (`data-table`, `product-catalog`, `member-directory`,
`infinite-feed`) is covered, as are the other scenarios that declare expected
extraction: `multi-tab`, `auth-gate`, `admin-console` and `sensitive-input`.
