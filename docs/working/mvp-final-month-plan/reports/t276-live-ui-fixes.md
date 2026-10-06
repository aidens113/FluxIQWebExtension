# t276 live UI fixes (lead report)

Status: Done (items 1, 2, 5, 6, 8, 9, 10 fixed; 3 guarded; 4 and 7 partly fixed, remainder outside t276 files)
Brief: `docs/working/mvp-final-month-plan.md`, "Brief: t276-live-ui-fixes (lead)".
Trees: `fxwork/t276/!FluxIQ` and `fxwork/t276/!FluxIQWebExtension`, both on `task/t276-live-ui-fixes` at dev
(downstream `6e5f19d7`, Core `da8b3241`). Core rebuilt before dispatch (`pnpm.cmd build` exit 0, 92 s).

## Evidence read

UI sections of the three round-1 debugs (`run-muw60unq-591e23bd` A, `run-muw6144a-e56f945d` D,
`run-muw60j7c-bb7c9a62` C) and `live-C-ui-review.md`. Step logs and screenshots are in the lane trees (read only):
`fxwork/t262/!FluxIQWebExtension/test-runs/instances/t262-slot-2/run-muw60unq-591e23bd/`,
`fxwork/t275/.../t275-slot-4/run-muw6144a-e56f945d/`, `fxwork/t274/.../t274-slot-1/run-muw60j7c-bb7c9a62/`.

## Code map (lead, before dispatch)

- Card reading shared by every client: Core `src/ui/activity-action/action-of.ts` (`activityActionOf` -> kind,
  target, outcome, why, tested, refused); `tested.ts` ("Checked, not pressed"); `types.ts` (`ActivityAction`).
- Core rows and their records: `R/activity/**` (observer, wording `action.ts` `pageName`, `draft-edit-card.ts`).
- Extension card words: `panel/chat/stream/step/{action-card,card-words}.ts` (a done card shows only "Done" or
  `tested`; Core's `said` sentence is shown only for a result check).
- Headline: `background/activity/headline.ts` already reads "Build failed" for a build; "Couldn't fix your Flow"
  on run A's creation build means the unit's subject was a run.

## Contract between the workers

Core adds `ActivityAction.result?: string`: what a finished action came to, in a few plain words, set only when
known ("13 rows from 5 pages", "removed step 9, Add to cart"). The extension card shows it after "Done: ".
The row a repeated pass acted on goes into `target` ("Confirm · Jonas Weber"), so every client shows it unchanged.

## Workers

| Worker | Effort | Owns | Items | Report |
| --- | --- | --- | --- | --- |
| core-cards | high | Core `R/activity/**` except `wording/run-ending.ts`; `src/ui/activity-action/**` | 1, 5, 6, 7, 9, 10 | `reports/t276-core-cards.md` |
| core-ending | high | Core `R/flow-bootstrap/unfinished-build/**`, `R/conversations/**`, `R/activity/wording/run-ending.ts` | 2, 4 (stored text) | `reports/t276-core-ending.md` |
| ext | high | extension `background/activity`, `background/panel`, `content/activity-overlay`, `panel/chat`, `panel/shell`, `shared/activity`; `docs/architecture/extension-client.md` | 3, 4, 8, 9 (cards), 7 (render `result`) | `reports/t276-ext.md` |

## Ledger

### 2026-10-06 — three workers returned; lead verified, wired and corrected
- Workers: core-cards (Partial: build-time read counts need the domain), core-ending (Done), ext (Partial: item 3 root
  cause unproven, item 4 flash in a file outside the brief). Reports: `t276-core-cards.md`, `t276-core-ending.md`,
  `t276-ext.md` beside this file.
- Lead changes:
  - Core `R/activity/decision-answer/edit-words.ts`: edit cards name steps, never number them where a name exists
    ('removed "Add to cart"', 'made "Confirm" repeat over "Friend requests"'); the draft's numbers are not what the
    person sees (U-3). `R/activity/tests/observer.test.ts` asserts no "step N" in those cards. Doc examples updated in
    `draft-edit-card.ts`, `ui/activity-action/{record,types}.ts`, `R/activity/run.ts` comment.
  - Extension `panel/chat/stream/step/action-card.ts`: copies Core's `action.result` (local declaration removed);
    new test in `stream/step/tests/messages.test.ts` ("Done: 4 rows", 'Done: removed "Add to cart"'), failing with the
    copy line removed (26 pass / 1 fail), passing with it.
  - Extension tests moved to Core's new words: `panel/chat/view/tests/action-card-view.test.ts:212` (U-12 sentence),
    `panel/chat/stream/step/tests/messages.test.ts:339` (`the "Colour" label`).
  - Every changed file converted to LF (core-ending's edits had kept the checkout's CRLF).
- Validation (lead, final tree):
  - Core `npx vitest run src/ui/activity-action .../runtime/activity .../flow-bootstrap/unfinished-build
    .../conversations .../tests/service-bootstrap` -> `Test Files 98 passed (98)`, `Tests 856 passed (856)`.
  - Core `node scripts/build-cache/cli.mjs fluxiq:check` -> exit 0; `node scripts/structure-audit.mjs` -> passed;
    `pnpm.cmd build` -> exit 0 (final, after the LF conversion).
  - Extension: all 70 test files under the six owned directories bundled with `run-subset.mjs` (label `t276-lead`),
    `node --test` -> `# tests 536 # pass 536 # fail 0`; outside tests that read `fluxiq/ui` or the changed words
    (`panel/icons/tests/lucide-icon`, `runtime/tests/navigate-action`; domain `node-run/tests/draft-control`,
    `tests/sanitize`) -> 32/32 and 31/31.
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check` -> exit 0 (Core build current);
    `... extension build` -> exit 0; `... domain check` -> exit 0; downstream `node scripts/structure-audit.mjs` ->
    passed.
  - Lane B's Core fix on dev (`7087e9ec`, `run-ending.ts` and its test): `git merge-file` of t276's versions against
    dev's, EOL-normalised -> 0 conflicts in both files.
- Outcome: Accepted with the open items below.

## Open items (outside t276's files; for the supervisor)

1. Item 4 start flash: `apps/extension/src/background/connection/project-context.ts:30-38` prefers the stored session
   project over Core's current one, so the Lab's preserved profile shows the previous project's thread before the
   Lab selects the new project. Lead recommendation: fix in the Lab (`packages/test-runner/.../chat-build/creation/
   project.ts`: select the chat project before the start capture); a person's own stored project is not a defect.
   Raw codes in old threads: hidden by the panel (`panel/chat/format/raw-codes.ts`) and no longer stored by Core.
2. Item 7 build-time list reads still show "Done" with no count: the domain must send rows (`outputs`) on every list
   read (as replays already do, `domain/src/runtime/llm-evidence/node-run/replay.ts:404`); pages need a new generic
   key in Core `R/llm/evidence-loop-decision.ts:111`. Test reads, playback "Records saved" and edits do show counts.
3. Item 3: no code path found that gives a build "Couldn't fix your Flow"; the overlay sample in
   `run-muw60unq-591e23bd.ui-review.local.json` confirms the overlay showed it. Guard added: the ending row's own
   title decides build vs run (`background/activity/ending-kind.ts`). Recording `server.activity` in the Lab would
   prove the cause. "Fixing your Flow" during a creation build's first re-author remains: Core's activity does not say
   create vs extend.
4. Lane B flags (coordinator, 2026-10-06): "Pickup or delivery?Carden Falls Supercenter" is the page's accessible-name
   join (extension `content/` evidence or `describe-element.ts`, outside t276); generic "Edit the Flow" cards during
   re-author are covered by item 1 wherever the re-author edits by amendments (verify live); the sampler's
   "flicker" at moments 3/4/6/18 counts real status changes (lane A analysed the same pattern as no visual flicker),
   not changed here.
5. Core `R/activity/wording` "Look · Extract list" (`core.describe_nodes` target) and U-12's "it wasn't on the page"
   for `target_unobserved` with no reason are unchanged (the latter is asserted by web and extension tests).

## What the next live run's UI review must see

- Item 1: every "Edit the Flow" card that changed the Flow says "Done: removed "Add to cart"" (added, moved, made
  optional, repeat over ...), named, with no step numbers; no "Edit the Flow · Done" just before a "Trying again" row.
- Item 2: the build ending has no "(t958)", "s8", "s11", "where", "end view" or code; no sentence cut mid-way; no
  sentence twice; a failed run reads "Run failed — it saved 30 rows, but the check found ...".
- Item 3: a failed creation build's overlay reads "Build failed · Build stopped: ...", never "Couldn't fix your Flow".
- Item 4: no raw code in any chat turn, including an old thread shown at start (the flash itself: open item 1).
- Item 5: run D's test cards read "Testing: Click · Confirm · Jonas Weber — Checked, not pressed", one per row.
- Item 6: run D's `/friends/` navigate reads "Open page · friends", not "the start page"; step 1 still "the start page".
- Item 7: test read cards "Done: N rows"; playback "Records saved — Done: 20 records saved"; build reads still "Done".
- Item 8: overlay status and card targets end on whole words ("Search Brightaisle…" never "Search Bri…"); a long list
  target reads "name, price and 4 more".
- Item 9: refusal cards read "Not done: <reason>" (identical repeats as one card "Not done (3 times): ..."); a refused
  call's status begins "Not done:"; never "Done" or "Working on it" on a refusal.
- Item 10: 'Look · the list around "Sponsored"' / 'Look · the "Brightaisle Plus" label'; U-11 and U-12 cards read
  "a repeat must start on a step that comes after the list it repeats over" and "FluxIQ didn't send it, as the step
  didn't say which control on the page to use".
