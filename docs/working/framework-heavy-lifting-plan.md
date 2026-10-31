# Framework Heavy-Lifting Plan

Status: Active
Status detail: P9 Core narrow gates accepted; paired proof found missing original-call reference ownership, correction underway. Full/paid held.
Created: 2026-10-28
Last updated: 2026-10-31
Owner: framework-heavy-lifting sub-supervisor (for the lead supervisor)
Scope: Where FluxIQ Core and the web domain can compute or enforce what the build model now has to get right: membership/bounds, judging, undo/reset bookkeeping, handler conditions, toggle state, stable targets, dedupe, paging, and per-call workload.
Paired document: ../!FluxIQ/docs/working/framework-heavy-lifting-plan.md
Related: [language-driven-flow-loop-plan](language-driven-flow-loop-plan.md), debug notes in `language-driven-flow-loop-plan/debugs/`

## Current State

**Active t830, 2026-10-31:** Private paired P9 Core0.23 parent-sync tests202/13, types73.544s and audit pass; private SDK built83.292s and public accessor/no-private-export smoke passes with0dispatch. Core owning corrected111/6 and legacy-loop370/27 pass; fresh SDK Down191tests188pass/3fail: two new paired tests expose missing referenceNow on ordinary original calls (actual main and permission pass, no capture published), plus one replay fixture expected1 attempt despite mandatory4. Producer optional-value type guard and exact4/original-target replay assertions corrected, source frozen. Paired proof keeps actual Native/Gate/adapter/receipts and full oracles; Core capture-boundary timestamp ownership correction underway, no fixture-only timestamp. Down typecheck rerunning; paired acceptance/browser still outstanding. D1 removes31 old cycle allowances614to583. P10 t831 shipped dev69dcecba/c084b96a; Core task merged parent and backed up57baf3ab, Down parent sync follows accepted source. No full/paid/model calls or user panel management.

- Changes: neutral private assessment/veto scope, trusted primary effect proof, explicit original[]/closed controls, fresh producer receipt main accounting, no raw private errors, terminal list-guard loss; normal permission behavior preserved.
- Validation: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/prior-nodes/tests src/programs/automation-studio/runtime/llm/rerun-provenance/tests/settled-safety.test.ts --maxWorkers=2 --minWorkers=1` ->111tests/6files pass44.38s; `pnpm.cmd --filter fluxiq check` ->exit0,59.177s; `node scripts/structure-audit.mjs` ->exit0. Prior414selection412pass,2malformed fixtures corrected without production weakening; exact commands/logs in lead-acceptance.md.
- Outcome: Partial; Core owning accepted narrowly, existing loop regressions/parent sync/freshSDK/paired Domain/browser proof still required. No batch release yet.
- Follow-up: preserve P10 main changes when syncing both task branches; advance next Core0.23, rerun relevant compatibility checks, then actual paired adapter and installed realistic browser acceptance.

## Open Questions

1. **Are `values` and `differs` filled for a non-list region, such as a cart drawn with div elements?** Owner: W3. This
   was taken from the mvswhobv run note and not checked in `LE/start-state/`. It is the premise of Core P3's region witness.
2. **Tab and resource identity.** `resetResource` is a session plus tab identity, so an item opened in a new tab makes
   earlier references unusable. Should witnesses key on the resource across tabs, or should Core carry the resource
   between tabs? Owner: W3, with Core Lane B.
3. **Place token per act.** Does `LE/control-spot/place.ts` embed the page address for a looped act? If so, fix it here
   or let Core compare by one place per act (Core P4). Owner: W4. The mvrj-a44a chain was inferred with no ledger trace.
4. **Stateful controls whose state lives in words or a class.** Can they be known before the first press, or only
   after one press of the same kind of control? Owner: W6. If only after, CC9 is filled late, and Core keeps
   `ensureState` from trial presses.
5. **Which languages does the intent classifier (CC11) cover first?** Owner: W10. Absent intent never refuses in Core,
   so coverage can grow over time.
6. **Can the list packet carry per-item values for every field?** Core P7's discriminating-field note needs them.
   Owner: W7.
7. **Does `extractList` honour a `done when` end marker as the read's bound?** (mvskodlp F4; not verified.) Owner: W7.
