import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

/** `too-slow` keeps the same late content and takes far longer to produce it. */
export type DelayedUiMode = "baseline" | "too-slow";

/**
 * `delayMs` is the seeded baseline delay, unchanged; the armed delay is derived
 * at render time rather than written into the state. `mode` is absent until the
 * fixture is armed, so what an unarmed run publishes is exactly what it
 * published before the variant existed.
 */
export type DelayedUiState = { revealed: boolean; delayMs: number; mode?: DelayedUiMode };

/**
 * How long the armed page takes to produce the late content: twenty times the
 * recorded 1,000 ms wait, and twice the content script's 10,000 ms default
 * (`content/action-runtime/waits.ts` `DEFAULT_WAIT_TIMEOUT_MS`), so neither the
 * recorded timeout nor the default can be satisfied by waiting longer.
 *
 * The content still arrives. Nothing here reports slowness or refuses to
 * render: this page is slow, in the way an overloaded backend is slow, and a
 * wait that ends before it arrives has genuinely run out of time.
 */
const SLOW_REVEAL_DELAY_MS = 20_000;

export const delayedUiScenario = defineScenario<DelayedUiState>({
  id: "delayed-ui", title: "Delayed UI", startPath: "/scenarios/delayed-ui/",
  seed: 107,
  manifest: createScenarioManifest({
    id: "delayed-ui", title: "Delayed UI", tags: ["wait", "retry"], seed: 107,
    startPath: "/scenarios/delayed-ui/", capabilities: ["mutation"],
    recordingScript: [
      { id: "begin-delay", operation: "click", target: "testid:begin-delay" },
      { id: "await-late-action", operation: "waitForState", target: "testid:late-action", timeoutMs: 1000 },
      { id: "late-action", operation: "click", target: "testid:late-action" },
      { id: "delay-final", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.dom.mutated" }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.wait_for_selector", outcome: "succeeded" }],
      finalState: [{ id: "late-visible", subject: "late-action", predicate: "visible", value: true }],
    },
    variants: [{
      id: "too-slow",
      description: "The same content, twenty seconds late: the load starts, the recorded wait runs out before the late action exists, and the control the run meant to click is not on the page when the wait ends.",
      arm: { operation: "set-mode", payload: { mode: "too-slow" } },
      expected: {
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.wait_for_selector", outcome: "failed" }],
        finalState: [{ id: "late-action-absent", subject: "late-action", predicate: "exists", value: false }],
        failure: { category: "timeout", code: "web.action.timeout" },
      },
    }],
  }),
  createState: seed => ({ revealed: false, delayMs: 75 + Math.abs(seed % 4) * 25 }),
  mutate(state, operation, payload) {
    if (operation === "reveal") return { ...state, revealed: true };
    const mode = operation === "set-mode" ? readMode(payload) : undefined;
    // Arming clears the recording's reveal, so a stale `revealed` can never
    // stand in for the armed run's own outcome.
    return mode ? { ...state, mode, revealed: false } : state;
  },
  render(state, context) {
    const revealDelayMs = state.mode === "too-slow" ? SLOW_REVEAL_DELAY_MS : state.delayMs;
    return page("Delayed UI", `<main><h1>Delayed UI</h1><button data-testid="begin-delay">Load content</button><div data-testid="late-content" aria-live="polite"></div></main>`, `${fixtureClient(context.runToken, "delayed-ui")}
document.querySelector('[data-testid="begin-delay"]').addEventListener('click', () => setTimeout(async () => { await mutate('reveal'); const button = document.createElement('button'); button.dataset.testid = 'late-action'; button.textContent = 'Late action'; document.querySelector('[data-testid="late-content"]').replaceChildren(button); }, ${revealDelayMs}));`);
  },
});

function readMode(payload: unknown): DelayedUiMode | undefined {
  if (!isRecord(payload)) return undefined;
  return payload.mode === "baseline" || payload.mode === "too-slow" ? payload.mode : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
