# t797-pair: undo pairing by effect (P4 item 5, CC4 `inverse`)

F = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap` in `fxwork/t797/!FluxIQ`.

## Outcome

Done. All four goals are in. The new test failed first: 5 of its 9 tests failed against the old behaviour. Every test in the
brief's directories passes except 5 in `F/tests/site-reset-build.test.ts` and `F/tests/site-reset-irreversible.test.ts`. Those
5 fail the same way with my behaviour changes reverted, so they come from another worker's in-flight edits, not from this
change. `fluxiq:check` passed. The structure audit passed.

## The CC4 shape as shipped

- `F/site-reset/contracts.ts`: `AutomationStudioSiteResetEffect` =
  `{ class?: "observe"|"state"|"commit"; places?: {place, before, after}[]; placeChanged?: boolean; inverse?: {action, control, toState?} | {kind: "irreversible"} }`.
  - `AutomationStudioSiteResetPlace.effect?: AutomationStudioSiteResetEffect` holds the parsed record on the act.
  - `AutomationStudioSiteResetRead.effect?: unknown` is the raw record the client puts on the read just after a press.
- Token meanings, compared for equality only:
  - `inverse.action` is compared with the press's registered `operation`.
  - `inverse.control` is compared with the press's `spot.place`.
  - `toState` is compared with the state the press leaves that control in. That is the toggle's `to` from the counts, or the press's own effect place at `control`. When neither reports it, nothing pairs.
  - `class` and `placeChanged` are parsed and kept for P8. Pairing does not read them.
- `F/site-reset/act-places.ts` `effectOf` parses the record member by member. A malformed member is dropped and the rest are kept; nothing at all is kept when no member survives. Tokens match `/^[A-Za-z0-9:._-]{1,128}$/`, and a record may name at most 256 places.
- **The web domain does not fill `effect` yet.** Also, `F/site-reset/start-check.ts` (not mine) builds its reads from a fixed list of fields, so it drops `effect` today. A domain fill reaches Core only after a one-line pass-through is added there. See Open questions.

## Where pairing happens

- **The match** is `F/reset-undo/claims.ts`:
  - `pairOf(by, toggle)` returns the one earlier open act the press reverses. "Open" means claimable, not possible, not spent and not already paired. Both acts must carry the same `spot.resource`. Two matches pair nothing.
  - `reverses(...)`: when the act has CC4 effect places, the press's places must be exactly the act's places reversed (after back to before), with nothing extra. Otherwise both toggles must be at the same place with `to` and `from` swapped. An `inverse` on the act narrows the match. `irreversible` never pairs.
- **The record** is `paired(act, by)`. It records what `ran` records for a press under `undoes` admitted `own`: named lists (through `reads`), `attempts += 1`, `undoneBy`, and `chain = "own"`.
- **The triggers** are in `F/reset-ledger/recording.ts`:
  - `explored` keeps `pairPress` for each reversible press. It does this whatever class the press declared.
  - `pairPressed()` runs on every read. The facade (`F/site-reset/ledger.ts` `observed`) calls it after `tracker.read` and before acts settle. It is the path that works from control counts.
  - `placed` stores `effect` and tries the CC4 path. A paired press's `placed` or `noEffect` becomes `undoSeen` on its act.
- **What happens to the paired press** (private `pair`):
  - It is marked `pairedWith` and set to `undoable = false`. Leftover answers it as "not left", so it is never asked for, listed or left.
  - It is dropped from `exploredActs`.
  - `recordedInPhase` goes down by one, and the paired act is `locate`d.
  - New fields on `F/reset-ledger/act.ts`: `effect`, `pairPress`, `pairedWith`.
  - Residual: the press's `act-N` id was given out, and the project sink was told about it, when it landed. That is before any read could show its effect. So a project snapshot still lists the id, answered `left: "no"`. Undoing that needs a hook in `site-reset/project-ledger.ts`, which I do not own.
- **A press named under `undoes`** keeps today's admission path (`claim`, `target`, `ran`) unchanged and is never paired.
- **Goal 3** is `reads()` in `F/reset-undo/claims.ts`. A list the act already named still attaches. For an act whose change showed on its own page (`place.location`), only a list read at that location attaches. Otherwise a list read on the same resource attaches, and an act with neither attaches as before (office r2). In the web domain a resource is the whole tab (`webResetResource`), so before this change any list read in the same tab could attach. That was the mvrj-6916 act-15 case.
- **Goal 4** is `F/reset-undo/undoes-tool.ts`. The description now says "Optional hint ...; Core pairs an undo with its act by its effect: a press that puts back exactly what an act changed, at the same place, counts as that act's undo without this key. Name the act to remove what it created without asking." The wording is generic.

## Tests

- New: `F/reset-undo/tests/claims-inverse.test.ts`. The fixture is a lending library, one tab, opaque tokens. It has 9 tests:
  - Pairing by control counts. Includes an equivalence check against the same press named under `undoes` (same `exploredActs`, `standing`, `beforeTrial`).
  - Another control on the act's page gives no pairing.
  - The CC4 effect record pairs across pages.
  - An `irreversible` act is never paired.
  - `inverse` narrowing by action, by control, and by `toState` on counts.
  - A partial reverse, and an ambiguous match (two open acts), pair nothing.
  - The tolerant parse.
  - Goal 3: a list on another page of the same resource does not attach.
  - Goal 3: a list on another resource does not attach, and one on the act's own page does.
- Fail first: I reverted only the behaviour edits with the scratch script `t797pair/revert.py`, then restored the files byte for byte (checked with `cmp`):
  - **5 failed, 4 passed.** The failures were: the unhinted press recorded `act-2` (counts path, CC4 path, inverse); the effect parse gave `undefined`; the holds list was attached for the act on the loans page.
  - The 4 that passed are cases that should pair nothing, plus the another-resource case, which the old code already handled.
- Existing tests: none needed changing. Every test in `site-reset`, `reset-undo`, `reset-ledger`, `reset-settlement` and `reset-answers` passes unchanged. That includes `reset-undo/tests/claims.test.ts` (t772 w3) and the action-permissions tests in `F/tests`.

## Commands run and observed results

- `npx vitest run F/reset-undo/tests/claims-inverse.test.ts` (FLUXIQ_TEST_GROUP=parallel, under the lock): `Tests 9 passed (9)`.
  - The first run had 1 failure: my `toState` fixture named a place that no read reported. I changed the fixture, not the code.
- The same file against the reverted code: `Tests 5 failed | 4 passed (9)`. The files were then restored, and `cmp` showed them identical to my versions.
- `npx vitest run F/site-reset F/reset-undo F/reset-ledger F/reset-settlement F/reset-answers F/tests` (under the lock): `Test Files 2 failed | 59 passed (61)`, `Tests 5 failed | 954 passed (959)`.
  - Failing: `tests/site-reset-build.test.ts` (3) and `tests/site-reset-irreversible.test.ts` (2). Each shows `startedWith.cannotUndo` naming acts the test expects to be absent (for example act-1 "press Add").
  - With my behaviour changes reverted, the same 2 files gave the same `5 failed | 13 passed (18)`. So these failures are not from this change. My guess is another worker's in-flight cannotUndo default (the untracked `candidate/cannot-undo-default.ts`, `trial-gate.ts`). I did not fix them.
- `node scripts/build-cache/cli.mjs fluxiq:check` (from Core root, under the lock): exit 0 (`{"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq",...}`).
- `node scripts/structure-audit.mjs`: `passed (455 warning(s), 1152 baselined)`.
  - An earlier run flagged a statement-packing failure in my test (line 145). I fixed it.
  - New advisory warning: `site-reset/contracts.ts` is now 406 lines, past the 400-line advisory.

## Not verified

- No live or browser run; the web domain sends no `effect`.
- Pairing at a read that arrives after a trial: it decrements `recordedInPhase` assuming no trial ran in between. `placedCall` always reads right after the press, so this should hold.
- A paired press that left its page: `placedCall` calls neither `placed` nor `noEffect`, so its act's `undoChanged` stays unset. A press named under `undoes` gets `false` there.
- A trial act is never paired, by design.

## Open questions or contradictions found

1. `site-reset/start-check.ts` (not owned) drops `effect` from reads. The fix is a pass-through such as `...(read.effect !== undefined ? { effect: read.effect } : {})` in its read builder (around line 146). Without it, a domain fill of CC4 has no effect.
2. A paired press keeps its `act-N` id and its project sink entry, answered not left. Removing it completely needs a retract hook in `site-reset/project-ledger.ts` (not owned).
3. Goal 3 does what the plan line says: on the act's own page. The case the brief describes (a list on another resource) already held before this change. The real hole was a list on another page in the same tab. A create effect whose change does not show on its own page (no `place`) can still be named on the same resource, so the debug's sound act-16 case is kept.
4. Pairing by replaced values (`place.values`, from/to per value place) would cover the mvrj-6916 reloading-choice shape without any web change. The brief limited the fallback to control counts, so I left it out.
