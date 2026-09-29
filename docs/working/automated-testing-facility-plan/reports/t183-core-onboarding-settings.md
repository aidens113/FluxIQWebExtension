# t183-core: onboarding view and AI provider settings

Worker report for brief t183-core (MVP plan 4.2 onboarding, 4.5 user controls).
Tree: Core worktree `C:\Users\osrs_\FluxStuff\fxwork\t183\!FluxIQ`, branch
`task/t183-release-packaging`. Nothing committed.

## Outcome

Done. Both goals are implemented and have tests. The three named checks pass.
The onboarding view is not mounted yet: mounting it needs a file outside my
trees, so the proposed diff is below.

## What changed and why

All paths are under `apps/web/src/features/automation-studio/`.

### Goal 2: settings (`settings/**`)

- **New `settings/ai-provider-model.ts`.** This is the pure model:
  - `AiProviderKeySummary`: a `Pick` of `SecretKeySummary` from `fluxiq/secret-keys` holding id, name, kind, provider, scope, scopeRef and enabled. It never holds a value.
  - `deepSeekKeyAvailability({ keys, loading, error, flowId? })` returns one of these statuses:
    - `ready`: an enabled LLM key exists whose provider normalizes to `deepseek`, and it is global or scoped to this Flow.
    - `missing`
    - `unusable`: the key is disabled or scoped to something else.
    - `loading`
    - `unknown`: the read failed, or `keys === null` because it was never requested. An unread list is never reported as "no key".
  - It reuses `normalizedProviderLabel` from `flow-settings-model.ts`.
  - `aiProviderAdaptationIsOn(draft)` is `adaptationMode !== "no_llm_intervention"`.
  - `applyAiProviderAdaptationSwitch(draft, on)` calls `applyFlowAdaptationMode(draft, on ? "fully_adaptive" : "no_llm_intervention")` and adds no rules of its own.
  - Constants: `AI_PROVIDER_SECRET_KEYS_HREF` (`/programs/secret-keys`, the existing Secret Keys program and its Add Key flow, so there is no second store) and the on and off explanation lines.
  - Off explanation: "Off: runs use only the steps FluxIQ has already learned and never call DeepSeek; if a page has changed, the run stops instead of adapting."
- **New `settings/AiProviderSettingsSection.tsx`.** A controlled section with id `flow-settings-ai-provider`. It shows:
  - The key status notice, with an "Add DeepSeek key" or "Manage keys" link.
  - A model `<select aria-label="AI model">` built from `flowLlmProvider("deepseek").models`, which is Core's `AUTOMATION_STUDIO_DEEPSEEK_MODELS`.
  - A checkbox with `role="switch"` and `aria-label="Adaptation"`, followed by the on or off explanation.
  - If the Flow is in `manual_approval`, the switch reads "on (each change waits for your approval)". Toggling it off and on again sets `fully_adaptive`, as the brief specifies.
  - It does no fetching of its own.
- **`settings/FlowSettingsView.tsx`.** The section now sits in the form:
  - A nav entry "AI Provider" is added after General, and the section renders after the General panel.
  - It reuses the view's existing `llmSecrets`, `llmSecretsLoading` and `llmSecretsError` state, so there is no new request.
  - It passes `keys: null` when there is no project or Flow, because the view never loads keys in that case.
  - The existing "LLM Connection" section is unchanged. Both model selects are bound to the same `draft.llmModel`.
  - The new select is labelled "AI model" so the existing exact-name assertions still hold: exactly one "Model", and exactly two aria-labels starting with "Provider".
- **`settings/settings-model.ts`.** Adds `flow-settings-ai-provider` to the allowed `?settingsSection=` values. The default is still `flow-settings-general`.
- **`settings/index.ts`.** Now exports the two new modules.
- **New tests:**
  - `settings/tests/ai-provider-model.test.ts`: the switch maps to both modes and equals `applyFlowAdaptationMode` output, with no `flowAdaptationErrors`; plus every key-availability status.
  - `settings/tests/AiProviderSettingsSection.test.tsx`: renders the key link without a password input; the model list equals Core's; the model change writes to the draft; the switch goes off and on and shows the off explanation; the section is mounted in `SettingsView` and reachable through `readSettingsSection`.

### Goal 1: onboarding (new `onboarding/**`)

- **`types.ts`:**
  - Steps: `OnboardingStepId` (`runtime`, `pairing`, `deepseek-key`), `OnboardingStepState` (`done`, `current`, `blocked`), `OnboardingStep`, `OnboardingAction` (label, location, optional command or href).
  - Reads: `OnboardingReading<T>` (loading, loaded or failed) and `OnboardingReadings`.
  - Injection: `OnboardingSources` has `loadGatewaySnapshot` and `loadSecretKeys`.
  - Start options: `OnboardingStartOption` and its id type.
- **`onboarding-copy.ts`.** `ONBOARDING_COPY` holds the plan's one-line message word for word and the three start options:
  - Describe an automation (`describe`)
  - Show FluxIQ how (`demonstrate`)
  - Extract data from this page (`extract`)
- **`onboarding-steps.ts`.** `onboardingSteps(readings, nowMs)` is pure. For each step:
  - **Runtime** is done when the gateway snapshot loaded and `webRuntime.clientGatewayListening === true`. The action is `pnpm dev` in the FluxIQ folder. `clientGatewayError`, or a failed read, becomes `problem`.
  - **Pairing** is done when `sessions.length > 0`. If an unconsumed, unexpired pairing request exists, it says a request is waiting in the "Client pairing request" prompt, which is the existing global modal. The code is never read into the output, and a test asserts neither code nor reference appears.
  - **DeepSeek key** is done when `deepSeekKeyAvailability(...)` is `ready`, counting global keys only. The action links to `/programs/secret-keys`.

  Ordering rules:
  - A step whose own condition holds is `done`.
  - The first step that is not done is `current`.
  - Every later unfinished step is `blocked`, with `blockedBy` set to that current step.
  - A later step can therefore show `done` while an earlier one is `current`. For example, a key can exist before pairing.
- **`useOnboardingReadings.ts`.** Reads both sources and keeps a failure as `failed` with its message, including a thrown error. It re-reads on `refresh()` and every `pollMs` until the caller's `isComplete` returns true. `pollMs: 0` reads once.
- **`useOnboardingSources.ts`.** The live sources:
  - Gateway: `useClientGatewayPort().querySnapshot()`, the same `client-gateway-snapshot` read the Connected browsers view uses.
  - Keys: `useProgramApi("secret-keys").get("snapshot")`, the same hook `features/programs/live-views/secret-keys.tsx` uses. It returns summaries only.
- **`OnboardingView.tsx`.** Takes `sources`, `onStart(id)`, optional `onOpenConnectedBrowsers`, `pollMs` (default 5000) and `now`. It shows:
  - An ordered list of steps, each with state, detail and any problem.
  - One action for each unfinished step: its location, plus the command, the Secret Keys link, or an "Open Connected browsers" button when the host supplies the callback.
  - A "Check again" button, then the one-line message and the three start buttons emitting `onStart`.
  - It renders no inputs, codes, tokens or key values.
- **`OnboardingLiveView.tsx`.** `OnboardingView` with `useOnboardingSources()` wired in.
- **`index.ts`.** Barrel for the directory.
- **Tests:**
  - `onboarding/tests/onboarding-steps.test.ts` (9 tests): ordering; all done; `current` then `blocked` with `blockedBy`; a later step done early; key step current and linked; disabled or other-provider keys; failed reads kept as problems; loading; a waiting pairing without exposing its code, and expired pairings.
  - `onboarding/tests/OnboardingView.test.tsx` (5 tests): step states and message rendered; each start option emits its id; the unreachable runtime shows `pnpm dev` and the error; the key link appears with no inputs; "Check again" re-reads and reaches "FluxIQ is ready."; the Connected browsers callback fires.

### Testing library

The brief says "testing-library, as existing settings tests do". The existing settings tests use `react-test-renderer` and `react-dom/server` `renderToStaticMarkup`. `@testing-library/*` is not a dependency of `apps/web`, so I followed the existing tests.

## Mount diffs needed outside my trees (not applied)

The onboarding view has no mount yet. The least invasive option is a new route. `app/**` is not mine, so this is only a proposal and has not been run. It assumes `/programs/automation-studio` is the right destination for all three start options. That is a product decision, and the handoff parameter `start` is invented and nothing reads it yet.

```diff
+++ apps/web/src/app/get-started/page.tsx (new)
+import { redirect } from "next/navigation";
+import { Suspense } from "react";
+import { currentFluxIQUser } from "../../lib/auth";
+import { GetStartedClient } from "./GetStartedClient";
+
+export default async function GetStartedPage() {
+  if (!await currentFluxIQUser()) redirect("/");
+  return <Suspense fallback={null}><GetStartedClient /></Suspense>;
+}
+++ apps/web/src/app/get-started/GetStartedClient.tsx (new)
+"use client";
+import { useRouter } from "next/navigation";
+import { OnboardingLiveView } from "../../features/automation-studio/onboarding";
+
+export function GetStartedClient() {
+  const router = useRouter();
+  return <OnboardingLiveView onStart={(option) => router.push(`/programs/automation-studio?start=${option}`)} />;
+}
```

`useProgramApi` calls `useSearchParams`, which is why the `Suspense` wrapper is there. The other option is a new Automation Studio view kind in `views/canonical-view-definitions.tsx`. That also needs a new `AutomationViewType` in `views/view-types.ts` and registry entries, so I did not draft it.

There is no CSS for the new `automation-onboarding*` classes. The view reuses the existing `automation-runs-workspace`, `button` and `automation-runtime-message` classes. Styling belongs to whoever owns the stylesheet (`app/programs/automation-studio/automation-studio.css`).

The AI Provider section needs no mount. It is already inside `FlowSettingsView`.

## Commands run and observed results

All were run from the Core worktree root, one after another.

1. `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings src/features/automation-studio/onboarding`
   Result: `Test Files 10 passed (10)`, `Tests 66 passed (66)`, Duration 63.44s. The 5 existing settings test files still pass (`settings-view` 15, `settings-round-trip` 14, `flow-settings-call-count` 5, `large-project-behavior` 3, `settings` 3; plus `result-check-settings` 6). stderr showed only the "react-test-renderer is deprecated" notices the existing tests also print.
2. `pnpm --filter @fluxiq/web check` (`tsc --noEmit`)
   Result: no diagnostics, and no ELIFECYCLE error.
3. `node scripts/structure-audit.mjs`
   Result: `structure-audit: passed (195 warning(s), 355 baselined).`, exit 0.
   - Warnings touching my area are advisory only: `settings/: 17 source files is past the 15-file advisory threshold` (the hard cap is 25), and the existing `flow-settings-model.ts: 600 lines` warning.
   - The audit also printed `1 baseline entries can be lowered`. It does not say which entry. As instructed, I did not run `pnpm structure:baseline`.

## Not verified

- No live browser or panel rendering, and no dev server, per the brief. CSS and layout of the new section and view are unseen.
- `useOnboardingSources` against a real server: that the `secret-keys` `snapshot` and `client-gateway-snapshot` reads succeed from a mounted route. Tests inject fake sources.
- The mount diff above has not been applied, compiled or run.
- The full `pnpm check`, `pnpm test` and `pnpm build` were not run.

## Open questions or contradictions found

- The key step counts only global DeepSeek keys, because onboarding is not tied to a Flow. If a person adds only a Flow-scoped key, they see "limited to another scope". Is that the intended product rule?
- The steps are ordered, but the key step does not depend on pairing. It shows `done` early when the key exists, and `blocked` otherwise.
- Flow Settings now shows the model twice: in "AI model" under AI Provider and in "Model" under LLM Connection. Both are bound to the same field. The supervisor may prefer to drop the old one later. I kept it so the existing tests and flows are unchanged.
- The brief's pairing "link to it": the pairing modal is global and opens by itself when a request is pending, so there is nothing to link to directly. The step names the prompt and offers an optional `onOpenConnectedBrowsers` callback, since I found no URL for that view.
