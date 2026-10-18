# Classifieds target diagnosis

Status: Read-only diagnosis complete. Authoring/coverage failure established; no new product defect or source fix proven. Photo remains paused.
Owner: storage_comparison worker. Date: 2026-10-18.

The candidate opens one listing and then reads a seller target observed on another listing. The first causal divergence is omission of the requested radius before selecting the card; subsequent direct exploration of the correct listing supplies targets that are mixed with the original wrong card in the submitted Flow. Runtime correctly rejects the missing seller identity. This is not an established modal-versus-standalone matching failure.

## Exact recorded evidence

Evidence root: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvd9nlx5-1373850d/steps`.

- Actual commands0019..0037: navigation, consent, search, notification control, three condition checks, one list read, then card click. No radius-apply or sort step. Results packets0031/0035 retain the broader radius marker and lack the requested narrower marker.
- Packet0031 observes t932. Matching its card title privately to the unchanged source catalogue identifies listing-key hash ee49966d26f7. It is cheaper than the intended listing and satisfies the condition category, but is OUTSIDE the requested radius. The intended oracle listing-key hash is56f275df4e58. No copied catalogue values/addresses/names are needed to establish inequality.
- Clicks0037/0065/0087/0091 all use t932. Their page packets show the same selected seller hash f4e38fa80e05. The seller query later used by0139 has hash0027ec8fd27a and is absent from all four clicked-card packets.
- Direct navigations0119/0135 open the intended listing (standalone path hash5d6417f582fa) and introduce t1317 seller, t1325 message input and t1329 Send. The queried seller is present in both packets. Thus this is a different listing identity, not evidence that one seller disappeared after reload.
-0037 contains one dialog and t1096 identifies its chat-close control.0065/0087/0091 contain no dialog marker while listing/seller sections remain. Current CHAT_SCRIPT removes only the chat dock and marks chat closed. It does not remove the listing. Trial0143 reports optional close step12 succeeded, followed by seller read step14 target.not_found four attempts. The trial is trial.3bcc8762-2ce5-4af0-b1f9-a91fd70faaae.0145 is an unchanged submission returning that same trial, not an independently executed second failure.
- Final0141/0145 candidate retains t932 click, optional t1096 chat close, then t1317 seller read and the intended listing's message/Send handles. It still has no radius-setting/sort step. Historical report codex-classifieds-seller-read.md independently identifies t932 as extracted row2 and direct navigation as row0; sorting prices alone preferred row2 without satisfying distance.

The action read URLs for card clicks retain a results-query hash6914dee31f72 despite listing detail content in the returned page packet. That stale URL observation alone cannot establish a listing modal. Fixture source has plain item anchors and a separate listing-page route, with no modal card interception in the inspected owners. We do not claim a URL-reporting defect from these receipts alone; content identity already proves the mismatch. No screenshot or raw page data was copied into this report.

## Owning source and current generic recovery

`git diff --stat 48cdbfee -- apps/scenario-lab/src/scenarios/local-classifieds` produced no differences: current scenario source matches recorded-source directory. Inspected narrow owners: view/card.ts, view/listing.ts, pages/listing.ts, pages/results.ts, pages/document.ts, client/feed-script.ts, client/listing-script.ts and client/chat-script.ts, plus catalogue identity/listing/sellers and breadth/test-ride.ts. Card markup is a plain listing link; listing route renders seller details; chat close only removes its dock. The authored positive workflow applies radius, condition and sort before the intended card, closes chat, then addresses the listing form. Task/oracle remain achievable and unchanged.

Existing generic correction is ALREADY present in Core runtime/flow-bootstrap/candidate/trial-stop.ts: after an execution failure it tells the model to trace preceding steps and compare reached context with the failed step's needs, because an earlier step may be causal. Owning candidate/tests/trial-stop.test.ts covers this wording; previous codex-classifieds-seller-read.md records its fail-first/pass12/type/audit validation. This current guidance is directly relevant to the observed wrong-card/foreign-seller chain, without scenario-shaped hints or names.

Observed targets provide grounding/provenance, not proof that a future authored sequence reaches that target's context. Both sets of handles were genuinely observed during exploration, so merely accepting their existence before a trial cannot prove their navigation relationship. A strict static URL-equality rejection would also be unsafe for legitimate in-place routes/overlays or multi-page flows. Actual trial correctly rejects the unmatched identity; current generic preceding-context feedback supports recovery. This historical run predates that already integrated guidance. There is no new narrow missing-feedback defect established by this investigation and no basis to loosen identity matching, insert fixture-specific instructions, or change task/oracle to justify another run.

## Scope and next evidence

No source/test/fixture/oracle/model-guidance change proposed. No browser probe, build, test suite, paid call, commit or push executed. Root concurrent integration/audits were not touched. Own report and existing failed-run debug only changed.

If further structural proof is desired before a later release, the minimal provider-free probe would extend existing `apps/scenario-lab/src/scenarios/local-classifieds/tests/breadth.test.ts`: follow the two already identified ordinary card/direct navigation paths privately, confirm distinct listing/seller identities, close only chat and confirm seller remains, then run the existing correct filtered workflow to its positive oracle. This is a proposed probe, NOT executed or authorized by this diagnosis; existing positive audited browser path already proves task achievability. No product edit or unchanged paid retry follows automatically.
