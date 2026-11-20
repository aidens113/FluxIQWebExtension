# t905 merge review

No actionable semantic regression found in the scoped conflict/integration surfaces of merge `fc52630e6`.

## Source confirmations

- `packages/test-runner/src/attempt-lane/scripted-model/scripts/company-website-apprentices.ts:9` preserves the exported `COMPANY_WEBSITE_COVERS` required by the Saturday script (`company-website-saturday-certificate.ts:17`, used at line 98). Compared with the incoming parent, this file differs only by exporting/renaming that cover constant and its loop reference; incoming relative batch scrolling, waiting, failed-read repair, and successful-read checks remain intact.
- `company-website-apprentices.ts:38` retains the lane's read provenance checks: success metadata, nonempty rows, matching original call ID/group, and matching held read rows in the current view. Its decision uses that gate at line 64. The reviewed tests include real Core current-view projection plus missing/mismatched provenance cases.
- `packages/test-runner/src/attempt-lane/scripted-model/scripts/index.ts:12` retains the shared evidence helper/type exports. Lines 19–20 register Saturday and bigbox once each; all existing registrations remain. This index and the Saturday script are unchanged against the first parent.
- `packages/test-runner/src/extension-chat-check/view-target-press/in-panel-target.ts:34` retains the two-argument helper, scroll planning at line 60, and event/geometry observations. Its first-parent merge delta removes only a blank trailing line. The caller at `press-in-view-target.ts:90` supplies the serialized scroll planner, matching the retained signature.

## Proposed narrow checks (not run)

- `pnpm --filter @fluxiq-web-extension/test-runner check`
- After the lead's current build, `node --test "packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/company-website-apprentices.test.js" "packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/company-website-saturday-certificate.test.js" "packages/test-runner/dist/extension-chat-check/tests/panel-driver-press.test.js"`
- Run the repository structure audit as the merge gate. Browser delivery and four-attempt continuation remain separate acceptance evidence.

Outcome: Done
Changed: docs/working/mvp-launch-plan/reports/codex-t905-merge-review.md
Validation: `git diff fc52630e6^1 fc52630e6 -- <focused paths>` and `git diff fc52630e6^2 fc52630e6 -- <focused paths>` -> inspected both parent deltas; no dropped dependency/export or duplicate registration found.
Not verified: No tests, builds, browser runs, git mutations, or Core inspection performed, per brief. This is a review of the named integration surfaces, not the full 130-file host change.
Report: docs/working/mvp-launch-plan/reports/codex-t905-merge-review.md
Notes: Source and shared documents were not edited. The lead must run acceptance checks itself.
