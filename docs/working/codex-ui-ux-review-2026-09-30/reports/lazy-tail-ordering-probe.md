# Lazy-tail callback ordering probe

Status: Complete ? test-only probe frozen; supervisor contract review pending
Owner: recording_controls
Date: 2026-10-01

## Written brief

- Root read full lazy-tail-ordering-probe-plan.md and actual list-wait/store fixture. Corrected extension types1691/build11533 CLOSED native0; structure12361 native0. Original full failure remains unresolved. TEST-ONLY source release NOW.
- Exact NEW path apps/extension/src/content/extraction/tests/list-wait-ordering.test.ts plus this own report. Every production/shared fixture/original test path stays frozen. No source fix pre-authorized.
- Implement approved descriptor-safe local fake clock/timer queue calling actual awaitPageComplete and genuine storePage2. Preserve600ms loader/50ms poll/900ms growth/30000ms command/500ms deadline/low-demand controls. Restore descriptors/page and observe every promise; no global fixture edit.
- Measure hostile older-poll-first then due loader at same950 vs explicit loader-first perturbation, normal delivery and deadline/no-growth/low-demand boundaries. Report actual traces and scheduled-vs-delivered timestamps. Don't assert arbitrary future sixteen-row or queued-turn requirements until root reviews causal evidence.
- Heavy exact NEW test and actual-config one-root strict including dependency diagnostics; external disposable harness only. No duplicate original/full gate, timer/timeout/assertion/compiler/baseline relaxation, source mocks or copied subject.
- Write progressive actual results and proof limits; freeze NEW test after evidence. No shared docs/commits/broad/live/browser/Lab/provider/panel/private operations. Root decides supported observation contract and any subsequent regression/fix release.

## Released test-only implementation

NEW owning test calls actual awaitPageComplete and real storePage2. Local descriptor-safe clock preserves600/50/900 and records scheduled/delivered timestamps, actual card IDs and Promise settlement. Eight cases cover normal delivery, two hostile/same-clock orders,500 deadline,900 undelivered-loader window, low demand and900/901 boundary. Hostile outcomes are measured diagnostics, not arbitrary future16/queued-turn assertions. External disposable focused/scoped harnesses prepared; product/shared fixtures/original tests untouched.

## Observed execution and source freeze

Heavy NEW owning suite: native0,8/8 passed,277.9803ms. Actual-config one-root strict typing: native0,0 owned/global diagnostics,0 dependency diagnostics. External disposable harnesses TEMP/codex-t224-lazy-tail-ordering-focused.mjs and codex-t224-lazy-tail-ordering-scoped-types.mjs. NEW test is FROZEN; product/shared fixtures/original tests were not modified. Eight passing cases mean characterization completed with integrity controls; they do NOT mean the missing-tail defect is fixed or prescribe a production contract.

Actual results, using production awaitPageComplete plus storePage2:

| Schedule | Scheduled eligibility | Actual delivery/observation | Current return/row count at settlement |
| --- | --- | --- | --- |
| Normal chronological delivery | loader600; polls50 increments | loader then poll at600 | complete,16 at600 |
| Older poll first, overdue | poll50 and loader600 both due | poll at950; Promise continuation BEFORE loader at same950 | complete,12; loader remains due/pending at completion |
| Loader first perturbation | same poll50/loader600 | loader at950 first; still pending until poll at950 | complete,16 at950 |
| Command cutoff500 | loader600; polls50 | polls through500, loader still future | timed_out,12 at500 |
| Undelivered loader through growth window | loader600 deliberately remains queued |18 actual50ms polls through900 | complete,12 at900 with loader eligible/pending |
| Demand10 below eager12 | no reveal timer | immediate clock0 | complete,12; scrolls0/timers0 |
| Deadline900 overdue negative poll | loader600; poll50 | poll950 before loader950 | timed_out,12 at950 |
| Deadline901 overdue negative poll | loader600; poll50 | poll950 before loader950 | complete,12 at950 although absolute901 elapsed |

In poll-first950 case, diagnostic after FIRST macrotask is settled=true/complete with actual2-1..2-12 and pending eligible timer{id1,due600}. Delivering loader at SAME950 subsequently publishes2-13..2-16 but cannot revise the already-settled completion. Loader-first950 comparison remains explicitly a controlled order perturbation rather than a claim about native scheduler ordering. Same-clock delivery difference is reproduced against actual source; it is not merely inferred from comments.

The900/901 boundary is independently observed: waitUntil chooses commandEndsFirst when deadline<=windowEnd900. At observation950 with no growth, deadline900 returns timed_out; deadline901 returns unchanged/complete because the growth window was selected first at construction. This is a source behavior fact for contract review, not a new action deadline policy or fix claim. No full extractList result/count/next-page summary is fabricated by this page-completion probe.

Integrity: each case verifies genuine600ms fixture, captures actual callbacks, observes all operation Promises, records scheduled versus delivered timestamps, and restores Date.now plus all timer/DOM descriptors exactly in finally. Current deadline control discards its remaining local future loader on cleanup; no native callback escapes the fake queue. No original harness, source mock, copied wait algorithm, timer constant,48-row assertion,30000ms bound or500ms deadline was changed.

Proof and next decision: controlled hostile older-poll-first delivery reproduces complete-before-ready-loader behavior; it does not establish that this precise callback trace caused the full4.408s/page2 failure. Root must choose supported observation/deadline contract and separately authorize any durable failing regression/product change. Candidate queued-turn logic remains HELD. Unchanged root original6/6 narrow pass and full failure remain separate evidence. No machine cause, browser certification, binding causality or broad-pass claim is made.

Only NEW content/extraction/tests/list-wait-ordering.test.ts and this report were authored. No production/shared fixture/original test/shared docs/commit/push/private/live/Core/broad operations. Ready for independent root review with exact schedule diagnostics in owning TAP output.
