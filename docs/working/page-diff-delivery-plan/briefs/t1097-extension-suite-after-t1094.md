# Brief t1097: the extension tests t1094 left failing on dev

**Goal.** `node apps/extension/scripts/test-extension.mjs` on `dev` (`32beb5fb2`) shows `# tests 4214`, `# pass 4140`,
`# fail 74`. Before t1094 merged there was one failure: "no extension source calls URL.canParse…", in
`content/identity/destination`, which is older and not yours.

t1094 ("a step waits for the page to be usable, and a press is answered only by work it caused") changed:
- `runtime/automation-tab.ts` and `runtime/navigation-events/page-work.ts`;
- `page-world/page-work/**` and the new `page-world/work-cause/**`;
- `page-world/press-work/**` and `page-world/request-starts.ts`;
- `content/action-runtime/page-work/**` and `content/action-runtime/ignored-press/**`;
- `shared/scheduled-work-*`.

Its worker ran only the tests in the folders it changed, never the tests that import them.

Most failures read `error: "The argument 'methodName' must be a method. Received undefined"`
(`ERR_INVALID_ARG_VALUE`), for example `runtime/tests/click-landing-new-tab.test.ts`.
- That is `mock.method` asked for a function that no longer exists.
- That file passes alone (8 of 8) but fails in the full run. So a mocked member is missing, renamed or shared across
  files, or an earlier test leaves a global patched (`setTimeout`, `fetch`, `chrome.*`, a page-world hook) and never
  restores it.

The full list is in
`C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad/devext.log`
(`grep '^not ok'`).

**For every failing test, decide which is wrong:**
- **The test,** if it pins a mocked name or behaviour t1094 replaced on purpose. Update it to the new contract and keep
  what it proves.
- **The product,** if t1094 broke behaviour the test rightly pins: new-tab landings, 429 and 503 rate limits, going
  back, a type that sends nothing, and so on. Fix the product at its cause.
- **A leaked global,** if an earlier test leaves one patched. Make that test restore it.

Never weaken an assertion, skip a test, or delete one without naming the change that superseded it.

**Owned.** `apps/extension/src/**` and its tests, in `C:/Users/osrs_/FluxStuff/fxwork/t1097` (branch
`task/t1097-extension-suite-after-t1094`).

**Must not touch.**
- `apps/extension/src/panel/**` and `background/**`: t1095, which merges next. If a failure is there, report it
  instead.
- Core, and `domain/src/**`.

**Checks** (put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1097-<label> -- <cmd>`):
- the full `node apps/extension/scripts/test-extension.mjs` ends with only the one older URL.canParse failure. Show
  the count lines;
- the page-readiness content-harness specs t1094 added still pass;
- `pnpm run check` in `apps/extension`;
- `node scripts/structure-audit.mjs`. Group test files by a shared prefix; never make a group of one file.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1097.md` in the worktree, ending with the return contract.
State which failures were the test, which the product, and which a leaked global.
