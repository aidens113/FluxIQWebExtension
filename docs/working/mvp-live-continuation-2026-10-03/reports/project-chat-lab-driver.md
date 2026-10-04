# Project-scoped chat Lab driver implementation

Status: worker source frozen;22 owning tests and narrow Lab typecheck passed. Supervisor integration/actual headed provider-free UI proof pending. Worker resume-cd, 2026-10-03 local.
Brief: `project-chat-lab-driver`. AB owns app receiver/controller/rendering/composer; this worker owns runner changes only. Supervisor additionally released extension-chat-check/index.ts and chat-build/tests/chat-entry.test.ts.

## Changes and contract

Paths relative to packages/test-runner/src:

- extension-chat-check/panel-driver.ts: both trusted page and actual getViews sidepanel drivers expose selectProject/projectScope. Select dispatches **window** CustomEvent `fluxiq:chat-project`, detail exactly `{projectId}`. It reads actual mounted `[aria-label="Chat with FluxIQ"]` attributes `data-fluxiq-chat-project` and `data-fluxiq-chat-scope-state` (loading/ready/error), plus textarea presence/disabled/readOnly and existing `.composer-draft-review` visibility. Foreign parked draft blocks readiness without text read/overwrite/adoption/clear. Empty composer does not require enabled Send; its normal disabled Send-until-text state is allowed.
- extension-chat-check/project-navigation/{driver,index}.ts plus root index.ts: cohesive bounded navigation/read waiter. Validate opaque ID (max256, no whitespace/control) and timeout; navigate once, then poll actual matching ready scope plus available usable composer. Missing receiver/mismatch/error/malformed state fails closed. Deadline bounds navigation/read promises; late read cannot manufacture readiness. No provider/page/private text returned.
- run-scenario/chat-build/creation/readiness.ts: requires the rendered project/read/composer facts; raw recording/session project equality is insufficient.
- run-scenario/chat-build/chat-entry.ts: existing lane authorization first, then actual UI select/read-ready. Before ordinary composer send, recheck actual rendered matching scope and prepared flag. Composer send/text/answer driver behavior remains ordinary; no model capability chosen or direct build call.
- run-scenario.ts: removed premature getStatus/pollStatus project equality gate. Existing pairing, new public project preparation, identity snapshots and lane lifecycle preserved. Final failure still owns creation-context outcomefailed/retained project; no data reset added.
- interactive-session.ts: strict provider-free setup action `chat-project` with extension surface only. Same actual UI driver; no message, instruction, capability, arbitrary evaluate or build argument. Unknown fields/invalid surface/blank or malformed ID/timeout over10000 rejected. Output only action/surface,projectId,scopeState,composerAvailable,composerEnabled; no panel text or URL.

Tests: extension-chat-check/tests/panel-driver.test.ts; project-navigation/tests/driver.test.ts; chat-build/creation/tests/readiness.test.ts; chat-build/tests/chat-entry.test.ts; tests/interactive-session.test.ts. Project driver actual serialized browser function runs against DOM/window fakes for both driver modes; real mounted app receiver/authorized list proof belongs to AB fixtures and supervisor UI verification. Entry fixture tests actual entry/driver call order with a controlled Page.evaluate boundary, not a real browser/Core.

No Core/catalog/new permissions/runtime project wire message/budget change. App contract coordinated directly with AB, including synchronous target/owner reset attrs and parked foreign draft readOnly projection; driver additionally checks existing review visibility defensively.

## Observed validation

- Initial three-owner fail-first:12tests,8passed/4failed. New selectProject missing in both drivers; old readiness accepted raw `{projectId}` without authorized rendered scope; interactive parser rejected chat-project. These were observed before implementation.
- First data-URL loader command had an unescaped apostrophe and failed before loading tests; corrected encoding immediately, no validation claim from that invocation.
- After initial implementation20tests:19pass/1fixture failure. Fake CustomEvent class was compared to a plain record; corrected captured event projection to its type/detail. Narrow typecheck also caught two widened navigate action string literals; changed to literal types with as const.
- Root requested foreign parked-draft boundary: three-owner-file tests (3cases) had2pass/1fail before adding review check, reproducing textarea-enabled despite visible foreign draft review. Added review visibility guard; AB separately adds readOnly. Neither setup path clears/adopts draft.
- Final **22/22 tests PASS in five files**, heavy wrapper b1, exit0,5791ms Node runner duration. Covers loading→empty-ready, mismatch/error/missing/invalid IDs, timeout/late read, actual DOM event in both surfaces, parked draft, stale scope before Send, authorization→selection→read→ordinary Send ordering, closed interactive parser and no-send screened result. Entry/order/helper fixtures were added with implementation and were not separately observed failing before it; do not infer a fail-first result for those cases.
- Final narrow runner `tsc -p tsconfig.json --noEmit` **PASS**, heavy wrapper session2243/exit0. Scoped git diff --check **PASS**. No builds/full suites/provider/browser/runtime launches by worker.

## Reproducible narrow commands

Tests ran through an in-memory TypeScript loader, generating no source/test build artifacts. From downstream paired checkout, initialize once:

```powershell
$taskLoaderSource = @'
import {registerHooks,createRequire} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const ts=createRequire(process.cwd()+'/package.json')('typescript');
registerHooks({
  resolve(s,c,n){if(s.endsWith('.js')&&c.parentURL?.startsWith('file:')){const u=new URL(s.slice(0,-3)+'.ts',c.parentURL);if(existsSync(u))return {url:u.href,shortCircuit:true};}return n(s,c);},
  load(u,c,n){if(u.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(u),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return n(u,c);}
});
'@
$taskLoaderUrl = 'data:text/javascript,' + [Uri]::EscapeDataString($taskLoaderSource).Replace([string][char]39,'%27')
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 chat scope owners final' node --import $taskLoaderUrl --test packages/test-runner/src/extension-chat-check/tests/panel-driver.test.ts packages/test-runner/src/extension-chat-check/project-navigation/tests/driver.test.ts packages/test-runner/src/run-scenario/chat-build/creation/tests/readiness.test.ts packages/test-runner/src/run-scenario/chat-build/tests/chat-entry.test.ts packages/test-runner/src/tests/interactive-session.test.ts
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 chat scope runner types final' pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json --noEmit
```

## Exact provider-free setup action for supervisor

In an already headed interactive session with actual extension panel open:

```json
{"id":"project-ready","action":"chat-project","surface":"extension","projectId":"<actual retained A4 project ID>","timeoutMs":10000}
```

This action sends **no** message. It uses extensionViewPanelDriver against another actual sidepanel/index.html view reached from the extension control page. Interactive session itself does not pair automatically; if preserved profile does not reconnect, supervisor must use ordinary pairing UI first. Do not infer pairing from saved profile/new project metadata. Actual loaded app must include AB receiver/rendering. Unknown project/read error/foreign parked draft aborts before composer mutation. Ordinary explicit adoption/clear, if desired by the user, is outside this setup action and is never automatic.

Supervisor should independently review22fixtures/typecheck, build app/runner after source freeze, launch provider-free headed setup against retained A4 empty project and inspect actual target/read-state/composer plus screenshots. Verify no provider call/new message and old project/draft/thread preservation. Paid live verification follows only separately authorized verified checkpoint; this worker did not launch it. No source expansions beyond approved paths, shared doc/profile/store/env/slot/guard edits, commits or pushes.
