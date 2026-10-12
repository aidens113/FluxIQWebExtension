# A qualification evidence review ? 2026-10-11

Status: Reviewed; creation streak proven, qualification pending separate replays.
Owner: a-review worker; task t342.

## Current State

Both round-3 creation runs passed on the same running product pair, with candidate acceptance and all four exact task facts held. **Do not mark A qualified yet:** no separate zero-provider replay receipt exists for either newly accepted Flow. Creation's own playback makes zero adaptive/runtime provider calls but runs one model result judge. This is different from the required later, separate replay with no model anywhere.

## Evidence inspected

- Both saved bundles: every step meta/call/result/decision JSON (41 and 39 steps); candidate revision/digest consistency; oracle receipts; phase/call/cost records; run repository/environment metadata.
- Run 2: all 14 unique saved timeline screenshots visually reviewed; final frame is duplicated at sequence 15. Run 1's authored debug reviewed alongside its step records. This is saved evidence review, not a fresh browser run.
- Lane-owned `test-runs/instances/t342-slot-2/<run-id>/snapshots/`: creation context and all four running identity receipts. Expected and observed values match, `verified=true`, and are identical across runs.
- Replay receipt inventory: `replays/` holds only `replay-muz2npvw-b51023b7`, `replay-muz3idd0-d170048d`, `replay-mv0pfvkz-f8815de0`; none belongs to the two new Flow IDs.

## Identity and acceptance

| Identity | Both runs |
| --- | --- |
| Downstream source commit | `676614063c345c841c6f03a0e5c5ef1570b8b66b`; dirty paths are documentation only |
| Core source commit | `01621c946b34075a1d39f23cae5bf9b88f79b2e0`; clean |
| Extension artifact SHA | `5346137d49a811a5a3a292d8b5bbaef1945c2c4a5f080662c2ef9e4c8c0af345` |
| Running extension input digest | `7a42b712d4110584c8b867fffa1627af3b87ca5856fcc4e62f569efec233b395` |
| Running Core artifact digest | `74995fd6e3fd9ded5952e0eb69e76a1f626e2e4dacb80ce3af63cded3dd0481e` |
| Running domain host artifact digest | `2ccec6322d405abb6c6ac8f5742860f95227be02e0e93f902896a0f9abb0b42b` |
| Running gateway adapter artifact digest | `3f8ba915ac98ec75ec26af2d659c6e27f153191001bf43f1660eaca971a13225` |
| Browser / target | Chrome/134.0.6998.35, e2e-chromium, persistent-isolated |

Both: real extension chat entry, candidate mode, revision 1, one reset-start trial, execution succeeded, two positive trial judges, exact digest completed and promoted. Creation-context outcome created and Flow IDs agree with flow-lane. Runtime succeeded; result confirmed; zero harness activations; cart-count, orders-shipped, cart-line, store-coupons all held; final state held.

## Accounting and gate

| Run | Calls / tokens / USD | Action replay | Result judge |
| --- | --- | --- | --- |
| `run-mv4jihmm-af72a1e1` | 18 / 295023 / 0.030382446 | runtime=0, repair=0, reauthor=0 | 1 / 0.003151992 |
| `run-mv4jvo7k-612f0bbb` | 16 / 271562 / 0.04782936 | runtime=0, repair=0, reauthor=0 | 1 / 0.003312492 |

Step-meta provider counts and cost sums match observed/runSpend exactly. No unrecorded calls or budget breaches; both below $0.10. Run 1 includes an uncharged judge-network-error attempt followed by automatic successful retry.

Documented gate: `mvp-final-month-plan.md:173` requires each accepted creation's zero-call replay, then another creation on the same pair and its replay. Historical A debug `run-mv0pb9sm-248ba49f.md:86` specifically calls for `lab replay`. `docs/architecture/testing-facility.md:623-667` defines later separate invocation, unchanged saved content hash, task judgement, explicit measured zero calls/interventions/harness, and disabled model wiring. Creation's internal playback does not meet this proof. Earlier replay receipts cannot qualify different Flow IDs.

## Run-2 findings

1. **Consequence receipt inconsistent, cause not traced.** Step 0020 explicitly declares `create_new` for collecting the coupon; exploration succeeds. Build cross-check says `beyond_instruction`, instructed consequences empty, permissionRequest null; campaign summary says allowed by unexplained. The user instruction already expressly requests coupon collection, so this is evidence of inconsistent classification/authorization reporting, not proof that an unrequested act occurred. Saved executable coupon act reports empty consequences. Preserve for policy-owner review; no policy code changed or conclusion of safety correctness claimed.
2. **Interruption persistence not proven.** UI shows generic Clear the page after Add to cart in trial and playback. The saved submitted script has optional known popup dismissal steps but no explicit recovery handler. Neither receipt explains which later notice was dismissed. Do not treat this as saved adaptation/recovery proof.
3. UI repeats run-1 wording/order findings: optional click cards elide actual control names, Choose repeats the verb, Clear the page omits the dismissed control, and trial reasoning is placed after trial cards. Stop build / Take over / Stop run / Run finished visibly present. Failed coupon press and retry are visibly reported.
4. Run-1 stale header-count wording does not recur in run-2 judge decisions, but no end-view timing fix is proven.

## Required next checks (templates only; not launched)

Run from the t342 downstream tree with provider credentials absent, slot ownership rechecked by supervisor, and `FLUXIQ_TEST_ENV_FILES=none`. PowerShell environment setup:

```powershell
$env:FLUXIQ_LAB_INSTANCE = 't342-slot-2'
$env:FLUXIQ_TEST_ENV_FILES = 'none'
pnpm lab replay crossborder-marketplace --workspace t342-a --project 47ddc767-86f4-43c6-a335-a5dcb127527f --flow flow.aa244ab2-77f1-4ddd-be15-318f679991c8 --instruction-task crossborder-marketplace-hub-to-cart
pnpm lab replay crossborder-marketplace --workspace t342-a --project ec76c3ee-3459-40ac-be84-c1a35e76302e --flow flow.f5066fb1-61ce-42a7-b409-dcd2f025b0fd --instruction-task crossborder-marketplace-hub-to-cart
```

Expected saved Flow hashes respectively `aa84282af4d39760d1f823401627d49516c7dab3fed34c629d21c50c62d4efaa` and `6005b989656b7f1eb70b6e86ba465624f762c8f24dac19a51d4b0b10cbb06d4f`. Supervisor must inspect both replay receipts; this worker did not inspect current persisted storage or launch anything. A missing original Flow/project is a recovery gap, not permission to silently create another.

## Validation and limits

Read-only JSON/receipt comparison and visual saved screenshot review. No source, Core, shared documents, pending debug, runtime data, or artifacts changed. No build/test/browser/provider/panel launched. Only owned report, lane report, and completed run-2 debug authored. Supervisor verification and integration remain owed.
