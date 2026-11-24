# t990 recorded-run oracle acceptance (P1-P3)

Worker report, 2026-11-23. Brief: `briefs/t990-recorded-oracle.md`. Trees: `fxwork/t990/!FluxIQWebExtension` and `fxwork/t990/!FluxIQ`. No git mutation, no provider or paid call. Every browser was visible, held to the snapshot sandbox (page scripts and network off) and ran on realistic scenarios only.

## Outcome

Partial. Four of the five tasks pass on a campaign run's own recorded reads, with no provider, through today's production reader and Core's own data path. The oracle's exact table matched record by record, in its column order and its row order:

| Task | Result | Run and reads | Table |
| --- | --- | --- | --- |
| crossborder-marketplace-free-hubs-under-ten | **pass** | run-mwoq9g4l (campaign run 15), explored reads p1-p3 (0012, 0020, 0028) | 10/10 in order |
| everything-store-plus-earbuds-under-50 | **pass** | run-mwow1z18 (run 27), explored reads p1-p4 (0025, 0033, 0039, 0045) | 13/13 in order |
| job-board-remote-easy-apply | **pass** on three runs | run-mwov5v61 (run 24), run-mwp1e5oc (run 37), run-mwoi785f (run 7, lane B), unfiltered p1-p3 each | 7/7 in order, each |
| professional-network-netherlands-data-engineers | **pass** | run-mwovplov (run 26), the saved Flow's four pages (passes 0215, 0217, 0219, 0221) | 32/32 in order |
| photo-social-august-over-1300 | **fail: recording gap** | run-mwon94xa (run 14), the only photo run whose trace store survives | 0/1 |

Model calls 0 and provider calls 0 by construction. External calls were observed as 0: the sandbox counted no leaked request in any run.

Photo-social cannot pass from this evidence. The one admissible run read only the grid's post links. The run never opened a post, so it never read the post-footer date or the exact like count the task asks for. Runs 28 and 39, which read dates, kept no trace store (their `.attempt-work` was removed), so their pages cannot be replayed. This is the honest result, and no rows were supplied.

## What changed and why

**The command.** A task mode of the existing recorded-read command: `lab recorded-read SITE --task TASK --input FILE --out FILE`. The code is in `packages/test-runner/src/recorded-attempt-replay/read-oracle/`. Its input names three things: a copied run's step folder, a copied trace store, and read step numbers in capture order. For each read:

1. **Discovery** (`discover.ts`). The step's call id comes from its own `meta.json`. Exactly one `web.dom.extract_list` command in the trace must carry that call id. When none or several match, the read is refused; the command never chooses one. The admission is t986's `readRecordedReadSource`, unchanged apart from the replayed kind below.
2. **Control.** The recorded command runs over its recorded snapshot. Three equalities are required: the native result, the raw native rows, and the model-visible rows against the canonical step, which carries its projection context.
3. **Today's production reader, P1** (`retained-read.ts`, `snapshot-gateway.ts`). A fresh `createWebAutomationLlmEvidenceRuntime` gets one gateway: the recorded snapshot in the sandbox, answered by the domain's own result builder. The runtime detects the page's list with `web.detect_repeating_structure`. It then runs the model's recorded `core.run_node` input, renaming only the list handle to the one this detection reissued. A saved Flow's pass instead goes through the domain's replay of the saved step, `replay: "step"` with its held `extractionBinding`. Four checks are required:
   - the dispatched item selector equals the recorded one;
   - every recorded requested cell is unchanged;
   - the domain's differential rule D37 (`webOfflineReadDynamicContent`) passes;
   - and the detected column keys named by the call are still detected.

   Every admitted read retained more fields than it recorded: crossborder 6 → 15, earbuds 6 → 27-28, job-board 6-7 → 15, Netherlands 3 → 19-20.
4. **Collection and data stage, P2** (`collect.ts`). Each answer goes to Core's own row sink (`automationStudioAnswerFirstRowSink.fromCall`), as the live call chain stores it. It is then told to Core's own result feed: an explored read is added with `expect add` + `called` + `draft`, and a saved Flow's pass with `called` + `passed` against one saved read step. The feed's ledger joins the pages by list and place. Its data stage, `automationStudioAnswerFirstDataStage` in automatic mode, binds the declaration to the retained schema and applies it. The processing reference time is the run's start, taken from `entry.json`. Core exposes these through a new subpath, `fluxiq/automation/answer-first-data`, a barrel that re-exports Core's own functions unchanged. It is a separate subpath because the service loads answer-first by a dynamic import.
5. **Oracle** (`oracle-table.ts`). The answer, projected to its columns, is judged by `loadOracleExpectation` + `judgeTrialDatasets`, the Lab's created-Flow dataset judgement. Two diagnostics sit beside the verdict, in counts only. `expectedInCollected` is how many oracle records any collected row holds. `expectedByColumnInCollected` counts, per column, whether the right row holds the right value.

**Declarations** (`declarations.ts`). These are test fixtures, not model guidance, and each states only its instruction. Crossborder keeps the existing scripted fixture (`scriptedTaskProcess`). The other four are new:
- Earbuds: `brightaisle_plus` present, `rating` at least 4, `price` less than 50, `data-ad-id` absent, `name` not matching `^(replacement )?(ear ?tips|charging case)\b`. Columns name, price, rating, url.
- Job board: `location` equals `Remote (UK)`, `easilyApply` present and contains `Easily apply`, `salary` present. Sort `posted` descending as a date. Columns title, company, salary.
- Netherlands: `data-ad-slot` absent. Columns name, headline, location.
- Photo: `date` from 2026-08-01 to 2026-08-31, `likes` greater than 1300, sort by date descending. Columns date, likes.

`model-aliases.ts` handles one naming case. A declaration may name a field by its site key, for example `brightaisle_plus`. When every admitted read aliased that same detected key to one model key, the name is rewritten to the model key, for example `plus`. Every rewrite is recorded in the report (`declarationRewritten`). Nothing else is rebound; Core's strict exact-id or unique-label binding decides.

**Product defects fixed at their cause:**
- **Recorded-read projection context gave a false gap for link-free reads** (`read-parity/boundaries.ts`). The read writer states `origin` only when a row holds a link. The crossborder reads hold no link, so neither side stated an origin, and the context became `projection_context_unavailable`. That refused correct reads. Now equal absence matches, and the addresses are still compared. A canonical read without an origin beside a reproduction with one stays unavailable, which keeps t986's existing test. The new test covers both cases.
- **A saved Flow's pass could not be admitted** (`read-parity/source.ts`, `canonicalKind: "replayed"`). Such a pass's step shows only each kept row's label (`readRows`). The admission now accepts those labels as the canonical evidence, and only for a step whose own result code is `core.replay.replayed`. It never accepts labels for an explored read. Raw native equality is unchanged, and the labels plus the page address stand in for the model-visible comparison. Without this, the Netherlands recording's only complete four-page collection was inadmissible.
- `recordedOperations` moved unchanged from `read-parity/source.ts` into its own file, `read-parity/recorded-operations.ts`, because discovery reuses it.

**Other changes:**
- `domain/src/index.ts` now exports `gatewayActionResultFromBrowserResult` on the node entry.
- `commands.ts` and `cli.ts` gained the `--task` option.
- `docs/architecture/recorded-offline-proof.md` gained one paragraph describing the mode.

## Per-task results and causes

All reports are under ignored `test-runs/t990-oracle/` and are named `<input>-r<N>.json`.

- **Crossborder hubs**, run-mwoq9g4l `hubs-mwoq9g4l-r3.json`: pass. All 3 reads were admitted (control parity true; item selector match; D37 clean).
  - Collected 57 rows and kept 10.
  - Filter account: price at most 10 left out 43, `shipping` equals "Free shipping" left out 10, ad absent left out 9.
  - First run r2 failed only on the boundary defect above.
- **Earbuds:**
  - run-mwow1z18 `earbuds-mwow1z18-r1.json`: **pass**, 13/13.
    - Caveat: the model's own read `where` narrowed these reads on the page (Plus, not sponsored, rating, price). Only the kept rows were recorded, so this pass proves processing, not broad collection.
    - The declaration's accessory condition removed the 2 accessories.
  - run-mwocg0zw `earbuds-mwocg0zw-r2.json`: the clean unfiltered proof, with 4 reads of p1 (twice), p2 and p3.
    - The 11 records it collected are all right and in order, 11 positional matches.
    - The 2 missing oracle records are on pages it never read: a recording gap (`expectedInCollected` 11/13).
    - r1 failed on declaration binding (`brightaisle_plus` missing, aliased `plus`), which the alias rewrite fixed.
  - run-mwoznmcq `earbuds-mwoznmcq-r2.json`: two causes.
    - Recording gap: it explored only p1 and p5 (`expectedInCollected` 0).
    - The model's recorded call read `rating` from the stars' `aria-label`, in another form than the oracle's: 0 of 3 found records match on rating. The other columns match: name, price and url 3/3.
    - The task's other runs show the pipeline is right, so this is the recorded call's column choice, not a data-stage defect.
- **Job board**, `remote-mwov5v61-r2`, `remote-mwp1e5oc-r3`, `remote-mwoi785f-r3`: pass, 7/7 in order on all three runs.
  - Each run: 35 rows collected and 7 kept. Location left out 4, the Easily apply tag 27, salary 1 alone.
  - Earlier runs (r1) were withheld as `answer_first.processing_evidence_missing`. My first declaration tested `easilyApply contains "Easily apply"` alone, and Core's automatic stage reads an absent optional cell as missing evidence, not as false. This was a wrong criterion on my side: the declaration now states that the tag is shown, and its words.
- **Netherlands**, run-mwovplov `nl-mwovplov-from44-r2.json`: pass, 32/32 in order.
  - Four admitted pass reads; collected 34; repeats 2 dropped; nothing filtered out. The saved read's own `where` already excluded the promoted rows on the page.
  - The two explored reads (`nl-mwovplov-r1`) are page 1 only: a recording gap, 10/32.
  - The `forward.1` pass group (`forward1-r2`) holds 25/32. It was withheld because 3 kept rows have no name: that saved read had no `name present` condition.
  - The `recheck` pass group (`recheck-r2`) read a wider result list, 44 people over five pages. All 32 are present but 12 others are too, so that pass group read a different query: wrong evidence, not acceptance.
- **Photo-social**, run-mwon94xa `photo-mwon94xa-r1.json`: **recording gap.** The read retained 7 fields over 45 grid tiles, none of them the opened post's date or likes. The binding reports `date (missing), likes (missing)`, and `expectedInCollected` is 0/1.

## Commands run and observed results

All heavy commands ran through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- …`, one at a time. Logs are in `test-runs/t990-logs/`.
- **Evidence:** the t959/t960 campaign stores and `C:/Users/osrs_/FluxStuff/lab-runs/<day>/<run>` were copied to `test-runs/t990-evidence/` for 10 runs. `diff -rq` showed 0 differences for every store and every step folder. Commands ran on a second copy, `test-runs/t990-work/`.
- **Core:**
  - `node scripts/build-cache/cli.mjs fluxiq:build` → exit 0 (132 s).
  - `… contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` → exit 0.
  - `pnpm --filter fluxiq check` → exit 0, 0 TS errors (127 s).
  - `node scripts/structure-audit.mjs` → exit 0, "passed (569 warning(s), 903 baselined)".
- **Downstream:**
  - `pnpm --filter @fluxiq-web-extension/browser-host build` → exit 0. It was not built in this worktree, so the first test-runner check failed only on its missing types.
  - `pnpm --filter @fluxiq-web-extension/test-runner check` → exit 0.
  - `pnpm --filter @fluxiq-web-extension/test-runner build` → exit 0. Run 6 times; the first failed on a test fixture missing `validation`, which was fixed.
  - `pnpm --filter @fluxiq-web-extension/domain check` → exit 0.
  - `node scripts/structure-audit.mjs` → first exit 1: an `as never` cast and statement-packing in my new `snapshot-gateway.test.ts`, both fixed. Then exit 0, "passed (258 warning(s), 551 baselined)".
- **Owners:** `node --test --test-concurrency=1` on the four read-oracle test files, the five read-parity test files and `tests/commands.test.js` → 64/64 pass. An earlier run (owners-2) failed one t986 boundary test: my first context rule turned "unavailable" into "changed". I narrowed the rule; I did not change the test. Then `commands.test.js` alone with the new `--task` cases → 40/40.
- **Oracle runs:** `node scripts/lab/run-lab.mjs recorded-read <site> --task <task> --input test-runs/t990-oracle/<input>.json --out test-runs/t990-oracle/<input>-r<N>.json`, exit 0 for each passing report in the table above. The Lab prelude rebuilt or reused every package and refused nothing.

## Not verified

- Live behaviour. This is a recorded-read proof: it is not an attempt, a four-attempt series or a scoreboard. `fullAttemptAccepted: false` holds throughout.
- Full suites: none were run, per the brief.
- Two read selections are the input's, and the report says so:
  - Explored reads are told to the feed as added draft steps. In the live run the model decided which reads it added.
  - Saved Flow passes use one synthetic saved step per distinct step input.
- The earbuds pass depends on the model's on-page `where`. The unfiltered earbuds run lacks pages 4-5, so broad collection is proven on hubs, job board and Netherlands, not on earbuds.
- Firefox, and recorded reads from stores other than the 10 copied runs.

## Open questions or contradictions found

1. **Retained schema labels carry a first-item page value.** Examples: `text: '<product title>'`, `price: '9,87 €'`. They come from `structure/packet.ts` `boundList` (`label: field.shown.label`), are copied by `webPlanRetainedExtractionSchema`, are stored in the dataset schema, and are used as answer column labels. `docs/architecture/retained-extraction.md` says the binding holds no parsed sample. As a result, a declaration cannot bind by label in the site's terms, and page values sit in stored schemas. I did not fix it, because the stored-schema label is a P1 contract decision. The proposal: the stored label is the page's own column words where they exist, else the field key; the sample stays only in the model's packet. My reports never write labels.
2. **An alias that reads the same detected column drops the site key.** For example `plus: "brightaisle_plus"` keeps only `plus`, so a run-independent declaration naming the site key cannot bind. The test fixture rewrites it from the run's own alias map. A product fix needs a lead decision: keep the source key in schema metadata, or label it with the key.
3. **Core's automatic stage reads a positive text test over an absent optional cell as missing evidence**, while `is: present` reads absence as false. This is P2's accepted conservative design. A declaration must state presence explicitly for tag or mark columns. Worth confirming that this is intended for detected columns the read did look at.
4. **The earbuds pass (run-mwow1z18) relies on rows the model's read already narrowed on the page.** If the lead wants acceptance from unfiltered collection only, earbuds stays a recording gap: no surviving store holds unfiltered reads of all five pages.
5. **Photo-social needs a new recording.** A provider-free path cannot supply opened-post dates and counts from run-mwon94xa.

No wording or oracle change is proposed for any task.
