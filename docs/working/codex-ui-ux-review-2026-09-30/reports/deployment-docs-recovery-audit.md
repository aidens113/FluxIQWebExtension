# Deployment and Docs recovery audit

Status: Complete
Date: 2026-10-01
Worker: deployment_docs_audit
Scope: Read-only inspection of the two Core live views, their direct tests, and program-api.ts in the paired t224 tree. No product or test changes, execution gates, browser session, provider call, panel management, commit, or push.

## Evidence and limitations

Read the parent working document Current State and Deployment and Docs recovery brief first. Inspected deployment-sync.tsx, docs.tsx, tests/deployment-sync.test.ts, tests/docs.test.ts and program-api.ts. Findings below are traced source sequences, not executed component reproductions or observed browser behavior. Existing Deployment tests contain two source-string contracts; Docs tests exercise outline/tree helpers and one source-string contract. Neither suite currently tests deferred requests or mutations.

Normal fetch/JSON/authentication errors inside program-api.ts readResponse resolve to an unsuccessful ApiResponse; transport rejection does not routinely escape into these views. An unexpected rejected API promise can still wedge uncaught state, but that is defensive coverage rather than the normal network-failure sequence. Successful responses receive no endpoint-specific payload validation. API identity changes with domainId, making an unchanged component instance a meaningful cross-domain owner transition.

## Deployment Sync

### D1: Cross-domain presentation and mutation ownership are unfenced

At deployment-sync.tsx:10-35, state is not keyed or synchronously masked by API identity. Domain A snapshot, selected action/version, status, busy state and confirmation survive rendering domain B until another response changes them. Initial effect reads carry a controller, but manual and post-mutation refreshes do not. Every non-aborted response publishes without comparing owner or generation.

Concrete sequence: select A target and open its checkout confirmation; change domainId to B; before B snapshot resolves, the same pendingAction is rendered, and its current confirmation callback calls B's API with A's targetId/versionSha. Separately, an already issued A mutation can complete after the transition, replace B detail/status, and initiate its captured A refresh. This is a frontend context defect, not a demonstrated server authorization bypass. Old captured event callbacks can also issue A requests after B becomes current because they have no entry ownership check.

### D2: Repository mutation lock is presentation-only

run sets React busy state but checks neither a synchronous pending ref nor current owner. Two Dry Run activations in the same turn can issue two POSTs; two captured confirmation activations can similarly submit checkout/rollback twice even after the modal closes. Confirmation submit itself has no disabled busy guard. Other controls are disabled only after render. A fulfilled failure releases busy, but an unexpected rejected POST skips release and feedback. Pending operations have no lifecycle/result fences.

The confirmation correctly captures targetId/versionSha, and normal changing of the selected target after opening it must not silently retarget that captured action. Conversely, removing that target from a successful refresh should prevent a now-invalid confirmation from issuing a mutation. A failed action currently replaces an existing useful selected result with null (unless the failed result carries a payload).

### D3: Manual and post-action reads can race and hide acknowledged writes

refresh has no loading marker, pending coalescing, generation or completion fence. An older manual read may replace a newer snapshot. A mutation reports its result, then awaits refresh; if that refresh returns an unsuccessful response, the top-level unavailable early return hides the acknowledged action result and status entirely. A rejected refresh is uncaught. Preserve last confirmed same-owner snapshot and distinguish action acceptance/result from subsequent snapshot confirmation; explicit Retry must retry the read, never silently replay a repository mutation.

### D4: Unknown repository state is presented as clean

At line43, absent git or unavailable git with no dirty flag produces Working Tree = Clean. The Git history tab similarly emits the success alert Working tree clean whenever status rows are absent, including git.available=false. Git unavailable is shown elsewhere, but it does not make these successful claims truthful. Use unknown/unavailable presentation and suppress the clean success alert unless actual available repository evidence supports it. No target is correctly described as an empty registration state after a valid snapshot.

### D5: Malformed successful payloads are unchecked

Missing successful snapshot payload becomes empty targets plus Git unavailable rather than an explicit invalid response. Non-array targets/runs/git collection fields or null row members can throw during find/map/field reads; a version without refs can throw when selected detail invokes refs.join. Endpoint payload validation should reject malformed data with a fixed local recovery message, preserving confirmed same-owner state. Do not print arbitrary server bodies or exception contents.

## Docs

### C1: Domain/page completion ownership is incomplete

At docs.tsx:31-35 and 75-96, snapshot/rebuild completions have no owner/generation fences; page requests rely solely on result.aborted from an effect-owned signal. Old manual refresh or rebuild can publish into the current domain. Domain changes retain activePageId, sourceId, search, page, error and status before effects run; a prior active page that does not exist in the new snapshot prevents initial selection because line56 returns whenever activePageId is nonempty.

An old captured selectPage callback may also change current selection and push an old-domain doc path into current browser history. An old rebuild callback can issue a request after owner replacement. Use current owner guards at entry, render, completion and cleanup, not just signal forwarding. Preserve drafts/selection on same-owner refresh; reset or mask them at actual domain replacement.

### C2: Rebuild does not reload unchanged selected page; removed selection stays stuck

The page effect depends only on activePage?.id and api (line87). Successful rebuild replaces snapshot but leaves activePageId unchanged. If the selected ID still exists, there is no new get-page call: old page content remains displayed despite the rebuilt-success status. If the selected ID disappears, page is cleared but line56 still refuses to choose another page, leaving No document selected without recovery selection. Reconcile confirmed metadata selection; invalidate/reload selected page after a successful rebuild even when its ID is unchanged, without discarding a valid source/search draft.

### C3: Failed page recovery performs the wrong action

At line137, all page errors expose only Rebuild Snapshot. A fulfilled transient get-page failure cannot be retried for the same page; clicking its selected tree row again changes neither activePageId nor the effect dependencies. Rebuild adds a write-like whole-index action, and C2 means it may not even retry the failed page. Provide direct current-page Retry for a read failure; preserve an explicit separately labeled rebuild for an actually missing indexed page. Initial unavailable snapshot correctly has a read Retry.

### C4: Busy and concurrent request states are fragile

rebuild sets state without a synchronous pending lock and uses neither catch nor finally. Two same-turn activations can issue two rebuild POSTs. Rebuild failure preserves existing snapshot and shows status, which is useful, but unexpected rejection leaves rebuilding forever. Manual refresh can overlap rebuild; their results are ordered only by network arrival, so an older snapshot may erase a completed rebuild.

refresh immediately sets snapshot null, unmounting explorer/tree and replacing the entire viewer with LoadingState; it provides no guarded read-busy affordance or retained confirmed content. This also transiently produces an empty pages list. The page effect's no-active-page branch clears only page, not pageLoading/pageError, so selected-page removal while loading can leave a loading indicator combined with No document selected, or an old page error after selection no longer exists. Unexpected get-page rejection has no catch/finally and leaves pageLoading true. Unsuccessful responses are handled normally and should remain so.

### C5: Malformed success and missing metadata produce false empty/success states

rebuild uses result.payload! without runtime validation and announces success even with no payload. Snapshot success without payload appears as zero indexed pages/No matching pages. Malformed pages/sources/null members can throw; malformed page.html reaches regex helpers expecting strings. The filter's No matching pages text is appropriate for a real nonempty index with no matching query, but a valid zero-page index should instead explain that no documentation has been indexed and offer an explicit rebuild. Bad response shapes must be recovery errors, not empty success.

### C6: Keyboard tree focus and collapsed-folder stability need bounded follow-up

At docs.tsx:169-173, the effect always resets focusedPath to activePath when a selected visible row exists and depends on focusedPath. Focusing another row therefore resets its roving tab stop back to the selected page on the next render, rather than allowing keyboard exploration independent of selection. This is source-confirmed state behavior; actual focus timing/browser impact was not exercised. Keep selected page and current keyboard target distinct, reconcile only when the target becomes unavailable or explicit navigation requests a new target.

The tree reconciliation re-adds every default-expanded path on root changes, undoing a user's collapsed folder after source/search changes. Each row computes siblings by filtering the full flattened list; large visible trees repeat O(total rows) work for each visible row. These are lower-priority follow-ups; preserve virtualization, source-aware paths, outline, URL history and sandbox behavior. requestAnimationFrame focus ownership needs browser-aware verification if subsequently changed.

## Proposed independent implementation ownership

Release two workers only after the current Core gate freeze ends; these partitions share no product/test files.

1. Deployment recovery: exact product apps/web/src/features/programs/live-views/deployment-sync.tsx; new tests/deployment-sync-recovery.test.tsx; existing tests/deployment-sync.test.ts only when a source-location assertion must follow truthful moved ownership. Preserve explicit repository mutation confirmation and its captured target/version. Prefer a keyed API-owned workspace and a cohesive read controller local to this view. No automatic polling or mutation retries. Add helpers/barrels only with supervisor release if size warrants it.
2. Docs recovery: exact product apps/web/src/features/programs/live-views/docs.tsx; new tests/docs-recovery.test.tsx; existing tests/docs.test.ts only when source-location assertions must follow a justified extraction. Keep tree/outline helpers and sandbox/history behavior unchanged in the first request-recovery batch; C6 can be a separate exact brief. No generic API, backend, storage or stylesheet changes. If request handling needs a cohesive docs-owned helper directory, obtain exact file ownership before editing it.

Behavioral test requirements: deferred old/new domain reads and mutations; captured stale callbacks refuse requests; same-turn duplicate mutations; fulfilled failure and unexpected rejection release locks; no unmounted publication; same-owner refresh preserves confirmed content and draft/selection; invalid success payload shows failure; acknowledged write followed by failed read retains write outcome; Docs direct-page Retry; same-ID rebuild reloads content; removed selected page reconciles; page loading/error clears when no page remains. Preserve existing contracts and original tests, with no skips or weakened assertions. Root independently verifies worker claims and chooses subsequent full gates.

## Return contract

Changed only this worker report. All findings above are source inspection; no tests ran and no live visual, keyboard, repository mutation or server authorization behavior is certified. No blocked dependency beyond supervisor release of product ownership after frozen Core gates. Highest priorities are domain-owned confirmations/mutations, synchronous mutation locks, honest read recovery and Docs rebuild/page retry semantics.
