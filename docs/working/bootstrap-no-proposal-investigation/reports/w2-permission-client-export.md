# w2-permission-client-export

Status: browser-safe public Core subpath implemented and focused validation passed; the production bundle compiled successfully but its command could not complete final trace writing while the user-managed port-3000 dev server held the same `.next` directory.

## Core public seam

Core now publishes `fluxiq/automation-studio/action-permissions` from the dedicated `runtime/action-permissions/client` barrel. Its value surface is deliberately limited to:

- `AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES`;
- `parseAutomationStudioActionPermissionRequest`;
- the erased `AutomationStudioActionPermissionRequest` type.

It does not export the permission gate, declarations, instructed authority, services, storage, or the Node-oriented Automation Studio barrel. The Core package-boundary architecture note records that invariant.

`BlankFlowAuthoringPanel.tsx` now imports this public package subpath. It no longer reaches from `apps/web` into `packages/fluxiq/src`. Permission parsing, consequence wording, state, and UI behavior are unchanged.

## Validation

- New focused export/browser-safety test: 3/3 passed. It pins the manifest target, the requested public values, strict-parser availability, and absence of Node/package/gate/service/storage runtime dependencies in the small closure.
- Core `fluxiq` type-check: passed.
- Core `fluxiq` build: passed with a 4 GB Node heap after the first compiler process terminated abnormally on Windows.
- Built-package import from the web application: resolved the new subpath and both runtime exports successfully.
- Focused authoring panel tests: 17/17 passed, including strict permission parsing/revalidation behavior.
- Production Next web build: source compilation, type validation, all 16 static pages, page optimization, and route output completed with no server-module/browser-bundle resolution error. The command then exited on `EPERM` opening `apps/web/.next/trace`. A retry blocked on the same generated directory and was stopped without stopping the dev processes. Because the user-managed port-3000 Next dev server runs from this exact Core worktree, the build's clean/rewrite of shared `.next` artifacts disrupted that server and it began returning HTTP 500. The supervisor was notified immediately and owns restoring the already-authorized shared panel. No further build or `.next` operation was made.

No provider or browser call was made. No downstream product source, permission semantics, UI behavior, user state, or port 3000 was changed. No commit or push.
