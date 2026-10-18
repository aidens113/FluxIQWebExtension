# Repaired office checkout: preparation

Status: PREPARATION READY; waiting for supervisor paired refresh and explicit one-run release. No build, browser/server launch, provider call, source/shared-document edit, profile/artifact mutation, commit or worker HEAD movement.

Exact catalog task: **everything-store-office-checkout-review**, scenario everything-store, kind navigate-and-extract, judgeBy expected-dataset, expectedDatasetId extract-checkout-review. Workflow office-checkout-review. Read only three new production owners: apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts, workflows/office-checkout.ts and workflows/account-literals.ts. No task, fixture, oracle or guidance changes.

## Positive oracle and permitted behavior

The catalog explicitly requests the product's Buy Now checkout, one item, the office address, free standard delivery, existing Visa, gift-card balance applied and no Plus trial, then stops before placing the order. It names exactly one output row with four columns in order: item, address, arriving, total. Product name and address must match the site verbatim, including the address name; the date uses the site's delivery-date wording and total uses its dollar format. The workflow has one nonempty expected record containing all four named fields. Expected answer values, private account literals and locator details are not copied into this report or model guidance.

The expected account fact preserves both original cart lines with their original identities, quantities and selections; saved items, next-line counter, zero orders and newsletter preference are unchanged. Checkout remains open. The separate checkout fact requires the Buy Now pipeline, exactly one intended item, office destination, existing Visa, gift card enabled, standard delivery and trial disabled. The anti-challenge fact also holds. A cart-route approximation is not equivalent to this oracle.

The task authorizes preparation and checkout choices only. It does not authorize placing/finalizing an order, moving money, a trial/subscription or unrelated account/cart changes. No permission override or added --llm-permit is proposed. Before each trial/whole rerun, the model must reverse only this build's own lasting acts through normal site controls, preserving original account state. The run must not use fixture resets between model trials.

## Prior changed cause and debug

Existing required debugs are present: docs/working/language-driven-flow-loop-plan/debugs/run-mvcx8na6-9554a3f1.md and run-mvczd85j-c98561c5.md. The first failed before producing a Flow after choosing Add to Cart, looping and being refused a repeated brief. The lane's fix1 allows one fresh brief after the no-progress guard stops a builder, carrying earlier-attempt evidence; its reported narrow validation is retained in reports/live-lane-1.md. This preparation did not reverify that implementation.

The second failure still chose Add to Cart and never tried Buy Now. It did not exercise fix1 because no loop stop occurred. At the time it was parked as a model-reading issue. The subsequent accepted provider-free audit, reports/audit-everything-store.md, identifies a task ambiguity: the old wording did not name the route although the oracle required Buy Now and an untouched cart. It revised the task to explicitly name the site's Buy Now control and exact output formats, preserving the oracle and fixture. This is the changed cause supporting the owed repaired rerun; it is not an unchanged paid retry or an added model hint. Own catalog history records the wording change at842e691623a85730b093e528aef0cb27ebdf84d7. No paid proof of the repaired wording is claimed by the earlier audit or this preparation.

## Lane and readiness prerequisites

- Proposed fresh workspace codex-office-checkout-t563-20261018-r1: verified absent beneath own test-runs/instances/bf-slot-1/persistent-isolated.
- Global lab-slots/slot-1/owner exists and structurally names own t563 task/bf-slot-1; pid is null. This is an assigned marker, not proof of an active owned run. It was not changed or removed. Normal owning launch/slot guards still decide admission.
- Read-only own Core currentness guard node scripts/check/core-build.mjs observed native0. No library rebuild was needed or performed during preparation. Observed paired HEADs downstream d25a231a3c09b05b4fcdfd547b1a6ed22d777fa6 / Core affe6202d6e38b0fcfb3b717e48bc75b41714d95. Supervisor refresh is still pending; recheck actual currency after that handoff and let the normal owner decide any necessary reuse/preparation.
- Actual authenticated Core trialRunner/startReset cannot yet be observed because no new host/session has been launched. Required live receipt is trialRunner=true/startReset=false/source=core; caller policy flags do not substitute for that observation.
- Normal previous-debug, positive-data, balance/waste, slot and source/currentness guards remain required. No overrides, broad suite, shared Core build or old6404 access.

After supervisor refresh/release only, exact proposed owning command from t563 downstream:

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
$env:FLUXIQ_LAB_INSTANCE='bf-slot-1'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
pnpm.cmd lab run everything-store --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode project --llm-task create-flow --instruction-task everything-store-office-checkout-review --target persistent-isolated --workspace codex-office-checkout-t563-20261018-r1 --model-reset-only --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

Acceptance requires actual real-extension-chat creation, judged whole run, exact positive one-row/four-field oracle and account/checkout obligations, plus a separate explicit0calls/cost/noharness replay with unchanged saved Flow. Report paid accounting and repair/hash evidence honestly. Failure requires preserved first divergence and a new terminal debug; no second unchanged paid retry. No acceptance or live startup is claimed here.

Only this NEW report is authored for preparation. Readers exited; ready for root preservation/refresh/release.
