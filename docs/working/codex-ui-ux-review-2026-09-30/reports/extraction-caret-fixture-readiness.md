# Extraction caret fixture readiness

Status: Complete
Owner: runtime_contracts
Date: 2026-10-01

## Written bounded brief

- ProjectTree exact source/test/report remain FROZEN Complete. READ-ONLY preparation for held caret fix; extension source/test stays frozen during root recursive types63587. No new code release.
- Read exact downstream panel/extraction/dialog-focus.ts, tests/dialog-focus.test.ts and tests/dialog-dom.ts, plus completed extraction-preview-accessibility-audit.md partition B. Parent Current State gives isolated t224/Claude ownership. No other controller/background/browser/private state traversal.
- Establish whether the existing public fake DOM can faithfully prove original control versus neighboring/initial/different-control selection ownership and restore real global descriptors/selection calls. Do not copy production focus logic or weaken old assertions.
- Produce an executable fixture plan for exact future dialog-focus.ts +NEW tests/dialog-focus-selection.test.ts: same-control caret preservation, next/previous/initial fallback focus without inherited selection, disabled/hidden original replacement fallback, deliberate focus movement and document visibility/focus gates. Distinguish setter-call ownership from coincidental clamped cursor values.
- Name any missing tiny helper seam and a NEW test-local solution; existing helper/source/tests stay unchanged. At most three source/test reads already named; no execution/check/test-writing/private data.
- Own this report only progressively, freeze when complete. No shared docs/commits/source/tests/config/baseline/broad/live/browser/Lab/provider/panel operations. Root owns implementation release after current gates close.

## Read-only fixture inspection progress

Read exact dialog-focus.ts, existing tests/dialog-focus.test.ts, tests/dialog-dom.ts and completed accessibility audit partition B; no fourth source/test/helper body or controller/background/private traversal. Current State isolation/Claude boundary already known from preceding released unit, and root explicitly reports extension recursive types63587 active. Product/tests/checks remain frozen.

Existing withDialogDom provides owner-document real activeElement transitions, per-control connectivity/hidden/inert/disabled eligibility, field selector/dataset identity, removal-to-body focus loss, setSelectionRange and focusCalls. Its global setup preserves actual property descriptors and restores them in finally; no shared helper edit is needed. Instance-local setter wrapping can capture exact target/call arguments and delegate to its existing method, then restore original own descriptor/delete temporary override in finally. Setter ownership, not cursor equality, is the required proof.

## Confirmed source sequence and same-control policy

render captures active control, whether it belongs to opened panel with owned document focus, enclosing extraction-field key/order and selection tuple. After work it refuses repair when focus was deliberately moved to another non-body control, when document ownership was lost, or when the original active control remains enabled. For a removed control it seeks same field key and existing tagName/className (radio value) equivalence; otherwise chooses next surviving field label, previous label or hooks.initial. Existing final setter does not distinguish those paths, so numeric captured selection is written to any text-like INPUT fallback.

Future narrow algorithm should record successful original-control match separately from the chosen focus target. Caret delegation requires that matched original equivalent is enabled/visible and is the actual recovery target, with text-like supported selection type. If an equivalent candidate is disabled/hidden and then replaced by hooks.initial, a stale match flag must not authorize its initial-control setter. Preserve existing matching equivalence and radio value predicate, neighbor order, initial fallback and deliberate focus/visibility guards; no broader focus algorithm is needed.

The original enabled-control return must remain a no-op, preserving its existing caret without setter/focus replay. Initial fallback is currently selected directly when a found same-control candidate is disabled/hidden, rather than trying a neighbor next; tests should preserve this actual policy, not invent different recovery behavior.

## Executable future fixture plan: exact two paths

Future edit partition remains apps/extension/src/panel/extraction/dialog-focus.ts + NEW tests/dialog-focus-selection.test.ts. Existing dialog-focus.test.ts and dialog-dom.ts unchanged, no new exported helper/type/global API. Root must explicitly release source/tests/checks after types63587 closes; readiness is read-only.

New test-local setup uses inferred public world type (`Parameters<Parameters<typeof withDialogDom>[0]>[0]`), creates native-shaped text inputs through world.document.createElement, sets type=text, explicit className, row.className=extraction-field and row.dataset.field stable synthetic keys. Build opener + initial text input + rows inside panel, then host.append; actual createExtractionDialogFocus with hooks returning world.native elements. Open actual dialog, focus chosen original text input, and set original start/end/direction properties directly before attaching/resetting setter observation. No clone of focus/candidate/render logic and no global prototype replacement.

Observe every potentially chosen input's setSelectionRange by a NEW test-local instance wrapper: capture original own descriptor and bound existing implementation, log target/start/end/direction, delegate to the existing setter, then restore descriptor or delete own override in finally. This records both forbidden attempted selection transfer and real same-control preservation. Distinct per-control before-ranges/selection direction and sufficiently long synthetic values make intent readable, but assertions must inspect call ownership even when before values deliberately equal original values. Fake setter does not implement native clamping, so numerical final equality alone is never proof.

Each case closes actual dialog in finally before leaving withDialogDom (including failing assertion/hidden document), so listeners/observer/inert ownership are cleaned independently of global restoration. Shared withDialogDom already clears timers/restores document/MutationObserver/chrome/setInterval/clearInterval exact descriptors in finally. A test can snapshot those descriptors before/after invoking it and compare value/get/set/configurable/enumerable/writable identity; add a deliberately thrown synthetic body and assert restored descriptors using assert.rejects rather than leaking or replacing globals. Do not alter existing fixture, introduce global shared state or weaken original tests. Instance instrumentation teardown restores only test-created nodes.

## Meaningful cases and expected public outcomes

1. Same field and equivalent original text-control replacement: render work removes old control and inserts new same tag/class in same field key; active removal goes to body. Recovery focuses replacement with preventScroll and exactly that replacement's setter receives original start/end/backward direction once. Initial and neighbor setters receive zero calls.
2. Remove original row A while B survives after it: replacement focus lands on B label by existing next-row policy; zero setter calls on B/initial/all candidates, and B's original range/direction remain untouched. Add equal-sentinel selection variant so matching cursor values cannot falsely pass while setter ownership is wrong.
3. Remove final row B while earlier A survives: previous label receives focus without setter call or inherited selection. Keep stable field order and no changes to production neighbor search.
4. Remove all rows: focus hooks.initial text input without selection setter, retaining initial's own selection. Current code should fail ownership despite a coincidentally clamped/equal range; do not assert merely activeElement.
5. Same row key remains but equivalent control absent (different className/control kind): fallback target may be initial text input; it receives focus but zero setter calls. A different input in the same row is still a different control, not an authorized match.
6. Same-key/tag/class replacement exists but is disabled; repeat with hidden replacement/hidden ancestor. Existing algorithm chooses eligible initial control; replacement and initial selection logs remain empty. Record disabled/hidden attributes with helper's actual public semantics, not unsupported CSS-display tricks.
7. Original remains connected/enabled after redraw: no extra focus/selection setter; original selection remains untouched. Ordinary non-focus redraw compatibility stays stable.
8. Work deliberately focuses a different enabled control inside panel: preserve it with no follow-up focus or selection setters. Do not simulate forbidden outside focus through inert host; internal explicit focus movement exercises the actual production early return.
9. Document focused=false or visibilityState=hidden before render: work still executes, no focus or selection delegation. Repeat ownership loss DURING work after inside capture so post-work guard is exercised. Assert no extra world.document.focusCalls and zero setter logs.
10. Closed dialog render does not acquire focus or selection. Existing open/close/inert/Tab/Escape/IME/listener assertions in unchanged owning suite remain required, not copied or replaced.

Potential extra compatibility: radio/control identity remains exactly original predicate; new caret suite should not invent text-like numeric selection for radio/select/number controls, since DialogElement supplies numeric default selection to all tags whereas real unsupported input types return null/undefined. Restrict caret sources to explicit supported text-like inputs and set null selection if an unsupported control is deliberately tested.

## Missing seam assessment and verification limits

No missing production or shared test helper seam. Public instance method interception in NEW suite is sufficient; no helper export, class duplication, selector/focus algorithm copying, configuration/baseline/timeout change required. Existing fake getClientRects models connection/hidden only, not full browser layout/CSS/selection clamping/IME or real document focus transfer; document.hasFocus and visibility are controlled flags. Prove setter call ownership +actual helper public activeElement/focusCalls outcomes, then state these limits rather than claiming native caret/browser certification.

Read-only readiness Complete. Only this own report edited; no source/test writes, tests/types/build/check commands, broad/live/browser/Lab/provider/panel/private/backend operations or commits. Three exact source/test files plus written audit partition B read. Extension types63587 outcome not assumed; root owns later release and independent validation. Previous ProjectTree/Ask/Core failure source and reports remain frozen.
