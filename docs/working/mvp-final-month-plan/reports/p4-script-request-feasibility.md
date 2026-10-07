# P4 script and request feasibility

Status: Partial
Created: 2026-10-06
Owner: Codex supervisor
Scope: Source/API feasibility plus independently verified installed Chrome/Edge prototype; no product executable capability yet.

## Current State

Typed-first, roughly three typed attempts, then JS as a recorded partial-success fallback remains binding. Direct requests must be OFF in config and Settings. Neither action is currently registered; shared settings/defaults/save whitelist contain no request toggle. Chrome manifest minimum is116 and the tested Chromium is134; no userScripts/debugger permission is shipped. Packaged MAIN-world dialog/press instrumentation is not a dynamic-script executor.

## Verified platform constraints

Chrome requires userScripts + site access and a user-controlled enablement toggle. One-shot execute requires135+. Earlier versions would need a separate registration/document lifecycle design, not a pretend equivalent. MAIN is page-visible; USER_SCRIPT is separate. Browser availability must be tested at dispatch, not inferred from manifest/browser version alone. [Chrome API](https://developer.chrome.com/docs/extensions/reference/api/userScripts).

Extension/worker CSP cannot enable unsafe-eval. Dynamic user logic should use the documented User Scripts API; remotely supplied logic executed through eval or a custom complex-command interpreter conflicts with the store's MV3 requirements. A store-acceptance claim for AI-authored scripts needs a concrete API-purpose review. Debugger remains excluded by the user's decision. [CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy), [MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements).

Firefox MV3 requires userScripts as an optional-only permission, unlike Chrome's install-time permission plus user toggle. Chromium proof cannot establish Firefox permission/install parity. [Mozilla API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts).

Background fetch can use declared host access; content-script fetch remains subject to the page's cross-origin restrictions. This does not establish authenticated endpoint access, session-cookie behavior, CSRF success or semantic success. Never infer a successful user action from HTTP2xx alone. [Network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

## Implementation decisions and unresolved proof

1. Add focused downstream script/request action contracts, schemas, registered output definitions, gateway mappings and owning runtime modules together. No Core browser API or unregistered passive input becomes executable.
2. Requests: explicit OFF default in settings/defaultSettings/save whitelist and runtime dispatch gate; enabling requires paired/current caller permission. Restrict scheme/origin/method/header/redirect policy and response size/deadline; block credential-bearing requests until explicit consequence authorization. Do not return credentials/cookies/authorization headers. Bind command/request IDs to candidate revision and record dispatch/unknown outcome truthfully.
3. Script prototype: prefer USER_SCRIPT with messaging disabled and per-command world/document identity. Capability-detect135+ execute; refuse unsupported134 path initially rather than introducing persistent re-execution on navigation. Prototype denied permission/CSP/host toggle before changing supported-browser minimum. Persist source/version under Core-owned candidate, not extension-local project storage.
4. Requests OFF must also be respected by the script design. Investigate per-world connect-src denial and admitted code surface; MAIN-world scripts or calls into page functions can trigger networking. Do not claim arbitrary JS is network-confined solely by disabling the dedicated request node. Ordinary typed site interaction remains allowed under normal consequences.
5. Arbitrary renderer JS cannot presently be certified hard-bounded or rolled back. A promise timeout is an observation deadline, not interruption of a synchronous infinite loop or cancellation of an issued write. Prototype bounded admitted code, worker/world termination limits and unknown-outcome fencing; no blind redispatch on timeout. Read-only claim cannot be inferred from script description.
6. After feasibility proof, the node remains behind typed-failure eligibility, normal consequence permission and exact candidate outcome verification. Mark replay/tool/cost evidence success_used_js; never count it as full typed success.

## Required tests before enabling

Real supported Chrome/Edge and Firefox: permission/toggle missing/revoked, page CSP and cross-origin frames, stale document/generation, cancellation/unknown issued effects, oversized/cyclic/non-JSON results, exception and long-running script. Requests: OFF emits zero request; explicit allowed origin/method, redirects and absent/expired authentication;CSRF failure, response bounds and timeout-after-write. Reset/refused-operation oracle independently establishes page state; no secret-bearing captures in reports. Provider-free local probes precede one bounded off-peak paid representative only after P0/P2.

## Validation ledger

- Supervisor read manifests/settings/page-world entry, action types/schema and runtime owner searches. No script/request registered capability found in inspected owners.
- Official Chrome/Mozilla primary documentation checked2026-10-06; API/policy constraints above are sourced, implementation choices are proposals.
- No product edits, browser feasibility prototype, provider/full suite/user panel or remote script execution. P4 remains partial until those prototypes and contracts land.

### 2026-10-07 - installed browsers, independent supervisor probe

Root repeated frozen t314 opt-in fixture: actual Chrome154.0.8037.98 and Edge154.0.4258.62,2/2 zero skips9.9s, seven-file fingerprint87f504c1c75b7dd09268f01ae1bd49301560d001da01f4881a773247b4e1baee. Actual user-toggle enable/revoke, retained namespace call refusal, isolated USER_SCRIPT/page CSP, stale document/ungranted hostname, messaging-disabled and independent network counters proved. The dedicated report/prototype will integrate after merged owning types/audit; it is not a production permission or fallback contract.

Tested world connect-src none blocked fetch (zero request), while DOM image and anchor navigation each issued a request; default-src none also blocked image, but anchor navigation still issued a request. Do not equate a disabled request node or world CSP with arbitrary script network isolation. Admitted code/effect surface, requests-OFF policy, cancellation/unknown state, bounded results, actual candidate eligibility/permissions and Firefox remain unresolved before product enablement. No infinite-loop/termination, real site, provider or user-panel proof claimed.
