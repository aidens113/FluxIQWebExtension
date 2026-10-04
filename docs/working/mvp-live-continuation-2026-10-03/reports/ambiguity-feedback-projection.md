# Ambiguity feedback projection

Status: Complete bounded source/test unit; supervisor independent integration/type review pending. Source frozen.
Owner: resume-ab

## Result

TARGET_AMBIGUOUS now retains the typed closed reason target_ambiguous through actual replay feedback. The legacy rejection code target_not_found stays compatible, while the model-facing verdict body includes reason:target_ambiguous and said explicitly describes several matching controls rather than falsely saying only target_not_found. Current failed code, effect flag, action dispatch, permission and missing-target classification remain unchanged.

Only existing typed reasons are projected; no raw failure record, candidate labels, exception prose, selectors or new page content is copied into these fields. No counts are invented: the existing replay facts do not carry resolution counts. Existing authorized failed-page evidence remains governed by its existing producer. Historical B6 raw browser codes remain unretained; its ambiguity classification remains source-derived, not retroactively direct capture.

## Exact source and test partition

- domain/src/runtime/llm-evidence/tool-rejection.ts: add target_ambiguous to the existing runtime closed reason list, which derives WebLlmToolRejectionReason.
- domain/src/runtime/llm-evidence/action-failure/refusal.ts: map raw TARGET_AMBIGUOUS to that reason; leave the legacy rejection code and raw TARGET_NOT_FOUND mapping unchanged.
- domain/src/runtime/llm-evidence/node-run/replay-answer.ts: include existing typed about.resultReason as verdict.reason in both bare and page answers; a private narrow formatter makes ambiguity said truthful.
- domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts: assert distinct closed reason, unchanged genuine missing mapping and absence of injected private failure text.
- domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts: actual runtime wrapper tests at same/different recorded locations, no additional acting commands, ambiguity failed/ok:false/effectApplied:false, truthful model-facing body, redaction and unchanged genuine missing classification.

No barrel change was needed; existing exports already publish the reason union. No Core, extension, gateway wire, budget, target matching or permission source changed.

## Validation ledger

Initial fail-first heavy t262-ambiguity-failfirst:14tests/10PASS/4FAIL, exit1,2066.4009ms. Two intended failures asserted absent target_ambiguous reason; two fixture mistakes used replayed.value instead of the public evidence member. Exact capture.ts execution signature was inspected to correct the fixtures; no production change preceded this result.

Corrected fail-first heavy t262-ambiguity-failfirst-corrected:14tests/12PASS/2FAIL, exit1,2048.5064ms. Both intended assertions fail on undefined reason; genuine same-location missing remembered and different-location missing unreproducible already pass. Production fix followed this result.

Final owning run heavy t262-ambiguity-final:14/14PASS, exit0,1980.5732ms. Actual wrapper ambiguities fail at either location with exactly one rejected web.dom.click and no additional acting command. effectApplied remains false. Genuine same-location missing remains core.replay.remembered; different-location missing remains core.replay.unreproducible. The fixture injects private candidate/selector/exception text into failure.actual and proves none escapes in the returned execution.

This is an esbuild in-memory Node transpilation run against current linked public Core outputs, not a typecheck or generated build. No package checks/builds/Core build/audit/full suite/live/runtime/state/key/shared-doc/git actions. Supervisor owns independent combined gates and any authored architecture/reference updates before another live release. No accepted cart/runtime oracle is claimed.

## Exact rerun command

Run from t262 downstream. The loader transforms TypeScript in memory and resolves existing relative .js/extensionless barrel imports; it writes no generated source or test build.

```powershell
$taskLoader = @'
import {registerHooks,createRequire} from "node:module";import{readFileSync,existsSync}from"node:fs";import{fileURLToPath}from"node:url";const esbuild=createRequire(process.cwd()+"/domain/package.json")("esbuild");registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith(".")&&c.parentURL?.startsWith("file:")){const base=s.replace(/\/$/,"");for(const part of base.endsWith(".js")?[base.slice(0,-3)+".ts"]:[base+".ts",base+"/index.ts"]){const u=new URL(part,c.parentURL);if(existsSync(fileURLToPath(u)))return{url:u.href,shortCircuit:true}}}throw e}},load(u,c,n){if(u.startsWith("file:")&&u.endsWith(".ts"))return{format:"module",source:esbuild.transformSync(readFileSync(fileURLToPath(u),"utf8"),{loader:"ts",target:"es2022",format:"esm"}).code,shortCircuit:true};return n(u,c)}});
'@
$taskImportUrl = 'data:text/javascript,' + [Uri]::EscapeDataString($taskLoader)
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262-ambiguity-final' node --import $taskImportUrl --test domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts
```

## Remaining limits

No paid live run or real browser resolver regression was executed. No lower browser ambiguity record was added to old artifacts. This improves actionable failed-target diagnosis; it does not resolve the prior wrong product/fulfillment, missing exact cart oracle or unfinished Flow. Root review is required before treating this worker's source/test result as integrated.
