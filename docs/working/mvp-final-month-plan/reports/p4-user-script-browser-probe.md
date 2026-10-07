# P4 User Scripts actual-browser feasibility ? t314

Status: source frozen after actual-browser prototype; supervisor independent verification pending. No product capability approved.

Approved owners are the new apps/extension/e2e/user-script-feasibility/{browser,extension,pages,types,index,playwright.config}.ts and tests/probe.spec.ts, plus this report. Core is detached/read-only. Generated minimal manifests/pages and profiles are isolated beneath ignored apps/extension/test-results; cleanup checks the resolved root, immediate parent and exact owned random name before recursive removal. No production manifest, action registry, settings, network permission, debugger permission, provider, panel, git or shared-document changes.

## Primary current references

Chrome's one-shot execute is135+, documentIds are supported, USER_SCRIPT has its own world, and138+ uses the extension's Allow User Scripts toggle. A retained namespace can survive revocation while methods refuse; dispatch must check an actual call. [Chrome User Scripts API](https://developer.chrome.com/docs/extensions/reference/api/userScripts), checked2026-10-07, updated2026-09-11.

CDP has an experimental test-infrastructure loadUnpacked method; the actual installed-browser outcome must establish support. It is not a shipped debugger JS capability. [Chromium-owned protocol definition](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Extensions.pdl).

Edge lists User Scripts among its extension APIs; this is not evidence of installed-browser enablement parity. [Microsoft supported APIs](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support). Extension CSP and request-origin boundaries remain relevant: [Chrome manifest CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy), [Chrome network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

## Discovery and intended proof

Executable file metadata shows Chrome154.0.8037.98 and Edge154.0.4258.62. Actual running Browser.getVersion is still pending. The prototype uses browser settings UI only in owned profiles for toggle enable/revoke, missing API permission, one-shot USER_SCRIPT, stale document targeting, an ungranted local hostname, strict page CSP, per-world connect-src denial and admitted fetch positive control. Synthetic server counters separately observe DOM-image and DOM anchor-navigation effects; fetch confinement is not arbitrary-JS network isolation.

No installed pre135 browser was found or probed, so an actual unsupported-version result cannot be claimed. Firefox, store eligibility, product permission/consequence/candidate receipt integration, hard termination, rollback, unlimited/long-running code, session networking and real sites remain unverified. No infinite loop will be executed. Prototype results and test failures will be recorded below before freeze.

First actual Chrome attempt failed in the harness: Playwright persistent contexts expose no Browser object, so browser-level CDP creation was unavailable. The browser was closed and the guarded owned root removed. Switched the fixture to a page CDP session and will measure actual command support; this was not an API/provider/product result.

Page-level CDP refused Extensions.loadUnpacked as Method not available. The next correction uses Playwright-owned temporary browser profile, browser-level CDP and explicit test-extension incognito loading. No normal browser profile is read; generated fixture root still undergoes guarded cleanup and Playwright owns its launch profile lifecycle.

Browser-level CDP loading succeeded after attaching a second browser-level connection to the owned persistent profile's test-only debugging port; incognito extension-page access was rejected in an intermediate attempt, so the final harness uses the explicit owned default profile. The next Chrome run passed enablement, strict-page execution, document freshness, allowed/denied fetch checks, then rejected the assumed image effect: default-src none also blocked that image. Corrected the fixture to measure connect-src-only denial separately; no broad isolation conclusion was inferred.

Chrome final expanded matrix passed. Edge loaded the same generated extensions and missing-permission/toggle negatives but the Chrome WebUI toggle selector did not exist. Actual owned Edge UI inspection found the Allow User Scripts setting in access-section with fluent-switch checkbox-1. The fixture now clicks that actual owned UI element after asserting the setting caption; no preference/storage mutation. Extension/e2e TypeScript check passed before this selector correction; final rerun pending.

## Final observed browser matrix

Final frozen-source run passed **2/2, zero skips, 12.0 seconds**. Actual running versions from browser-level CDP were **Chrome/154.0.8037.98** and **Edg/154.0.4258.62**. The identical current-source fingerprint for both runs was `87f504c1c75b7dd09268f01ae1bd49301560d001da01f4881a773247b4e1baee` (all seven authored prototype files, including configuration and spec). Each browser used a new explicitly owned temporary persistent profile and generated minimal extensions; the guarded fixture roots were removed after closure.

| Actual observation | Chrome154 | Edge154 |
| --- | --- | --- |
| Browser-level CDP loadUnpacked | Works | Works |
| Missing userScripts permission | Namespace undefined; getScripts refused | Same |
| Initial user toggle off | Namespace undefined; getScripts refused | Same |
| Toggle enabled through owned browser UI | execute function available | Same |
| USER_SCRIPT one-shot under page script-src none | DOM mutation/result succeeded; ordinary inline page script blocked | Same |
| USER_SCRIPT versus actual page global | Page global123, isolated global undefined | Same |
| World messaging false | sendMessage/connect undefined | Same |
| Old documentId after navigation | Injection refused; current DOM unchanged | Same |
| Unrequested localhost host | Injection refused; DOM unchanged | Same |
| World connect-src none | Fetch blocked; zero observed denied requests | Same |
| Admitted world connect-src local positive control | One fetch, expected synthetic response | Same |
| DOM image under connect-src-only denial | One independently observed HTTP request | Same |
| World default-src none image | Image failed; zero request | Same |
| DOM anchor navigation under default-src none world | One HTTP request and actual page navigation | Same |
| Toggle revoked with namespace already acquired | Namespace still object; retained getScripts and execute both refused | Same |
| Extension page reload after revocation | Namespace undefined; call refused | Same |

Per browser, server counters were allowed-fetch1, dom-image1, dom-navigation1; strict-fetch0, denied-fetch0, sealed-image0. Counters observe only the synthetic local HTTP server, not all possible browser networking. Isolated host-resolver restrictions and browser background-networking suppression are test infrastructure, not a product confinement mechanism. Provider integration was absent and no provider/chat calls were made; no FluxIQ panel was started.

The successful loading path is an explicit owned persistent profile launched with test-only `--enable-unsafe-extension-debugging` and an ephemeral debugging port, followed by a browser-level CDP connection for loadUnpacked. The harness reads only that profile's generated DevToolsActivePort control file; it never edits profile preferences/storage. Chrome UI uses the actual allow-user-scripts element; Edge uses its inspected access-section checkbox-1 after asserting the Allow User Scripts caption. These are browser-test selectors, not shipped onboarding UI.

## Validation and independently runnable command

From this task worktree:

```powershell
$env:FLUXIQ_USER_SCRIPT_PROBE='1'
pnpm.cmd --filter @fluxiq-web-extension/extension exec playwright test -c e2e/user-script-feasibility/playwright.config.ts
Remove-Item Env:FLUXIQ_USER_SCRIPT_PROBE
```

The flag is required; default runs skip these prototypes. No production extension or domain build is required because writeProbeExtension is the owning generator for the minimal test manifests and static pages. Run the installed executable paths named in browser.ts; browser-level runtime versions are emitted, not inferred from file metadata. Temporary generated files and profiles are beneath ignored apps/extension/test-results, and volatile document/tab IDs are redacted from the results. Browser closure waits are bounded15seconds; no synchronous infinite loop or hard interruption was tested.

- Actual browsers:2/2 passed, zero skips,12.0s on final source.
- Structure audit: passed176advisory warnings/117baseline, no baseline edits.
- Extension source/e2e TypeScript check (`pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.test.json`): passed on final frozen source.
- Default opt-in behavior: tested without the flag;2prototypes skipped and no browser launched. This is not a browser pass.
- No full suite, product manifest/action/settings, network/debugger capability, Core, provider, real site/profile/account, panel, git or shared working document changed.

## Required decisions before any product implementation

This establishes a bounded platform prototype, not consent to execute arbitrary generated code. API presence alone is insufficient after revocation. Per-world connect-src protects tested fetches but DOM consequences can still issue network requests, including navigation even under the tested stricter world CSP. A requests-OFF setting therefore cannot be equated to arbitrary-script network isolation. Candidate source/version, typed-failure eligibility, consequence permissions, document/generation binding, outcome receipts and independent semantic verification remain product design work.

Only top-frame targeting and one allowed versus one ungranted hostname were exercised. Cross-origin subframe grants, site-permission revocation, MAIN-world interaction, updated-extension/restarted-worker behavior, canceled/late effects, bounded results/serialization, long-running code, Firefox parity, store eligibility, redirects/cookies/auth/CSRF and product replay are unverified. There is no hard termination, transactional rollback, arbitrary network confinement, release readiness or qualification claim.
