# A6 accepted PRESENT runnable metadata

Status: Complete implementation; source/tests frozen; supervisor independent review pending.
Owner: resume-ab
Scope: downstream domain/src/runtime/llm-evidence/node-run/verify.ts and tests/replay-verify.test.ts only. Core read-only; supervisor owns combined consumer validation and live release.

## Current State

The actual runtime wrapper accepts both missing and withdrawn current targets on their recorded page as PRESENT, but omits its already-resolved runnable declaration. Core correctly discards old arguments when accepted replacement metadata is absent. This unit preserves authoritative current metadata without executing the act, borrowing historical proof, or weakening whole-Flow testing.

Fail-first: heavy wrapper label t262-present-metadata-failfirst, Node in-memory TypeScript hooks, exact replay-verify.test.ts owner. Observed15tests/13PASS/2FAIL, exit1,4270.1087ms. Both new accepted PRESENT cases failed because draft.ranWith.node was undefined rather than web.output.dom-click. Negative declined/unresolved cases already passed. No production edit before that result.

Tests use the actual createWebAutomationLlmEvidenceRuntime.executeTool wrapper: capture a snapshot, obtain its current handle, check that handle, and require normalized selector #other with no raw target handle. They also assert effectApplied false and no web.dom.click dispatched. Negative cases cover different-page missing/withdrawn, enclosed target, unknown handle and malformed parameters. Existing VERIFIED and unchanged-parameter behavior is retained.

## Validation and remaining coverage

The minimal acceptedPresent helper now attaches the already-resolved declaration only to PRESENT outcomes at both missing/withdrawn branches. It leaves other outcomes unchanged and supplies no raw input fallback. Existing unchanged-parameter VERIFIED behavior remains unchanged.

Post-fix nearest owner run: heavy label t262-present-metadata-final,15/15PASS,exit0,3034.5899ms. Own source/test frozen before and during the check. git diff --check passed for both owners. verify.ts218lines; replay-verify.test.ts278lines. Exact partition remains two source/test files plus this report; no Core edits.

No build/types/full suite/provider/browser/live/commit/state or shared-document edits. Existing Core rerun-check/dry-run tests were inspected only; no downstream import of Core internals. No combined producer-to-Core test or live acceptance claim. Supervisor owns combined contract checks, types/structure and subsequent separately guarded live validation.

## Exact independent reproduction

Run from t262 downstream. This transpiles TypeScript in memory, resolving relative .js and extensionless directory imports; it writes no generated test build. It uses current linked Core public package outputs for runtime imports and is not a typecheck.

```powershell
$taskLoader = @'
import {registerHooks,createRequire} from "node:module";import{readFileSync,existsSync}from"node:fs";import{fileURLToPath}from"node:url";const ts=createRequire(process.cwd()+"/package.json")("typescript");registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith(".")&&c.parentURL?.startsWith("file:")){const base=s.replace(/\/$/,"");for(const part of base.endsWith(".js")?[base.slice(0,-3)+".ts"]:[base+".ts",base+"/index.ts"]){const u=new URL(part,c.parentURL);if(existsSync(fileURLToPath(u)))return{url:u.href,shortCircuit:true}}}throw e}},load(u,c,n){if(u.startsWith("file:")&&u.endsWith(".ts"))return{format:"module",source:ts.transpileModule(readFileSync(fileURLToPath(u),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return n(u,c)}});
'@
$taskImportUrl = 'data:text/javascript,' + [Uri]::EscapeDataString($taskLoader)
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262-present-metadata-final' node --import $taskImportUrl --test domain/src/runtime/llm-evidence/node-run/tests/replay-verify.test.ts
```
