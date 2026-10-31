Role: Standard worker, gpt-6.1-sol, Medium. No spawning/git/shared-doc edits/full suites/provider calls.
Unit: paired task t822, edit ONLY C:/Users/osrs_/FluxStuff/fxwork/t822/!FluxIQWebExtension/domain/src/tests/domain.test.ts.
Must not edit Core (another worker owns classifier), other downstream files, MAIN tree or assertions' intended outcomes.
Cause: this335-line integration entry runs assertions at import time; catalog assertion failed but node:test still reported2488/2488 because none of its assertions were registered. Loader correctly exited1, progress summaries missed it.
Convert all current integration assertions into named node:test cases, split by cohesive subject (recording/mapping, output contracts, bootstrap catalog/harness, runtime/capabilities) rather than one giant callback. Shared pure fixture definitions may remain module-level; no assertions or fallible service work at top level.
Preserve every existing positive/negative assertion, especially missing select/check must mark choose missing and provider-unreachable/no calls. No word swaps or expectation loosening. Split existing packed statements you touch.
Keep disposable service cleanup explicit. Do not introduce default real user data; test narrow runs use isolated roots and fake providers only. No browser.
Read this named file and its direct imports only when needed; read applicable project test placement/validation rules. Do not read broader plans.
Core worker is changing required-terms.ts concurrently in sibling private Core. Do not run/build until lead says its libraries are rebuilt; edit/report ready first.
Acceptance later: owner-script exact filter src/tests/domain.test.ts, domain typecheck and structure audit. Daily full-suite limit used; no whole domain/full repo tests.
Report MAIN docs/working/framework-heavy-lifting-plan/reports/codex-1031/domain-test-reporting.md; short changed/groups/cleanup/remaining-checks.
End Outcome/Changed/Validation/Not verified/Report/Notes. Validation not run while awaiting Core rebuild.
