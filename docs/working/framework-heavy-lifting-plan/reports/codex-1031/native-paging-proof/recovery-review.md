# Paging recovery read-only review — t840

Outcome: Done. No concrete defect found within the bounded recovery-review brief. This is source review, not a claim that final tests or installed replay passed.

Review premise supplied by the lead: the exact retained installed result now ends in `look_outside_owned_ui`, with unchanged saved Flow/graph and provider wiring disabled. I did not independently rerun or inspect that browser replay during this review.

Read:

- read-only git diff for `apps/extension/src/content/action-runtime/ignored-press/{settled-look.ts,tests/settled-look.test.ts}`;
- `content/owned-ui/{hosts,index}.ts` and direct identity tests;
- actual `StatusPill` registration/append sites;
- the existing scope bounds and the affected positive/negative tests.

The policy change is narrow: the outside observer excludes only records accepted by the existing private-footprint predicate. Attributes require the exact registered currently empty closed host and attributeName=style. Child-list records require a nonempty moved-node set and validate every added/removed node independently. An owned target does not waive an unowned child. The registry uses exact private WeakSet identity; markers or copied markup cannot register ownership, and current light DOM prevents host acceptance.

The per-record filter keeps ordinary page evidence in mixed batches. The negative cases still cover unregistered/copy/custom-attribute/light-DOM nodes, mixed children, and a site child added then removed before observer delivery. A genuine page record before or after an ignored UI update still sets answered=true. Request/navigation/focus signals and newly reachable open shadow roots retain their original refusal paths; the ordering tests explicitly combine them with the ignored UI update.

The change does not alter the pressed section's listener, quiet period, fields, markup serialization, exact-state comparison, declared-notice rule, or open-root enumeration. No new string-based markup stripping was added. If the registered host lies inside the section, this outside-only exclusion does not remove it from the section's state.

Actual StatusPill buildNodes attaches a closed root and registers that exact host/root before the host is appended. Its append/reattach destination is documentElement. The existing scope walk stops before body/html/main, so the ordinary status host remains outside the real page control's scope. The registry is used through the content owned-ui barrel, not the page-visible marker predicate.

Private host identity is a bounded UI-footprint rule, not attribution of the writer of an arbitrary page mutation. The reviewed exclusion matches the explicit lead-approved footprint; it adds no page/model-writable proof field and does not touch MAIN observer health, list/control provenance, private proof transfer/consumption, physical presses, Host retry accounting or lasting-effect protections.

Validation: `git diff -- apps/extension/src/content/action-runtime/ignored-press/settled-look.ts apps/extension/src/content/action-runtime/ignored-press/tests/settled-look.test.ts` plus read-only source/test inspection -> the described bounded change and negative coverage confirmed. No tests, typecheck, audit, build, browser/provider execution, Lab control or mutating git command was run, because the lead owns validation against the frozen tree.

Changed: this report only. Not verified: final test/type/audit/build results, actual persisted native first-plus-three recovery and the exact dataset's installed replay success. Those remain lead-owned acceptance checks.
