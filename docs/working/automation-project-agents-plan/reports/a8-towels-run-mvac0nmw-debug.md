# A8 frozen pair 6: towels, project run `run-mvac0nmw-52ed30b2` (read-only debug)

Pair 6 is downstream `49b65bc9` and Core `4e51c1da`, with t652 to t655 in. The task
is `bigbox-retail-pickup-towels` in `project` mode, lane `fxwork/t566`. The oracle
is `PICKUP_TOWEL_RECORDS` in
`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/expected-values.ts`: nine
rows. The run ended `lab.chat_build_failed`, $0.19 of $0.25, 178 steps, in 21
minutes (02:11:50 to 02:33:05).

## Outcome

Done. This was a diagnosis only, and no source changed.

**The build had the exact answer at step 0071 and then threw it away.**

1. Brief 1 built `find_products`. At step 0071 its revision 6 stored the 9
   oracle rows, with the right names, order and values, and both judges said yes
   (0072, 0073). It had cost $0.0755.
2. At step 0010 Core warned that the plan's second subflow, `build_table`, only
   reshapes rows the first one reads (`project.plan_subflow_reshape_only`). The
   warning said to fold it into `find_products`. At 0011 the supervisor
   dispatched it anyway.
3. `build_table` came back blocked: it never reads its input (brief 2, $0.0145).
4. At 0088 the supervisor did what the step-0010 warning had said. It moved part
   p2 (the table columns) into `find_products` and renamed that subflow's output
   from `products` to `table`.
5. At 0089 Core then dropped `find_products`' judged-yes proposal, because "its
   inputs or outputs changed" and "its parts changed". Yet revision 6 already
   stored exactly the four columns p2 asks for.
6. Brief 3 rebuilt the subflow from scratch, with nothing from brief 1. It never
   converged, and two repair briefs ran out of allowance.

**The first point that cost the build** was step 0011: the supervisor dispatched
`build_table` against Core's correct warning. **The point that decided it** was
step 0089: Core discarded a judged-yes proposal over an amendment that changed
nothing that proposal does. **Both causes are general.** The reshape-only split
recurs from t630 (wave 7, everything-store). Only the traps inside brief 3 are
task-specific.

**Why brief 3 never converged.** The causes stack. Most are general.

1. **The builder lost the pickup column (builder, general behaviour; the trap
   is task-specific).**
   - Brief 3's first submission (0107) read a `pickup` column and kept only
     `pickup contains "Pickup today"`.
   - It was refused for its block structure (0108), not for its content.
     Core's answer said "keep every other line as it is".
   - The rewrite at 0109 dropped the `pickup` field and condition, and leaned on
     the Speed "Today" facet. That is the scenario's trap: "Today" counts
     delivery too.
   - From then on, every trial kept the two "Pickup tomorrow" rows, Softerra
     Pick-A-Sheet 8 Triple and Northmere 12.
2. **Core's words kept the paper towel holder in (general, Core).** In trial 2
   (0122), one judge (0124) named the holder and the Northmere tomorrow row,
   both real defects.
   - **A false t515 mark.** Core marked the call's advice "excluding
     non-paper-towel items" as an exclusion the request never states, and asked
     it again (0125). The re-ask dropped the Northmere claim.
   - **A misparsed sentence.** Core then labelled 0125's reading wholly
     "contradicted by Core's record", because `missing-claim.ts` misread its
     sentence. It applied the sentence's "was left out" to a stored row the
     judge had called kept.
   - **Two wasted retests.** With `recordContradicts: "whole"`, Core advised a
     retest ("a change that contradicted reading asks for is not [the better
     move]"). The builder spent two more trials on revision 3 (0127, 0131).
3. **Core left a false reading about the sponsored test unchallenged (general,
   Core).** Judges 0124, 0129 and 0133 said condition 1, `sponsored is absent`,
   "drops qualifying packs".
   - In fact 4 of the 5 rows it left out alone were also in the result, and the
     fifth, Tidemark, Core had settled as showing "Sponsored".
   - Core did not label the claim. At 0127 it told the builder "Nothing in
     Core's record contradicts what kept this trial from a yes".
   - The kept-condition memory did not hold condition 1. Core accounts for a
     settled row by the request's words only for a positive text test, and
     `is absent` is not one, so the Tidemark row stayed unaccounted.
   - The builder dropped the sponsored test at 0134. That brought back Tidemark
     (sponsored) and broke the Best match order.
   - Both repair briefs started from trial 0127, whose unlabelled reading was
     exactly this one, and dropped it again.
4. **Money ran out.**
   - Brief 4's last trial (0168) ran the site and paid for one judge call
     ($0.0042), then could not afford the second call, so the trial was not
     judged.
   - Brief 5 stopped after two calls with $0.009 of its $0.0145 allowance unspent,
     because the next call's worst-case hold exceeded it.

**Did a t652 kept condition wrongly hold something?** Yes, once. It was not the
sponsored test or a filter, and the hold did not come from t652's new "any trial"
path:

- At 0047, Core refused revision 3 with `candidate.kept_condition_dropped`, to
  hold condition 4 of revision 2, `seller contains "valueridge"`. That revision
  was judged no / no, so this is t641's double-no path.
- The `seller` column was the product's link. The URL's path is the product
  name, so the condition was really a brand test.
- Core counted the 8 rows it left out as failing "the request's words
  valueridge". Seven of those 8 are oracle rows.
- t650 let the builder override. But the refusal's "Keep it as written" pushed
  it to a brand allowlist (`seller contains [valueridge, loftwell, …]`).
- Revision 5 then stored the exact oracle rows and was judged no / no over that
  allowlist (0064, 0065). That cost one trial.

The t652 "kept from any trial" path never held anything in this run. The one
condition it should have held, the sponsored test, was not accounted, as cause 3
above explains.

## What changed and why

Nothing changed. The findings follow.

### The plan, and the proposal that was dropped

| Step | Who | What happened |
| --- | --- | --- |
| 0007 | supervisor | Plan: `find_products` (p1, the search, filters and paging; output `products`), `build_table` (p2, the table columns; input `products`). |
| 0008 | Core | Warning `project.plan_subflow_constraint` on `build_table`. |
| 0009-0010 | supervisor, Core | Amended: `build_table` now outputs `table`. Core warns `project.plan_subflow_reshape_only`: "carry them in the subflow that reads, drop this one, and amend the plan". |
| 0011 | supervisor | Dispatches both briefs. Its summary does not mention the warning. |
| 0012-0074 | brief 1 | `find_products` revision 6: **9 rows = oracle, yes / yes** at 0071. Spent $0.0755, after one top-up of $0.0302. |
| 0075-0087 | brief 2 | `build_table`: `subflow.scope_refused` (`subflow.input_unread`) 3 times. Blocked, $0.0145. |
| 0088 | supervisor | Amends: one subflow `find_products` with parts p1 and p2, output `table`. |
| 0089 | Core | `proposalsDropped: find_products`, because "its inputs or outputs changed" and "its parts changed". `proposalsKept: []`. |
| 0090-0149 | brief 3 | Rebuilds from scratch. Partial, $0.0659. |
| 0150-0169 | brief 4, repair | Partial, $0.0164. The last trial is `not_judged`. |
| 0170-0176 | brief 5, repair | Partial, $0.0056. |
| 0177 | supervisor | Ends partial. |

The dropping rule is `project-agents/supervisor/state.ts` `changes()`
(lines 503-525 at `4e51c1da`). A changed interface, or any change in parts,
drops the proposal. Nothing asks whether the proposal already does what the
added part asks. Nothing offers the dropped revision to the next brief either:
brief 3's first request (0093) holds no trace of revision 6.

`repairFrom` (0151) ranked only brief 3's trials, "unsure over no, then the most
rows". So brief 1's yes trial was never a candidate.

### Brief 1: trial by trial

"Extras" below are stored rows the oracle does not have.

| Trial (step) | Rev | Flow shape | Rows | Extras / missing | Judges | Right verdict? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (0041) | 2 | No facets. Conditions: sponsored absent, `pickup contains "Pickup today"`, rating ≥ 4.5, `seller contains "valueridge"` (the product link) | 2 | 7 oracle rows missing | no / no | Right. Both calls named the link-as-seller fault. |
| — (0047) | 3 | Drops condition 4 | — | — | refused `kept_condition_dropped` | Wrong refusal (fix 6) |
| 2 (0051) | 4 | Condition 4 becomes a brand allowlist (rejects 0) | 10 | + Loftwell Countertop holder | no / no | Right (the holder). |
| 3 (0063) | 5 | Adds `name contains "Paper Towels"`, `not "Holder"` | **9 = oracle** | none | no / no | Wrong on the data. Both calls objected to the brand allowlist, which kept nothing out and so enforced no seller clause. 0064 also called Loftwell and Hearthside rows "marketplace-sold", which is false. |
| 4 (0071) | 6 | Condition 4 `seller not contains [marketplace, seller=, /m/]` (still rejects 0) | **9 = oracle** | none | yes / yes | Right on the data. Both yeses accepted a seller condition that rejected nothing. The answer is right because, in this fixture, the pickup and rating conditions already leave out the marketplace rows. |

### Brief 3: trial by trial

Every brief-3 revision narrowed before its read with the facets Retailer
"ValueRidge (23)", Fulfillment "Pickup (20)" and Speed "Today (16)". None read a
pickup column.

| Trial (step) | Rev | Read conditions | Rows | Extras vs oracle | Judges | Right verdict? What Core said |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (0116) | 2 | + "4 & up" facet; sponsored absent, rating ≥ 4.5 | 12 | + Softerra 8 Triple, + Northmere 12 (both "Pickup tomorrow"), + holder | no / no | Right. 0117 named the holder, which is right, and the "4 & up" facet. Core correctly refuted 0117's claim that Softerra 6 and Kindleaf were dropped (both are stored). Neither call named the tomorrow rows. |
| 2 (0122) | 3 | "4 & up" removed (it changed nothing); sponsored, rating | 12 | same | yes (0123) / no (0124), t515 re-ask (0125) | Should be no. 0124 named the holder and Northmere "Pickup tomorrow" (both right) and the sponsored copies (wrong). **Core's t515 re-ask lost the Northmere claim. 0125 named only the holder, and Core labelled it wholly contradicted.** Unsure, `retestAdvised: true`. |
| 3 (0127) | 3 retest | same | 12 | same | yes (0128) / no (0129) | Should be no. 0129 named the holder (right) and "condition 1 dropped qualifying packs" (wrong: those rows are also in the result). **Core gave no label and said "Nothing in Core's record contradicts".** Unsure. |
| 4 (0131) | 3 retest | same | 12 | same | no / no | Right. 0132 named the holder, which is right. It also said the Kindleaf and Northmere brands are not ValueRidge-sold, which is wrong: brand is not seller. 0133 claimed again that the sponsored condition drops packs. |
| 5 (0137) | 4 | Sponsored condition **dropped**; rating only | 13 | + the two tomorrow rows, + holder, + Tidemark (sponsored); Best match order broken (a sponsored copy of Loftwell Select-A-Size kept first) | no / no | Right. Both calls named real faults: the holder, sponsored rows kept, and Northmere tomorrow. |
| 6 (0143) | 5 | rating; `name contains "Paper Towels"`, `not Holder`, `not Dispenser` | 12 | + the two tomorrow rows, + Tidemark; order broken | no / no | Right. 0144 named the sponsored rows and the tomorrow row. 0145 also advised removing the name conditions, which was wrong. |
| — (0149) | 5 | — | — | — | refused `trial_unchanged_after_no` | The builder claimed (0148) "Core's record shows the sponsored-exclusion reading is contradicted". Nothing said so. |
| repair (0168) | repair rev 1 (= rev 4) | rating only | 13 | as trial 5 | one no (0169), then `not_judged` | The first call named the holder, sponsored rows and the tomorrow row. The second call was not affordable. |

**Every no on a wrong result was right in its verdict.** No judge ever said yes
twice to a wrong result. In every brief-3 trial the extras came from the
builder's own Flow: the Speed "Today" facet in place of the pickup column, no
holder exclusion, and from revision 4 on, no sponsored exclusion.

### What Core told the builder, and where it was wrong

1. **0047: refusal `kept_condition_dropped` on a link test (wrong, general).**
   - Condition 4, `seller contains "valueridge"`, was read on the product's link.
   - Core's t629 request-text test passes, because "valueridge" runs in the
     request ("On ValueRidge"; "that ValueRidge sells itself").
   - t651's label test (`refuted-no/label-tested-condition.ts`) compares values
     only whole against the row label. A URL whose path is the product name is
     never equal to that name, so the test missed it.
   - Core then held a test of the row's address as if it measured who sells the
     row. That is exactly what t651 says Core must not do with a name.
2. **0122: t515 mark on "excluding non-paper-towel items" (wrong, general).**
   - The re-ask's request (0125) carries the recheck: "that answer advised
     leaving out rows by words the request never states as an exclusion:
     "excluding non-paper-towel items"".
   - "Paper towels" are both the request's item and its search words.
     `unstated-exclusions.ts` drops search words from what counts as the
     request's words, which leaves the negating prefix "non" as the exclusion's
     only word of its own.
   - t628's carve-out needs a kind word that is a word of the stored row's label.
     "non" is not one.
   - An exclusion that is only "not the request's own item" is thereby read as
     unstated. This is inferred from the code and the recheck text. I did not run
     the function.
3. **0122: the reading labelled wholly contradicted (wrong, general).**
   - 0125's sentence was: "the kept set includes non-paper-towel items:
     "Loftwell Countertop Paper Towel Holder, Bamboo" (a holder, …) and
     "ValueRidge Essentials Paper Towel Holder, Brushed Steel" was left out only
     by rating."
   - `refuted-no/missing-claim.ts` matched `MISSING` on "was left out". It then
     took every row the sentence names, so the stored holder became a "missing"
     claim, refuted as "is in the stored rows".
   - The Brushed Steel row got the settled-row finding, which agrees with what
     the judge said.
   - The sentence's real claim, that a stored row is a holder, is one no check
     reads, so nothing stood. Core labelled the reading `recordContradicts:
     "whole"`, and the gate advised a retest.
4. **0127: "Nothing in Core's record contradicts" (wrong in effect, general).**
   - 0129 said condition 1 "left out" Hearthside 12 and Hearthside 8 "(only
     marked Sponsored)". Both labels are stored rows: another copy came back.
   - `missing-claim.ts` refutes stored labels, but not when the sentence speaks
     of a condition and a left-out copy of that label is not quoted on the
     request's words. That holds for `sponsored is absent`, which is no text
     test. So the claim stood unlabelled.
   - The advice to remove condition 1 was not refuted either: `advice-condition.ts`
     needs every row it would bring back accounted, and Tidemark was not (next
     item).
5. **0134: no `kept_condition_dropped` for the sponsored test (missing, general).**
   - In every revision-3 trial, condition 1 left out 5 rows alone: 4 "also in
     the result", plus Tidemark, settled ("the read found sponsored").
   - `standing-no-record/record.ts` `keptOutOf` needs every row accounted.
     Tidemark could be accounted only `by: "request_words"`, which
     `record.ts` `requestQuotes` grants only to positive literal text tests
     (`request-text-test.ts` `TEXT_TEST`).
   - The request says "leave out sponsored listings". Core read "Sponsored" on
     that row. That is measured, but no rule maps a presence or negated
     condition to the request's exclusion words.
   - So `kept-conditions.ts` saw a non-empty `leftOutAlone` without `keptOut`,
     deleted the entry, and held nothing.

**The narrowing re-ask (t655) did not fire.** Every facet doubt (0118, 0132, 0145)
came in a no, not an unsure, and t655 asks only an unsure again.

### Where the money went

These figures sum the steps' `meta.json` costs: $0.1898, against the run's
reported $0.19.

| Who | Calls | Cost | Of which judges |
| --- | --- | --- | --- |
| Supervisor | 10 decisions | $0.0118 | — |
| Brief 1 (`find_products`, yes) | 27 decisions, 8 judges | $0.0755 | $0.0255 |
| Brief 2 (`build_table`, blocked) | 6 decisions | $0.0145 | — |
| Brief 3 (`find_products` again) | 22 decisions, 13 judges | $0.0659 | $0.0218 |
| Brief 4 (repair) | 8 decisions, 1 judge | $0.0164 | $0.0042 |
| Brief 5 (repair) | 2 decisions | $0.0056 | — |
| Chat | 1 | $0.0003 | — |

- **Spent after the yes was already in hand.** $0.0145 went to brief 2, and about
  $0.094 went to everything after the drop at 0089: briefs 3 to 5 plus $0.0062
  of supervisor decisions. Together that is about 57% of the purse spent
  re-earning an answer the build already held.
- **Judges.** 22 calls, $0.0515, 27% of the spend. Each trial's first call costs
  about 6 times its second ($0.004-0.0057 against about $0.0008), because the
  second reuses the cached ~15k-token prompt.
- **Re-asks.** Only one, 0125, for $0.0007. But it lost a true claim and set up
  the false "whole" label, which cost two retests: 4 judge calls ($0.0036), 2
  decisions ($0.0027) and about 100 s of trials.
- **Builder decisions.** These dominate, at $0.126 or 66%. Contexts grow to
  49k input tokens: 0148 alone cost $0.0094. Brief 4 spent 4 decisions (0159,
  0161, 0163, 0165, about $0.005) confused by revision numbers: its failing
  receipt was "revision 3" of brief 3, its own first revision was 1, and it
  tested revision 3 (`trial_stale_revision`).
- **Allowance carve-up.** The rule is an even share per brief plus one finishing
  share (`supervisor/brief-sizing.ts`), with the whole test's judging reserve kept
  back.
  - Briefs 1 and 2 were each sized $0.0762, a third of what could be given. That
    is reasonable for two real subflows, but a reshape-only subflow took a full
    share.
  - Brief 3 got $0.0564. The repairs got $0.0230 and $0.0145.
  - About $0.06 was never spent. It sat in the judging reserve for a whole test
    that never ran, plus worst-case holds. That figure is inferred: $0.25 minus
    $0.1898.
  - The carve-up itself was reasonable. Two things were wasteful:
    - a trial started that could not pay both judge calls (0168), so $0.0042 and
      54 s of site work were lost;
    - the reserve stays idle once a whole test can no longer happen.

### Did t652 to t655 act as intended?

| Task | Acted? | Result here |
| --- | --- | --- |
| t652, split labelled | Yes, at 0122 (`recordContradicts: "whole"`) and 0127 (none) | The mechanism worked as designed. Its input, `missing-claim.ts`, was wrong both ways: a false "whole" at 0122 and a missing label at 0127 (fixes 3 and 4). |
| t652, kept from any trial | No | The only kept-condition refusal (0047) came from a double no (t641). Brief 3's sponsored test was never accounted, so nothing was held (fix 5). |
| t650, resend admission | Yes, at 0047 → 0049 | Worked: the builder overrode a wrong refusal. |
| t653, verdict survives a loop | Yes | 0 of 22 judge calls were truncated (`finish_reason: stop` throughout), against 4 of 21 in pair 5. The judge prompt now asks for "kind first, then the whole diagnosis object … summary last". |
| t654, unseen-row claim | Not exercised | No judge said a condition missed a row no read saw. |
| t655, together rows and page groups | Partly | `leftOutTogether` and the facets' `group`, `chose` and `leftOptions` reached the judges, for example Speed "Today", leaving out Tomorrow (10). No unsure doubted a facet, so no narrowing re-ask ran. The Retailer facet showed `leftOptions: []`. |

### Proposed structural fixes, by owning module

Every fix keeps the brief's rules:

- Core refutes only what it measured.
- A yes still needs two yeses over the parts it is judged against.
- A refusal is a hint, admitted once on resend.
- No output is capped.
- The fixtures named are generic: a library or a hardware store, never this
  site's facets, sellers, products or answer.

**Fix 1 (general, primary): carry a done proposal across an amendment that only adds parts or renames outputs.**

- Owner: Core `project-agents/supervisor/state.ts` (`changes()` and the
  kept/dropped split), and the dispatch of the next brief
  (`project-agents/dispatch/`).
- Change: when the only differences are added parts, outputs added or renamed,
  or both, the subflow's earlier done proposal becomes
  `proposalsCarried: [{subflowKey, revision, why}]`. Its key, role, success check
  and predecessors must be unchanged.
- The next brief for that subflow starts with the carried script submitted as
  its revision 1. A renamed output is rebound to the same step output. The brief
  is told to test it first.
- It is never done on the old trial. Its own trial is judged against the new
  parts, so a yes still proves p1 and p2.
- Any other change still drops it, as now.
- Test, new `project-agents/supervisor/tests/amend-carries-proposal.test.ts`, a
  library fixture:
  1. `find_titles` (p1) is done at revision 3, and `shape_list` (p2) takes its
     rows.
  2. The amendment moves p2 into `find_titles` and renames `titles` to `list`.
     It yields `proposalsCarried` with revision 3, and the next brief's first
     revision is that script.
  3. Completing without a new yes is refused.
  4. An amendment that changes `after` or the success check still yields
     `proposalsDropped`.

**Fix 2 (general, recurring since t630): the reshape-only warning is refused once, not only warned.**

- Owner: Core `project-agents/supervisor/plan-input.ts` (which raises
  `project.plan_subflow_reshape_only`) and the plan tool. Use t650's admission
  (`llm/repeat-guard/resend-admission.ts`).
- Change: a write or amend whose plan holds a reshape-only subflow is refused
  with `resend: "accepted_once"`. The same plan sent again is accepted, because
  the model may know the builder must open something per row.
- Test, new `project-agents/supervisor/tests/reshape-only-refused-once.test.ts`:
  1. A plan with a second subflow that only orders and chooses columns of the
     first's rows is refused, with the warning's words.
  2. The identical resend is accepted.
  3. A plan carrying that shaping in the reading subflow is accepted the first
     time.

**Fix 3 (general): a missing claim is scoped to its own clause, and a sentence calling a stored row the wrong kind stands.**

- Owners:
  - Core `result-verification/refuted-no/missing-claim.ts`, to attribute
    `MISSING` only to the rows named in the clause that holds it. Clauses split
    at ":", ";", ", but" and at " and " before a new quoted label with its own
    verb.
  - `refuted-no/weigh.ts`, so that a stored row named after an inclusion word
    ("includes", "kept", "keeps", "contains") is a reason Core cannot refute: it
    is about what the row is. The reading is then at most `recordContradicts:
    "part"`, and `retestAdvised` stays false.
- Test, new `refuted-no/tests/missing-claim-clause.test.ts`:
  1. The reading 'the kept set includes "<stored bookmark row>" (a bookmark, not
     a book) and "<left-out row>" was left out only by year' gives no "is in the
     stored rows" finding for the bookmark.
  2. Its weighing is `"part"`, not `"whole"`.
  3. "<stored row> is missing" is still refuted.

**Fix 4 (general): a stored label is never missing, even beside a left-out copy and a condition dispute.**

- Owner: Core `refuted-no/missing-claim.ts`.
- Change: when every row a sentence calls left out or missing has its label among
  the stored rows, refute it whatever the sentence says of a condition. The
  finding: "<label> is in the stored rows: another copy of it was kept".
- Core measured that the item came back. Whether the condition is the request's
  stays with `advice-condition.ts`.
- Test, new `refuted-no/tests/missing-claim-copy.test.ts`:
  1. A library read whose `reserve is absent` condition left out a reserve copy
     of a stored title, under 'condition 1 left out "<title>"', is refuted.
  2. The same sentence over a title not stored stands.

**Fix 5 (general): a presence or negated condition is accounted by the request's exclusion words.**

- Owners: Core `refuted-no/request-text-test.ts`, with a sibling
  `request-exclusion-test.ts` if it reads better apart, and `refuted-no/record.ts`
  `requestQuotes`.
- Change: a condition that leaves out rows having a value (`X is absent`, or
  `X not contains "t"`) accounts a settled left-out row `by: "request_words"`
  when two things hold:
  - the witness value Core read on that row runs word for word in the request;
  - in that place the request says it right after an exclusion cue ("leave
    out", "exclude", "without", "no", "rather than").
- That is Core's reading of the row against the request's words, no more. With
  it, `kept-conditions.ts` holds such a condition and `advice-condition.ts`
  refutes advice to remove it.
- Tests:
  - New `refuted-no/tests/request-exclusion-test.test.ts`:
    - "List the branch's books, leaving out reference copies", condition
      `reference is absent`, witness "Reference" gives `["reference"]`.
    - Witness "Staff pick" gives none.
    - "Include reference copies" gives none.
  - New `standing-no/tests/kept-condition-presence.test.ts`: that condition, 4
    rows also in the result plus 1 settled, is kept from an unsure trial. Its
    drop is refused once, and the resend is accepted.

**Fix 6 (general): a test read on the row's own link is a label test.**

- Owner: Core `refuted-no/label-tested-condition.ts`.
- Change: also true when the witness value on a left-out row, or the value read
  on a kept row, is a link: absolute or root-relative, with the row's label words
  appearing in order in its path. Core measured an address, not who sells the
  row, so it neither accounts for nor refutes with such a condition (t651's
  reasoning).
- Test, new `refuted-no/tests/label-tested-link.test.ts`:
  1. `seller contains "citylib"` read on "/item/citylib-atlas-of-rivers/123"
     for the row "CityLib Atlas of Rivers" is label-tested, and is not kept.
  2. A `seller` column holding "City Library" stays one the request's words can
     settle.

**Fix 7 (general): do not exclude the request's own item as an unstated exclusion.**

- Owner: Core `request-rows/unstated-exclusions.ts`.
- Change: an exclusion whose only word of its own is a negating prefix ("non",
  "not", "other than") before the request's item phrase
  (`automationStudioRequestPhrases`) is stated. It leaves out what is not the
  item asked for, even where the item words are also the search words.
- Test, new `request-rows/tests/unstated-exclusions-non-item.test.ts`, a request
  "every hardcover atlas … the search results for hardcover atlases run over
  pages":
  - "exclude non-atlas items like <stored row>" is not marked;
  - "exclude non-hardcover-atlas items" is not marked;
  - "excluding accessories" is still marked.

**Fix 8 (general): do not start a trial whose two judge calls cannot be paid.**

- Owners: Core `service/subflow-trial/run.ts` and `service/candidate-trial/run.ts`,
  with the build purse.
- Change: before acting on the site, hold two judge calls at their worst case. If
  that is not possible, answer `trial_unaffordable` with the figures, without
  running and without a first call. Nothing is capped. The trial just does not
  start.
- Test, new `flow-bootstrap/subflow-candidate/tests/trial-unaffordable.test.ts`:
  1. A purse that can hold one judge call refuses before the subflow runs, with
     no judge call recorded.
  2. A purse that can hold two runs as now.

**Fix 9 (general, minor): a repair brief's revisions are not confused with the failing receipt's.**

- Owner: Core `flow-bootstrap/subflow-candidate/` (submission numbering) and the
  repair brief's words (`project-agents/dispatch/`).
- Change: number a repair's revisions on from the failing receipt's, or state in
  the brief that "revision N" of the receipt is not testable here.
- Test: a repair from a receipt at revision 3 gets its first accepted revision as
  4, and `trial_stale_revision` names the brief's own latest revision.

**Task-specific, no fix.** These are the scenario's traps working as designed:

- Speed "Today" also counts delivery.
- The Retailer facet is the only seller signal.
- "Paper Towel Holders" sits beside "Paper Towels".
- In this fixture, the marketplace rows are already left out by pickup and
  rating.

Guidance must not mirror any of them.

## Commands run and observed results

- `python -X utf8 towels_c0nmw_trials.py <run>`, my scratchpad script. It
  prints each trial's verdict, revision, stored count, read conditions with
  rejected and alone counts, and narrowing steps. For each judge it prints
  `answersRequest`, `finishReason`, output tokens and cost, and the
  `sampleRows` compared to the oracle.
  - Brief 1 trials 0063 and 0071 store exactly the oracle (names, order, price,
    unitPrice, rating).
  - Every brief-3 trial has the extras listed above.
  - All 22 judge calls show `finish=stop`.
- Step `meta.json` aggregation by role, brief and kind: the costs in the table
  above, summing to $0.18979.
- Read the run's `steps/index.md`, `summary.json`, and these steps' decision,
  result and request files: 0002, 0007-0012, 0041-0073, 0088-0091, 0107-0113,
  0116-0149, 0150-0177. Read the judge requests' read accounts (0128 lines
  430-570) and diffed 0124 against 0125. The only addition was the t515 recheck
  over "excluding non-paper-towel items".
- Read in Core at `4e51c1da`, with `git show`:
  - `standing-no/kept-conditions.ts`, `standing-no-record/record.ts`;
  - `refuted-no/record-conditions.ts`, `refuted-no/record.ts` (`requestQuotes`,
    `labelTested`), `refuted-no/request-text-test.ts`,
    `refuted-no/missing-claim.ts`, `refuted-no/label-tested-condition.ts`;
  - `request-rows/unstated-exclusions.ts`, `request-rows/words.ts`;
  - `agreement.ts` (header);
  - `project-agents/supervisor/state.ts` (lines 470-525),
    `supervisor/plan-input.ts` (lines 50-75), `supervisor/brief-sizing.ts`,
    `supervisor/supervisor-loop.ts` (lines 215-240);
  - `git show a9378ae5 --stat` (t652).
- Read downstream: `manifest/expected-values.ts` (the oracle) and the pair-5
  report `a8-towels-run-mva6mlo8-debug.md`.
- No tests or builds were run: the brief was read-only.

## Not verified

- **Fix 7's mechanism.** The t515 mark on "excluding non-paper-towel items" is
  confirmed by the recheck text in 0125's request. That "non" was the exclusion's
  only own word, because "paper towels" counted as search words, I inferred from
  `unstated-exclusions.ts` and `words.ts`. I did not run `ownWords`.
- **The "whole" weighing at 0122.** I matched Core's finding text to
  `missing-claim.ts` output by its words. I did not run `weigh.ts` to confirm
  that the other two sentences of 0125 carried no checkable claim.
- **Whether fix 1 would have passed this run.** Revision 6 already stored p2's
  four columns, and its rows equal the oracle. A carried trial would still need
  two yeses on p1 plus p2, and the whole test would follow.
- **The unspent $0.06.** It is $0.25 minus the summed step costs. I did not read
  the purse's kept-back figure at the end.
- **The seller clause.** Brief 1's yes Flow enforced no seller test (condition 4
  rejected 0, and no Retailer facet). I did not check which fixture rows are
  marketplace-sold, so I did not confirm that the pickup and rating conditions
  alone exclude every one of them.
- **Fixes 2-9.** None was implemented or tested.

## Open questions or contradictions found

- **The supervisor ignored a correct warning (0011).** That is the second build
  to lose most of its money to a reshape-only split, after t630's wave 7. A
  warning the model can pass over does not hold; fix 2 makes it a once-refusal.
- **`repairFrom` ranks by "the most rows".** It chose brief 3's 12-row unsure
  trial, whose unlabelled reading carried the false sponsored claim into both
  repairs. More rows is not closer to passing, and a yes from a dropped plan
  revision is never offered. Should the ranking weigh Core's labels?
- **Judges accept a condition that rejects nothing.** In brief 1, revision 6's
  `seller not contains [...]` rejected 0 rows across 41 seen, and both judges
  read it as enforcing "sells itself". The account already carries `rejected: 0`.
  Whether Core should say "this condition left out no row" beside the clause it
  claims is a design question. It would only describe what Core measured.
- **The builder dropped working lines after a structural refusal.** At 0109,
  after `subflow.scope_refused` for block structure, the builder dropped the
  pickup field and condition, although Core said to keep every other line. Core
  could note conditions a resubmission drops relative to the refused script, as a
  hint. I did not propose it as a fix, because the refused script is not a
  revision Core keeps.
- **"Nothing in Core's record contradicts" (0127)** sat beside checked lines that
  already said "(also in the result)" for the very rows the no called dropped
  (0131's `checked`). The two outputs disagree. Fix 4 removes the gap.
