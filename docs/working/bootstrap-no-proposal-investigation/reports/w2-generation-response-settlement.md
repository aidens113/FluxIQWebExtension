# w2-generation-response-settlement

Status: provider-free diagnosis complete; the external Playwright body observer was the only unbounded seam and is now bounded independently of the product UI.

## Categorization

The three response boundaries were exercised without a provider call:

1. **Route serialization:** Core's exact `NextResponse.json` serializer produced a complete HTTP-200 bounded permission envelope and its body parsed back with `flow_bootstrap.permission_required`. The owning application route remains `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts`; no route change was justified.
2. **In-page consumption:** `program-api.ts` reads the response once with `response.json()` before normalizing and resolving the authoring command. A local Chrome fetch against a bounded JSON response completed that page-side JSON read. The earlier mocked component probe separately proved that the normalized bounded object strictly parses and renders the permission dialog. No product transport change was justified.
3. **Parallel observer:** In the same local Chrome probe, Playwright observed the response and `Response.text()` completed alongside the page's `response.json()`. A controlled observer whose `text()` never resolves reproduced the Testing Lab defect: the prior driver had no timeout or UI-independent escape from that await.

The production run's HTTP response event therefore proves only that Playwright observed headers; it cannot be allowed to hold the UI driver indefinitely while the product fetch follows its own lifecycle. The proven faulty seam was the downstream observer contract, not Core route serialization or `readResponse`.

## Smallest fix

`packages/test-runner/src/demo-llm-create-ui/explore-proposal-ui.ts` now races the external `Response.text()` read against a two-second bounded wait.

- When the body settles, the existing strict failure sanitizer remains authoritative.
- When it does not settle, the driver records only `exploration.response-body-unsettled` plus whether the strict consequence dialog is visible.
- It may continue only when that product-rendered dialog is visible and this is the first permission request. That dialog is already gated by Core's strict permission-request parser.
- Without the dialog, or after permission was already confirmed, it fails closed. It never invents a permission from status or headers.

This makes dialog observation independent of the external body consumer while preserving the response sanitizer whenever bytes are available.

## Validation

- Synthetic local Chrome page fetch + Playwright parallel observer: page `response.json()` and observer `Response.text()` both settled with the bounded categorical envelope.
- Controlled never-settling observer: bounded helper returned `undefined` instead of hanging.
- `pnpm --filter @fluxiq-web-extension/test-runner build`: passed.
- Focused `exploration.test.js`: 5/5 passed.
- No provider call, production panel run, broad suite, Core source edit, commit, or push.

The first focused file run exposed one stale source assertion that expected `ok !== true`, while the driver has long used the positive success check `ok === true`; the directly owned assertion was aligned and the focused file then passed.

No temporary probe file remains. No raw response, page data, credentials, user state, or port 3000 was touched.
