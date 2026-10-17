# Report: tasks-professional-network (t705)

## Outcome

Done. I added four live instruction tasks for `professional-network`. Each one has its own qualification workflow with an exact oracle and browser-path proofs. All tests on this site pass. Each new task's provider-free dry run returned `"status":"ready"` with `providerCallCount: 0`. The package suite fails only on the shared-list assertions the supervisor owns, plus some load-sensitive tests on other sites (see below).

## The four tasks

| id | brief kind | task `kind` | judgeBy | permissionPoint | what a correct run does |
| --- | --- | --- | --- | --- | --- |
| `professional-network-netherlands-data-engineers` | (a) filtered extraction across pages | navigate-and-extract | expected-dataset `extract-netherlands-engineers` | none (a read) | Searches people for "data engineer", filters to 2nd degree and Location "Netherlands", and reads all 4 pages. It returns 32 people, each once, in search order, with no promoted card. Columns: name, headline, location. |
| `professional-network-connect-kade-senior-engineer` | (b) lasting act | form | expected-dataset `extract-kade-request` | `{ consequence: "send_or_publish", control: "Send without a note" }` | Sends one connection request with no note to Matteo Ricci, the only Senior Data Engineer at Kade Energy. Then reads that request back from the Sent list. Columns: name, headline. |
| `professional-network-accept-messaged-invitations` | (c) conditional: act only on matching rows | form | expected-dataset `extract-accepted-invitations` | none (accepting is create_new/modify_existing, not gated) | Accepts only the 3 connection invitations that came with a message (Ximena Ruiz, Lucia Romano, Chidi Nwosu). Ignores nothing and accepts no page or newsletter invitation. Reports each person with their message. Columns: name, message. |
| `professional-network-kade-lead-contact` | (d) longer journey: navigation + form + read | navigate-and-extract | expected-dataset `extract-kade-lead-contact` | none (a read) | Global search, then the people results, then the 1st-degree and Kade Energy filters, then Pieter Groen's profile, then Contact info. Reads his email. Columns: name, email. |

None of the tasks has a `variantId`. Every dataset column appears by name in its instruction, and every dataset lists all its records.

Why all four are judged by `expected-dataset`: for a `playback-goal` task the created-Flow lane can only use the scenario's primary workflow (`packages/test-runner/src/flow-lane/creation/request.ts`). Here that is the stale-request withdrawal. So the two lasting-act tasks, (b) and (c), each pair a dataset with an exact `finalState`, the way `job-board-remove-closed-saved-jobs` does. `finalStateFacts` applies a non-primary workflow's `finalState`, so each run is judged on both.

Final-state oracles: every new workflow compares the page-embedded `invitation-store` as exact text.
- (a) and (d): the store must equal `STORE_AT_START`.
- (b): `STORE_AT_START` plus `urn:gl:invitation:new-49767` (Matteo).
- (c): `STORE_AT_START` minus received `urn:gl:invitation:6981004`, `6981295` and `6981586`.

## Exact entries for the shared tests (supervisor)

1. `apps/scenario-lab/src/scenarios/tests/realistic-site-live-tasks.test.ts`, test "qualification additions preserve...".
   - Add these four ids to the sorted additions list:
     ```
     "professional-network-accept-messaged-invitations",
     "professional-network-connect-kade-senior-engineer",
     "professional-network-kade-lead-contact",
     "professional-network-netherlands-data-engineers",
     ```
   - Raise `REALISTIC_SITE_LIVE_TASKS.length` by 4 for this site, from 68 to 72 counting this site alone.

2. `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`.
   - Permission map:
     ```
     "professional-network-connect-kade-senior-engineer": { consequence: "send_or_publish", control: "Send without a note" },
     ```
   - `ASKS_NOTHING`:
     ```
     "professional-network-netherlands-data-engineers": "a read",
     "professional-network-accept-messaged-invitations": "accepts received connection invitations, which sends, deletes and pays nothing",
     "professional-network-kade-lead-contact": "a read",
     ```

3. A third shared count that the brief did not list: `apps/scenario-lab/src/tests/recording-descriptions.test.ts` line 21 has `assert.equal(count, 42)`. That number counts every realistic workflow. This site adds 4 workflows, so 42 becomes 46 for this site alone. The other nine sites will add their own.

## What changed and why

All under `apps/scenario-lab/src/scenarios/professional-network/`:
- `live-tasks.ts`: the four tasks.
- `manifest.ts`: registers the four new workflows after `staleRequestAuditWorkflow`.
- `qualification/netherlands-engineers.ts`, `connect-kade-senior.ts`, `accept-messaged-invitations.ts`, `kade-lead-contact.ts`: one workflow each, holding the recordingScript and expected (pageFacts, extracted, finalState).
- `qualification/arrival-steps.ts`: the feed's app prompt, conversation and cookie steps, with ids prefixed per workflow.
- `qualification/index.ts`: barrel updated.
- `pages/profile.ts`: a small fixture change. A first connection's email in Contact info is now a `mailto:` link instead of bare text after a `<br>`, so an extract field (`a[href^="mailto:"]`) can read just the address. The address and the page text are unchanged.
- `qualification/tests/breadth-expected.test.ts`: oracle unit tests. For example, the Netherlands names are listed independently and the people who must be absent are asserted. Each new store differs from the start state by exactly the expected change. The permission declarations are checked.
- `tests/breadth-paths.test.ts`: browser proofs. Each workflow's recordingScript is played step by step and reaches its dataset and final state; (b) and (c) are also checked after a reload. Each task also has a wrong path that is shown to miss:
  - (a) keeping every card on the right search gives 36 rows. Deduped, Lars Hoekstra's page-2 promotion puts him out of order.
  - (b) a request to the wrong Kade row (Ruben Klaassen), and then the right request plus that wrong one.
  - (c) accepting all six connection invitations.
  - (d) Ricardo Alves's contact info is the wrong row, and a 2nd-degree profile (Matteo) shows no email.
- `tests/scenario.test.ts`: the workflow-id and task-id lists are updated.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build`: built.
- `node --test` on the PN `breadth-paths`, `honest-and-naive-paths`, `scenario` and `qualification/tests/*` files, after the final edit and rebuild: `# tests 36`, `# pass 36`, `# fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test`: `# tests 715`, `# pass 707`, `# fail 7`, `# cancelled 1`. This ran before a statement-packing fix to `breadth-paths.test.ts`, which changed formatting only.
  - Shared-list failures, expected:
    - `not ok 577 - every consequential task declares its permission point...`, diff `+ 'professional-network-connect-kade-senior-engineer': { consequence: 'send_or_publish', control: 'Send without a note' }`
    - `not ok 579 - every realistic-site task either declares its permission point or is recorded as asking nothing`, diff `+ 'professional-network-accept-messaged-invitations', + 'professional-network-kade-lead-contact', + 'professional-network-netherlands-data-engineers'`
    - `not ok 593 - qualification additions preserve the complete ordered original 57 tasks`, diff adds the four ids
    - `not ok 597 - all realistic workflow recordings have separate authored demonstration descriptions`, `46 !== 42` (the third shared count, above)
  - Other sites, run while a Lab dry run was building:
    - `not ok 42` auction-marketplace gallery layout: timed out after 90 s. Passed on rerun.
    - `not ok 324` local-classifieds dining tables: `marketplace_pdp_save` timeout. Passed on rerun.
    - crossborder-marketplace `flash-deal-second-item`: `⚡ Flash Deal` wait timed out after 1 s. On rerun, a different crossborder subtest failed (`flash-deal-stuck`). That looks like a 1 s visibility wait that is sensitive to load. I did not touch that site.
    - `not ok 615 fresh actual fixture child processes never reuse the prior owner epoch`: hit its 10 s child timeout, and did so again in the 5-file rerun. Run alone, it passed (`# pass 1`).
  - No professional-network test failed in the full run.
- `node scripts/structure-audit.mjs`: the first run failed with `statement-packing` on `breadth-paths.test.ts`. I fixed it, and it then printed `structure-audit: passed (202 warning(s), 639 baselined).`
- Dry runs, each with `FLUXIQ_TEST_TARGET=persistent-isolated` and the brief's exact command:
  - `professional-network-netherlands-data-engineers`: `{"status":"ready","providerCallCount":0,...,"workflowId":"netherlands-engineers",...,"judgement":{"judgeBy":"expected-dataset","stepId":"extract-netherlands-engineers","stepIndex":17}...}`
  - `professional-network-connect-kade-senior-engineer`: `{"status":"ready","providerCallCount":0,...,"workflowId":"connect-kade-senior",...,"stepId":"extract-kade-request","stepIndex":18}`
  - `professional-network-accept-messaged-invitations`: `{"status":"ready","providerCallCount":0,...,"workflowId":"accept-messaged-invitations",...,"stepId":"extract-accepted-invitations","stepIndex":13}`
  - `professional-network-kade-lead-contact`: `{"status":"ready","providerCallCount":0,...,"workflowId":"kade-lead-contact",...,"stepId":"extract-kade-lead-contact"}`

## Not verified

- No live run with a model.
- The recordings ran only in my own step interpreter in `breadth-paths.test.ts`, never in the Lab's recorder or replayer. Two things are untested there:
  - the Lab's numbered pagination over 4 pages, including whether it dedupes the page-3 and page-4 repeats the way the existing 3-page Rotterdam oracle relies on;
  - whether paging 4 pages hits the people search's limit of 3 requests in 3 seconds. My interpreter waits 2.3 s between pages.
- I did not rerun the full package suite after the formatting-only statement-packing fix. The site's tests were rerun and pass.

## Open questions or contradictions found

- (c) has no permissionPoint because accepting an invitation is not one of the gated classes (move_money, delete, send_or_publish). If a live build's model declares Accept as send_or_publish, the build stops at the permission gate. With no permissionPoint declared, that stop does not count as a pass, so the run would fail. That would be a product finding worth watching.
- The people search matches keywords against headlines only, not names. So a model that searches "Matteo Ricci" or "Pieter Groen" gets no results. For that reason, (b) and (d) describe the person by role and company.
