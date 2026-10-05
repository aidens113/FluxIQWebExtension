# Project-scoped mounted chat view

Worker resume-ab, 2026-10-03. Status: implemented, source frozen; 98 focused tests and extension typecheck pass. Supervisor/browser verification pending; no live/provider acceptance.

Exact released app owners: chat target/same-thread/chat-panel, conversation controller/thread-requests, view context-line/empty-state-model, shell mount-panel, nearest tests; cohesive project-navigation/{contracts,binding,index,tests/binding.test}. Supervisor additionally released thread-tail.ts and owning tests to validate actual returned thread identity. Composer visual scope gate and project navigation inheritance requested before final freeze; no unreleased source edit.

Support reads needed: background/panel/relay-context.ts (test fixture contract), conversation/thread-tail.ts and composer.ts (scope validation/gating), existing test fixtures target-core/manual-clock/fake-dom and mount-panel-navigation. No broad source/Core discovery.

Fail-first `t262-chat-scope-failfirst` through heavy wrapper with Node/in-memory TypeScript transpilation loader: five controller tests failed (0pass), demonstrating absent project identity/readiness, empty first-Send/stale read/gate contract. Fixtures exercise actual relayConversation with an old browser session project and authorized Core-shaped replies. After changes `t262-chat-scope-tests` six tests passed; added explicit get/answer scope regression; preliminary adjacent seven-file regression check 61 tests passed (dots/exit0). Final worker checks reported below; supervisor rerun recorded in coordinator.

Mounted contract coordinated with CD: extension view window receives `fluxiq:chat-project`, detail exactly `{projectId:string}`. Bounded nonblank ID, no extra fields/instructions; receiver calls ordinary mounted chat.open project target then activates Chat. No globals/arbitrary controller access/recording/reconnect/state patch or forced model capability. Existing relay protocol project overrides/permissions unchanged.

Mounted chat section aria-label Chat with FluxIQ renders data-fluxiq-chat-project and data-fluxiq-chat-scope-state loading/ready/error. Ready follows controller's actual successful authorized project list plus matching thread tail, or authorized empty list. Failed/mismatched/loading scope blocks controller Send; late old-project read cannot publish current ready. New project first Send includes explicit target project, opens its project subject and retains ordinary capabilities. Old projects/threads/data untouched.

No commits/shared docs/builds/full suite/provider/browser/run/profile/store/env/guards. Final report will name exact checks and remaining UI/live proof boundaries.

## Final exact change and released expansions

Additional explicit releases: conversation/composer.ts and owning composer tests; stream/{target-activity,ask-thread}.ts and owning tests; project-navigation/draft-owner.ts/tests plus barrel; thread-tail.ts already released. owner-context.ts and draft-storage ownership inspected read-only, not edited. New owning tests controller-project.test.ts/composer-project.test.ts/project-panel.test.ts; mounted shell-navigation test exercises actual window event receiver and rendered empty-project scope.

Target scope is additive: dedicated project target, plus optional projectId on existing latest/automation/question targets. sameThread includes scope; switching resets current shown/read generation; question/back inherit selected scope only when caller lacks an explicit other project. List/first-open/send/get/answer carry actual scope. Returned list/tail/open mismatches fail; a vanished listed thread is an error, not proof of authorized empty LIST. Loading/error blocks sends/answers and composer; successful empty list enables first message. Existing unscoped behavior remains covered.

Scoped feed excludes unknown/foreign project activity, display and waiting asks; asked target retains actual subject project. Mounted scoped context never publishes unrelated prior activity as new work. Existing unscoped waiting behavior stays; updated one old test fixture's activity project from p to its actual fake-Core project-1 and expected question/back scope accordingly.

Composer draft owner derives selected explicit project plus current remote lease, retaining owner only for same selected project or the already observed remote project's identical draft ownership. This is draft equivalence, not readiness inferred from session. Cross-project unsent text is retained/parked, not adopted or cleared; existing explicit review controls remain. Parked textarea readOnly=true and Send disabled; .composer-draft-review visible. CD's driver also checks that review is hidden before fill. Scope can be ready while a preserved foreign draft prevents sending; that is honest scope plus fail-closed composer, not a false read failure.

Validation: first five actual controller/relay-backed regressions failed before changes. Final initial union 98tests yielded97pass/1fail due old test expecting unscoped Latest after a now scoped question; extension tsc found optional undefined type annotation in compatibility handling. Those exact issues corrected. Final heavy `t262-chat-app-corrected-tests` exit0,98dots; `t262-chat-app-corrected-types` exit0. A mistaken name-filter probe selected no tests and is explicitly not counted as validation. No full suite/build/runtime/provider call.

Tests transpile in memory, CSS imports become empty modules for fake DOM, and extensionless relative TypeScript imports resolve in the Node hook. This does not verify actual CSS, browser realm event delivery, extension lifecycle or paid flow outcomes. Separate tsc supplies compile validation; root must independently rerun and prove actual provider-free extension-view project setup before paid release. App-only source frozen; CD owns separate Lab driver/readiness wiring.

## Exact independent reproduction (run from t262 downstream)

```powershell
$loader = @'
import {registerHooks,createRequire} from "node:module";import{readFileSync,existsSync}from"node:fs";import{fileURLToPath}from"node:url";const ts=createRequire(process.cwd()+"/package.json")("typescript");registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith(".")&&c.parentURL?.startsWith("file:")){for(const part of s.endsWith(".js")?[s.slice(0,-3)+".ts"]:[s+".ts",s+"/index.ts"]){const u=new URL(part,c.parentURL);if(existsSync(fileURLToPath(u)))return{url:u.href,shortCircuit:true}}}throw e}},load(u,c,n){if(u.endsWith(".css")) return {format:"module",source:"export default {};",shortCircuit:true};if(u.startsWith("file:")&&u.endsWith(".ts"))return{format:"module",source:ts.transpileModule(readFileSync(fileURLToPath(u),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return n(u,c)}});
'@
$importUrl = 'data:text/javascript,' + [Uri]::EscapeDataString($loader)
$files = @(
  'apps/extension/src/panel/chat/conversation/tests/controller-project.test.ts',
  'apps/extension/src/panel/chat/conversation/tests/controller.test.ts',
  'apps/extension/src/panel/chat/conversation/tests/controller-recovery.test.ts',
  'apps/extension/src/panel/chat/conversation/tests/target-switch.test.ts',
  'apps/extension/src/panel/chat/conversation/tests/composer-project.test.ts',
  'apps/extension/src/panel/chat/conversation/tests/composer-owner.test.ts',
  'apps/extension/src/panel/chat/conversation/tests/composer-draft.test.ts',
  'apps/extension/src/panel/chat/conversation/tests/composer-keys.test.ts',
  'apps/extension/src/panel/chat/tests/chat-panel.test.ts',
  'apps/extension/src/panel/chat/tests/project-panel.test.ts',
  'apps/extension/src/panel/chat/project-navigation/tests/binding.test.ts',
  'apps/extension/src/panel/chat/project-navigation/tests/draft-owner.test.ts',
  'apps/extension/src/panel/chat/stream/tests/target-activity.test.ts',
  'apps/extension/src/panel/chat/stream/tests/ask-thread.test.ts',
  'apps/extension/src/panel/shell/tests/mount-panel-navigation.test.ts'
)
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262-chat-supervisor-tests' node --import $importUrl --test @files
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262-chat-supervisor-types' pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit
```
