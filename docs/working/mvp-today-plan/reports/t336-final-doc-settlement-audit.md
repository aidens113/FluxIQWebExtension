# t336 — Final documentation settlement audit

## Decision

**GO to proceed to the run-4 settled-tree identity/diff gate.** The active plans, semantic archive, and generated working-document index are settled consistently enough to freeze documentation for identity capture.

This is not a GO to create `pending-t331-run-4.md`, run the provider-free dry-run, or contact the provider. T334's next gate remains the fresh downstream/Core identity and validation-reuse audit.

The supplied observations that `structure:baseline --rule working-docs` and `structure:check` passed are accepted as validation facts for this audit; I did not rerun them.

## Settlement matrix

| Area | Status | Finding |
| --- | --- | --- |
| MVP plan header | **GO** | Status detail identifies run 3 as latest, Stage 2/no Flow, one unchanged retry, locally complete but live-unproven repair path, and streak 0. Updated date is 2026-09-27. |
| MVP Current State | **GO** | Run-3 terminal code/stage/issue, overlapping accounting boundary, absence of later-stage evidence, t217 live validation, one-retry disposition, and remaining MVP criteria agree with t325–t334. Local/readiness evidence is not promoted to live proof. |
| MVP Active Order | **GO; t334 contradiction cleared** | Identity/reuse is now item 2 and precedes run-4 Stage 1 at item 3. This matches t327/t332/t334. Compaction/index settlement remains item 1 historically but is now evidenced by the archive/index changes and supplied structure passes. |
| MVP ledger | **GO** | Run 3 is an accepted failed product measurement with streak 0 and correct follow-up. The new compaction entry uses `Accepted semantic/structural compaction`, records all 76 briefs/688 normalized lines, and explicitly denies unavailable exact pre-cut byte fidelity. |
| Loop plan header/Current State | **GO** | Header and latest-measurement block match run 3; 26 decisions/21 tool calls/no proposal and non-additive accounting are preserved. It retains the live-unproven repair/replay boundary and one-retry stop rule. |
| Loop ledger | **GO** | Readiness remains local evidence; run 3 remains an accepted Stage-2 product failure; no Flow/later-stage/pass credit is invented. The follow-up is the single unchanged retry with stop-on-repeat. |
| Archive introduction | **GO with explicit fidelity limit** | It identifies t219–t311, links back to the active MVP plan and earlier archive, explains the unsafe pre-cut reader, and says byte-for-byte fidelity to the unavailable snapshot is not claimed. This is faithful to t330. |
| Archive markers/endpoints | **GO** | Exactly one ordered `BEGIN RECOVERED t219-t311` / `END RECOVERED t219-t311` pair surrounds the payload. The first brief is t219 and the last is t311; the archive reports 688 normalized payload lines. |
| README regeneration | **GO** | The diff changes only the two expected active-plan rows: language-loop count 698→720, and MVP count/scope/paired text 359→264 plus current header metadata. Links and displayed counts match the current files. |
| Privacy | **GO** | The reviewed surfaces contain plan/run identifiers, closed codes, aggregate sanitized accounting, task briefs, and a documentation-payload digest only. No credential, token, provider response, page/record content, selector, cookie, authorization material, browser state, raw error/log, or test-run artifact content appears. |

## Line-budget status

| Document | Current State | Limit | Whole document | Limit | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `mvp-today-plan.md` | 81 lines | fewer than 150 | 264 lines | fewer than 800 | **GO** |
| `language-driven-flow-loop-plan.md` | 147 lines | fewer than 150 | 720 lines | fewer than 800 | **GO, only 3 Current-State lines remain** |

The language-loop plan is valid but at its Current-State boundary. Do not append run 4 there without first compacting superseded historical material or replacing existing current-state text. The MVP plan has ample document headroom.

## Ledger and factual consistency

- Both headers, Current States, and ledgers agree that `run-mujd550n-e8fbe7aa` is the latest accepted failed measurement and the pass streak is 0.
- Run 3 is consistently Stage 2, before proposal, with `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`; no runtime, oracle, judgement, repair, persistence, replay, or terminal-revocation evidence is claimed.
- Build/observed accounting stays one representation; no repair/verification bucket is fabricated.
- Run 2 remains historical live proof of creation/runtime/comparison/judgement/recovery routing, not the latest result.
- The post-run-2 repair/grant-continuation implementation remains local validation only.
- The retry disposition is identical across the active documents: one unchanged attempt; a repeat of the same accepted Stage-2 exhaustion ends unchanged retries; a pass begins the streak at 1 only.
- Historical ledger statements that t217 was then unmeasured remain properly dated; current entries state that run 3 measured terminal preservation live.

## Link and index status

- `docs/working/README.md` links to both active plans and now reports their exact current line counts and header-derived scope/pairing text.
- The MVP plan links to the language-loop plan, reports directory, earlier coordination archive, and—under Worker Briefs—the new run-2-through-run-3 archive.
- The new archive links back to the active MVP plan and laterally to the earlier coordination archive.
- The loop plan links back to the MVP plan as the owner of the binding product rules and ordered path.
- The README diff has no unrelated plan-row churn; the changes correspond exactly to the two documents changed by settlement.

The supplied working-document baseline and structure-check passes corroborate line/index/link structure. They are documentation validation, not product build/test evidence.

## Archive fidelity disposition

The archive is suitable as the semantic/structural memory channel. T330 established 76 ordered, structurally complete brief blocks, valid UTF-8, exact endpoints, and clean normalized formatting. Exact byte equality to the unavailable pre-compaction source cannot be proved because the initial Windows PowerShell read was not UTF-8-safe and no exact pre-cut snapshot survived.

The settled documents now state that limitation truthfully:

- the archive introduction says byte-for-byte fidelity is not claimed;
- the MVP ledger calls the result semantic/structural compaction;
- the ledger records the normalized measurement while explicitly denying exact pre-cut fidelity.

There is no remaining fidelity contradiction. Do not later relabel this payload “verbatim” or “lossless” without the exact-source recovery procedure in t330.

## Privacy status

The compaction moved coordination briefs, not run artifacts. The marker payload describes task scope, ownership, required reads, prohibited surfaces, completion conditions, and report paths. The archive/index/plan surfaces reviewed here do not expose raw live evidence or secret material. The recorded SHA-256 is a documentation-payload integrity value, not an artifact/credential value; it does not authorize printing run-artifact hashes during later privacy-gated inspection.

Run-4 privacy remains governed separately by t266/t332/t334: no artifact read before integrity/identity/redaction gates, no raw stdout/stderr disclosure, and only bounded indexed semantic evidence afterward.

## Run-4 identity-gate boundary

Documentation settlement now clears t334's pre-identity blockers:

1. t329 correction is reflected in the accepted run-3 state;
2. both plans state run 3 accurately;
3. Active Order now puts identity before Stage 1;
4. compaction is linked and truthfully limited;
5. README regeneration matches current files; and
6. the supplied working-doc structure gates passed.

**Next safe action:** freeze shared-document edits and capture the exact downstream branch/HEAD, Core pairing/HEAD, and validation-relevant dirty scope. Prove that intervening changes are documentation-only before accepting prior tests/build/freshness as reusable. Any source/config/dependency/generated-runtime drift sends the work back through the affected validation/build/freshness closure.

Only after that identity/reuse gate is GO may the supervisor assert the `pending-t331-run-4.md` path is unused and create/attest Stage 1. Point-in-time machine, zero-provider dry-run, authorization, second machine, and privacy/capture gates still follow before provider contact.

## Scope

Read both active plans' headers, Current State, available Active Order, and ledgers; the new archive introduction/markers; the `docs/working/README.md` diff; and reports t330, t333, and t334. I did not open `test-runs` or run artifacts; did not run structure baseline/check, tests, builds, dry runs, process scans, browser/live/provider commands; and did not edit shared documents. This report is the only change.
