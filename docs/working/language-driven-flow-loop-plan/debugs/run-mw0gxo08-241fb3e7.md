# Debug: run-mw0gxo08-241fb3e7

## Result

The everything-store live run failed at startup, before any browser step or model call. Core's web panel did not build.

## Evidence

- Run: `run-mw0gxo08-241fb3e7`
- Scenario and task: `everything-store`, `everything-store-kettle-to-cart`
- Pair: Core `599a96c7a`, extension `10976d288`, both on `task/t845-studio-controller`
- Failure: `process.startup`, "Core web panel production build did not succeed"
- Provider calls: 0. Cost: $0
- Build log: `Turbopack build failed with 3 errors`, each `You're importing a component that needs useRef / useState / useSyncExternalStore` in `apps/web/src/features/automation-studio/parameters/ParameterEditor.tsx` and `views/view-readiness.ts`

## Cause

Not the machine. `apps/web/src/app/programs/automation-studio/chat/page.tsx` is a server component and imports the `features/chat-widget` barrel, added by t846. The components behind that barrel are marked `"use client"`, but the barrel also exports the chat transport and activity port, which import the `automation-studio/conversation` barrel. That put the panel's client-only React code in the server graph.

Type checks and tests cannot see this, and the chat lane's report said `web:build` had not been run. The standalone `pnpm build` on the same commit failed with the same three errors.

## Fix

Core `63f0780b7` marks `features/chat-widget/index.ts` with `"use client"`, as other barrels in `apps/web` do. `pnpm build` then passed, with `/programs/automation-studio/chat` in the route list.

## Next action

Rerun the task once the Lab's relaunch window has passed. This failure says nothing about the build loop, because the run never reached it.
