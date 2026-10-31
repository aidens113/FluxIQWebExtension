Role: standard worker; gpt-6.1-sol, medium.
Goal: fix t823 setup incident by allowing isolated task creation without an implicit full downstream workspace build.
Root: C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQWebExtension.
Owned: scripts/task/{command-options,command-line,start,run-task}.mjs and owning tests only. Do not touch Core, product/domain/browser sources, shared docs, git.
Add explicit start-only --skip-workspace-build flag, forwarded as skipWorkspaceBuild boolean. Default behavior remains unchanged. Narrow Core library preparation/current-commit guard still runs; only the automatic runPnpm(created.root,["build"]) is skipped. Report result should state whether workspace build ran/skipped, including dry-run output.
The flag must not waive Core currency, dirty/worktree safety, installation or other guards. Reject it on wrong commands as the parser already does.
Meaningful named tests: parser accepts only start; dispatcher forwards; start skips the actual full workspace-build callback while retaining other preparation/checks; default still builds. Use small dependency seam if necessary, no large refactor or fake success stamp.
Do not invoke actual task creation/workspace builds, full suites, APIs, panel/browser, user data or real git mutations. Test fixtures may exercise their usual throwaway repositories.
Run only named affected scripts/task tests. Source Core frozen for current lead builds; your disjoint tooling changes are safe.
Report MAIN downstream reports/codex-1031/shared-clock-narrow-setup.md; include exact commands/results and paths.
Return Outcome, Changed, Validation, Not verified, Report, Notes(max3lines).
