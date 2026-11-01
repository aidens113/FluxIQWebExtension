Role: Light mechanical worker; gpt-6-luna high; t840-native-paging-proof.
Worktree C:/Users/osrs_/FluxStuff/fxwork/t840-native-paging-proof only.
Goal: Register the real activity status pill's closed shadow host in the new private ownership registry, without changing UI behavior.
Read: apps/extension/src/content/owned-ui/{index,hosts}.ts; content/activity-overlay/status-pill.ts buildNodes; its tests/status-pill.test.ts and tests/fake-dom.ts only as needed.
Owned: apps/extension/src/content/activity-overlay/status-pill.ts; tests/status-pill.test.ts; tests/fake-dom.ts; report ui-registration.md besidebrief only.
Must not touch owned-ui registry, observer/settlement production/tests, Domain/Core, shared workingdocs, manifests, git, Lab state, provider/browser. No agents.
STABLE API: import {ownedUiHosts} from '../owned-ui'; after actual root=host.attachShadow({mode:'closed'}) call ownedUiHosts.registerClosed(host,root) BEFORE host is appended. It stores exact host identity; ownsHost requires empty light DOM. No DOM attribute grants ownership.
Update fake DOM only to model native shadow.host/shadow.mode and firstChild needed by registry. Existing UI tests must still pass. Add meaningful test that actual StatusPill.host() is registered, DOM lookalike/copy is not; do not cast/erase types just to pass.
This phase CLASSIFIES own-UI mutation for diagnostics only; do not suppress page mutations, change safety/retries, alter UI layout or add model authority.
Run narrow `node apps/extension/scripts/test-extension.mjs content/activity-overlay/tests/status-pill.test` with unique EXTENSION_TEST_BUILD_LABEL. No whole package/full suite/types/build/provider/browser. Root runs final validation.
All tests provider-free, synthetic DOM no real data. Never print secrets/raw state, never modify .env.local or user .clinerules.
No packed statements/trailing whitespace/baseline changes. Freeze source and report exact command/result.
Return Outcome/Changed/Validation/Not verified/Report/Notes(max3lines).
