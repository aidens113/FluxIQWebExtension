# C judge paging evidence â€” worker implementation

## Current State

Bounded Core unit implemented and source/tests frozen for supervisor verification under written c-judge-paging-evidence brief. No live/provider/browser/build/store/env/profile/guard/shared-document/commit operations. Source is only read-account/judge-paging.ts,index.ts,sentence.ts,page-bound-sentence.ts,pages-clause.ts and result-verification/verify.ts; raw accounts/stop semantics unchanged.

## Fail-first evidence

Heavy wrapper from paired t262 Core: pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/tests/judge-sees-the-read.test.ts. Exit1, four new actual judge-request cases failed / five existing tests passed. New cases cover control_disabled+untruncated, page_limit+truncated, unknown rate_limited, contradictory control_disabled+truncated; no paging field was carried before implementation.

## Implementation

Projection runs only on the provider request copy after existing unread-column annotation. Consistent explicitly observed end, untruncated with plausible positive counts and no contradictory nonpaging declaration, shares existing sentence wording and omits the authored pageLimit on that copy. Raw summary/account, action attempts, verdict and repair evidence are unchanged.

The limit/truncation warning remains for real bound termination. Unknown/absent stop and contradictory metadata never get an all-pages claim or omission of the bound. First-page control_absent stays uncertain because existing sentence says a control naming nothing could produce that observation. Truncated end-of-list word, pages beyond authored limit, no pages, or paginates:false contradiction retain raw facts with short uncertainty wording. Projection does not decide result correctness or change pagination default1.

The existing pages clause and unchanged page-bound sentence now live in focused pages-clause.ts/page-bound-sentence.ts, one export each, reexported through read-account/index.ts. sentence.ts and judge-paging.ts consume those seams; original main sentence outputs/classifier behavior stay unchanged. No prompt grammar owner edited.

## Owning test command

& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 C paging owners' pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/read-account/tests/judge-paging.test.ts src/programs/automation-studio/runtime/result-verification/tests/judge-sees-the-read.test.ts src/programs/automation-studio/runtime/result-verification/read-account/tests/accounts.test.ts src/programs/automation-studio/runtime/result-verification/read-account/tests/sentence.test.ts

Paired t262 Core cwd; session3310 exited0: four files /51tests passed,12.01s. Scoped tracked-owner git diff --check exited0. Initial source-ready signal sent to supervisor for independent types/audit/checks; subsequent correction/typecheck ledger below supersedes initial readiness. Unit fixtures also pin raw copy immutability, actual observed-end variants, true page truncation and all uncertainty boundaries. No whole suite.

## Interface and verification boundary

Provider-facing reads gain a paging string; only a consistent observed-end provider copy omits pageLimit. Durable/public raw read-account shape remains unchanged; no new execution/proof fields, permissions, calls, budget or automatic action. Existing prompt receives closed counts/stop wording rather than a changed verdict. No real C13record/52field build, browser oracle, resultjudge verdict, saved playback/reuse or repair acceptance verified here. Supervisor independently tests/types/audits/builds before live release.

## Return contract

Changed only six Core source owners and two tests named above; approved accounts/sentence owning tests ran unchanged as compatibility coverage. No commits/push/builds/runtime/provider/live. Worker pass is a claim for independent supervisor verification; pending live C13/52 and unchanged saved-Flow reuse remain explicit.


## Independent review and final correction ledger

Supervisor independently observed51tests/audit pass, but Core typecheck rejected test cases assigning stop:undefined under exactOptionalPropertyTypes; supervisor also identified sentence.ts exporting three things despite the one-exported-thing structure rule. Those were real readiness defects, corrected in this work.

- Missing-stop test cases now construct a truly omitted stop property by destructuring, without casts to conceal invalid fixture fields.
- Shared wording extracted intact into approved focused page-bound-sentence.ts/pages-clause.ts and connected through the existing barrel to sentence and judge; no discarded callers, no duplicate wording/classifier. All three wording owners each export one function.
- Exact four-owner command rerun through heavy wrapper t262 C split paging owners: session99250 exited0,51tests/4files passed,15.47s. Scoped git diff --check exited0.
- Authorized coordinated Core typecheck: & 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 C paging Core types' pnpm --filter fluxiq check, cwd paired Core; session16725 exited0; actual tsc28.472s, no errors. Root notified checks exited and source remains frozen. No build/provider/live launch.
- Source/tests final and frozen while typecheck/report completes; supervisor still owns independent integration/audit/build/live release.
