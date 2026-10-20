# Report: t743-c1-settlement (S1 adoption, S2 gate_unsatisfiable, S4 photo; Core site-reset ledger)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime/`.
No commits, no branch switches, no typecheck/build/full suite.

## Outcome

Partial. Tasks 0 to 4 are implemented and tested. Everything I own passes, the prompt contract test passes, and the Core audit passes. Two tests in `R/service/project-build/tests/` fail; I don't own them. Both fail because of the intended rule changes (details below), and the lead must update them.

## What changed and why

**0. Room made.**
- The eight `site-reset/settlement-*.ts` modules moved to the new `R/flow-bootstrap/reset-settlement/` with the prefix stripped: act-groups, control-tracker, decision, group-witness, observations, toggle-witness, transfer-witness, trial-repeat, words. Export names are unchanged. `collection-groups.ts` moved with them, since the observations need it as a value.
- Dependency runs one way: reset-settlement imports nothing from site-reset, not even types.
  - The settlement modules read structural local types instead: `reset-settlement/spot.ts` (`AutomationStudioSiteResetSettlementSpot`) and `AutomationStudioSiteResetCollection` in `collection-groups.ts`.
  - `contracts.ts` `Read.collections` now uses that collection type.
  - The `undoes` key moved to `reset-settlement/undoes-key.ts`.
- `site-reset/index.ts` re-exports `../reset-settlement/index.ts`, so every external importer is unchanged.
- The settlement judgement moved to `reset-settlement/judge.ts` (`AutomationStudioSiteResetSettlementJudge`). It holds evaluate, groupsOf, the toggle fill, settle words, lookFirst's choice of places, the narrowed adoption, and the unmet check. Its ledger header paragraphs moved with it.
- The ledger was still at 753 lines after that. So the undo side (claim, target, and recording an undo or a look under `undoes`) moved to `site-reset/undo-claims.ts`, again with its t475/t479 header paragraphs. The `Act` record moved to `site-reset/ledger-act.ts` because both files use it.
- Result: `ledger.ts` is 604 lines (was 776) with 29 methods (was 33). The audit now reports 29.
- `settlement-witnesses.test.ts` moved to `reset-settlement/tests/witnesses.test.ts`.

**1. Unreachable lists (photo).**
- `reset-settlement/reach.ts` is a build-wide store of lost groups. The project ledger shares one store across every brief's ledger (`reach` option).
- How a group is lost:
  - The judge's `lookFirst` counts reads that reach its ledger while each `lookAt` runs.
  - If the look landed (a read arrived) and a group look reason at that location is still stale or incomplete, the group is lost at once.
  - If the look answered unread, the group is lost after two separate pre-trial checks of that ledger.
- `decision.ts` treats a lost group that is stale or incomplete as never a `look` again.
  - If another witness holds, the act settles `restored` (when a change was seen or an undo landed), otherwise `unchanged`. The settlement carries `unread: [refs]`.
  - If lost groups are the act's only witnesses, it is open with the new reason `unreachable`. Its words say no call can settle it.
  - A lost group that is read fresh is judged as usual.
- The ledger keeps `unread` on the act. `beforeTrial` lists such acts under `startedWith.cannotUndo` with `WORDS.settledAs(how, unread)`, for example "put back as far as fresh complete reads can show; the list named for it (destination-1) could not be read again ...".
- `standing()` now reports such an act `restored`.

**2. A1 narrowed (office).** A witnessless trial or entry act now adopts only:
- issued lists named as a destination by any act of this ledger or any explored act of the build (`buildExplored`);
- issued lists whose read location equals the act's page location. The new `Act.pageLocation` comes from the trial step's `controls.location`, or the tracker's location of `controls.page`.
- Lost groups are dropped.

When nothing is adoptable, the act is to `name` a list. Once refs are closed, `name` is unmet: always for a trial act, and for an explored act only when no ref was ever issued (the existing "cannot be settled" case). The downstream office spec's shape holds: Buy Now names the cart, so the cart is adopted.

**3. gate_unsatisfiable.**
- An open act whose every reason is unmet (`unreachable`, or `name` as above) leaves `inPlace`/`toUndo`.
- It is listed as `actsUnsettleable: [{act, did, call?, reason: "gate_unsatisfiable", failed}]` in every claim and target refusal that carries `actsToUndo` (target post-processes the admission's answer), in `trial_reset_unproved`, and in the trial policy.
- Trial policy:
  - With nothing in place but unsettleable acts, it refuses `candidate.trial_reset_required` with `failed: "acts_unsettleable"`, `canMeet: "no_call"`, `actsToUndo: []`, and `WORDS.unsettleable(false)`. That text is the honest exit: end the brief as blocked, naming those acts and `gate_unsatisfiable`.
  - With acts also in place, the `acts_in_place` refusal adds `actsUnsettleable` and appends `WORDS.unsettleable(true)`.
  - I kept the code `candidate.trial_reset_required` so the existing consumers (whole-trial, repeat guard) still route it.
- `project-reset.ts` merges `actsUnsettleable` across ledgers. A meetable refusal now leads, and the exit words are appended when the lead lacks them.
- New closed conditions in `reset-answers/{failed,condition-words}.ts`: `witness_unreachable`, `nothing_to_name`, `acts_unsettleable`.

**4. Public reads.**
- `ledger.unsatisfiable()`.
- `ledger.issuedRefs()`: issued refs with count and location.
- `project.unsatisfiable()`: build-wide, with `owner`.
- `project.issuedRefs()`.

**Tests.**
- New `site-reset/tests/settlement-unreachable.test.ts`:
  - photo toggle settles restored and the judge is told;
  - a group-only act is unsatisfiable, out of actsToUndo, and trials are refused with the exit;
  - unread twice loses the list;
  - a fresh read behaves as today;
  - a lost list is lost build-wide across briefs.
- New `site-reset/tests/project-ledger-adoption.test.ts`, a two-brief project with project reset:
  - a finder list nobody named is not adopted, and Core looks only at the named shelf;
  - an adopted list read unread twice is dropped and the named list settles the act;
  - with nothing adoptable the act is `name` while refs can still be issued, and `nothing_to_name` once none can;
  - `issuedRefs` carries locations.
- New `reset-settlement/tests/unreachable.test.ts` covers the pure decision and the reach store.
- Existing tests updated to the new rules:
  - settlement-adopted, settlement-shapes E, F and invariants, project-ledger-repeats and project-ledger-entry-repeats now use a step page location or a named list;
  - acts in fixtures that vouch no list are now asserted as `unsatisfiable`;
  - refusal-sites now also scans `reset-settlement/`.

## Changes outside my Owns list

- `site-reset/settlement-observations.ts` is now a type-only forwarder. `undo-admission.ts`, which I do not own, imports the observations type from that path. **Lead: point that import at `../reset-settlement/index.ts` and delete the forwarder.**
- `contracts.ts` re-exports `AUTOMATION_STUDIO_SITE_RESET_UNDOES_KEY` from the reset-settlement barrel. The reason is that `flow-bootstrap/action-permissions.ts`, which I do not own, imports it directly from `site-reset/contracts.ts`. Without the re-export the key is undefined at run time and every undo claim is skipped; I saw this as nine site-reset-calls tests failing. The audit shows no cycle.

## Commands run and observed results

- `pnpm exec vitest run --maxWorkers=2 --minWorkers=1` over site-reset, reset-settlement, reset-answers, `R/flow-bootstrap/tests`, `R/service/project-build/tests`, `R/project-agents/dispatch/tests` and `R/llm/deepseek/tests/system-prompt.test.ts`: `Test Files 2 failed | 85 passed (87)`, `Tests 2 failed | 748 passed (750)`. My three directories alone: `Test Files 26 passed (26)`, `Tests 314 passed (314)`.
- Prompt contract test: `system-prompt.test.ts (39 tests)` passed. No pin moved.
- `node scripts/structure-audit.mjs` (Core root): `passed (428 warning(s), 1152 baselined)`, plus "1 baseline entries can be lowered". I did not run `pnpm structure:baseline`; the baseline is not mine.
- Mutation check: with `reach.lost` removed from the landed path and the own-page match forced true, 6 of the 9 new ledger tests failed. Restored afterwards.

The two failures, both outside my files, both intended effects:

1. `project-build-reset-settle.test.ts:187` ("tell the reset only the acts still open ..."). Act-3 is a trial step with no page location. Its only adoptable list is `p:items`, which act-1 named and which holds. The moved shelf was named by nobody, so it is no longer adopted. Act-3 now settles `unchanged`, and `inPlace().find(act-3)` is undefined. Fix: give act-3's step `controls: { page: "p:list-page", location: "loc:list", ... }` so the shelf is adopted as an own-page list, or have an act name the shelf.
2. `project-build-reset.test.ts:757` ("whole-trial collection authority ..."). The fixture's reads carry no `resource`, so no ref can ever be issued (refs are closed vacuously). The witnessless trial create is now `gate_unsatisfiable` (`nothing_to_name`): still on the site and still refusing trials, but in `unsatisfiable()` rather than `inPlace()`. Fix: assert on `[...inPlace(), ...unsatisfiable()]`.

## Not verified

- No typecheck was run, as the brief forbids it. I reviewed types by hand for `exactOptionalPropertyTypes` and `verbatimModuleSyntax`; vitest does not check types. One point to watch: the site-reset barrel's `export *` of both `contracts.ts` (re-export) and the reset-settlement barrel exposes the same binding twice. It works at run time, and TypeScript should accept it as the same symbol, but that is unconfirmed.
- No live or browser run. The downstream `office-address-confirm.spec.ts` was not run. I checked its shape by reading it: the cart is adopted through Buy Now's named ref.
- Project snapshot `inPlace` is now false for unsettleable acts, because it derives from `inPlace()`. Consumers that read it are not wired to `unsatisfiable()` yet: `reset-done`, `run-brief` `remainingActs`, `left-on-target`, `whole-trial`, `brief-ports`, `phase-start`, `reset-calls`. That wiring is the lead's.

## Open questions or contradictions found

- The brief's own-files rule versus the two imports from non-owned files, handled with the forwarder and the re-export described above.
- "Refs closed" includes the vacuous case where nothing was ever read complete (no originals). There, every witnessless act becomes `gate_unsatisfiable`, as the existing "cannot be settled in this build" words already said. Fixtures without `resource` hit this.
