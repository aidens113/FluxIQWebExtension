import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

/**
 * `too-slow` keeps the same late content and takes far longer to produce it.
 * `late-recoverable` is the same lateness inside the runtime's reach, which is
 * what separates a page that is merely slow from one that is too slow.
 */
export type DelayedUiMode = "baseline" | "too-slow" | "late-recoverable";

/**
 * `delayMs` is the seeded baseline delay, unchanged; the armed delay is derived
 * at render time rather than written into the state. `mode` is absent until the
 * fixture is armed, so what an unarmed run publishes is exactly what it
 * published before the variant existed.
 */
export type DelayedUiState = { revealed: boolean; delayMs: number; mode?: DelayedUiMode };

/**
 * How long the armed page takes to produce the late content: far past the
 * recorded 1,000 ms wait; past the 5,000 ms a replayed wait is given, which is
 * its Flow node's default timeout; past the content script's 10,000 ms default
 * for a wait sent with no timeout (`content/action-runtime/waits.ts`
 * `DEFAULT_WAIT_TIMEOUT_MS`); and past the **whole recovery ladder**, which is
 * three of those 5,000 ms waits with 250 ms and 1 s of backoff between them,
 * 16,250 ms in all. So no timeout on either lane can be satisfied by waiting
 * longer, and the replayed wait ends in the extension's own
 * `web.action.timeout`, inside Core's deadline of that timeout plus its 3,000 ms
 * answer margin.
 *
 * It was 20,000 ms, and that stopped being enough the day the per-node retry
 * loop landed. One replayed wait ended at about 6.4 s and the content was
 * comfortably absent; three of them end at about 17.6 s, and the fixture
 * oracle runs after that -- so the reveal at 20 s was landing on the page
 * *between* the last attempt and the oracle, and `late-action-absent` failed
 * on a page that had behaved exactly as designed. Measured on
 * `run-mudjoo3j-2360a304`: three attempts of 5,029 / 5,019 / 5,018 ms, oracle
 * failed. The number has to leave room for the ladder and for the oracle after
 * it, so it is now far enough out that nothing in a run can reach it.
 *
 * The content still arrives. Nothing here reports slowness or refuses to
 * render: this page is slow, in the way an overloaded backend is slow, and a
 * wait that ends before it arrives has genuinely run out of time.
 */
const SLOW_REVEAL_DELAY_MS = 45_000;

/**
 * How long the recoverable page takes: late enough that the first attempt at
 * the wait always runs out, and early enough that the second always catches
 * it.
 *
 * The arithmetic is the whole design, so it is written down rather than tuned.
 * A replayed wait is given its Flow node's default 5,000 ms, whatever the
 * recording asked for, and Core's default retry policy is three attempts with
 * 250 ms, 1 s and 2 s of backoff. Call the gap between the `begin-delay` click
 * and the wait's first dispatch D. Attempt 1 covers [D, D+5,000] and attempt 2
 * covers [D+5,250, D+10,250]. For the content to miss the first and be caught
 * by the second, D + 5,000 < 9,500 <= D + 10,250 -- which holds for every
 * D below 4,500 ms, and a replayed node takes one to three seconds. If the
 * replay ever became fast enough for the first attempt to catch it, the run
 * would still pass its oracle and would fail its recovery declaration, which
 * is the point of declaring the rung rather than only the spend.
 *
 * It sits between the recording's own 1,000 ms wait and `too-slow`'s 20,000 ms,
 * so the three modes are the same page at three speeds: in time, late but
 * within reach, and gone.
 */
const LATE_REVEAL_DELAY_MS = 9_500;

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
      recordingEvents: [{ type: "web.element.clicked", count: 2 }, { type: "web.dom.mutated" }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.wait_for_selector", outcome: "succeeded" }],
      finalState: [{ id: "late-visible", subject: "late-action", predicate: "visible", value: true }],
    },
    variants: [{
      id: "late-recoverable",
      description: "The same content, nine and a half seconds late: the recorded wait runs out once and the runtime's own second attempt catches it, so the run finishes without the model.",
      arm: { operation: "set-mode", payload: { mode: "late-recoverable" } },
      expected: {
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.wait_for_selector", outcome: "succeeded" }],
        finalState: [{ id: "late-visible", subject: "late-action", predicate: "visible", value: true }],
        providerCalls: {
          count: 0,
          because: "The runtime's own second attempt at the wait catches the late content, so the grant a live run takes out must go unspent.",
        },
        recovery: {
          absorbedBy: "retry_node",
          because: "A wait that ran out fails as web.action.timeout, which the domain marks retryable, so the ladder's retry rung attempts the node again and the content has arrived by then.",
          maxAttemptsPerNode: 2,
        },
      },
    }, {
      id: "too-slow",
      description: "The same content, twenty seconds late: the load starts, the recorded wait runs out before the late action exists, and the control the run meant to click is not on the page when the wait ends.",
      arm: { operation: "set-mode", payload: { mode: "too-slow" } },
      expected: {
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.wait_for_selector", outcome: "failed" }],
        finalState: [{ id: "late-action-absent", subject: "late-action", predicate: "exists", value: false }],
        failure: { category: "timeout", code: "web.action.timeout" },
        recovery: {
          absorbedBy: "none",
          because: "Twenty seconds is past every attempt the retry rung has: three five-second waits and 3.25s of backoff reach 16.25s, so the content is still absent when the last one ends.",
        },
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
    const revealDelayMs = state.mode === "too-slow" ? SLOW_REVEAL_DELAY_MS : state.mode === "late-recoverable" ? LATE_REVEAL_DELAY_MS : state.delayMs;
    return page("Delayed UI", `<main><h1>Delayed UI</h1><button data-testid="begin-delay">Load content</button><div data-testid="late-content" aria-live="polite"></div></main>`, `${fixtureClient(context.runToken, "delayed-ui")}
document.querySelector('[data-testid="begin-delay"]').addEventListener('click', () => setTimeout(async () => { await mutate('reveal'); const button = document.createElement('button'); button.dataset.testid = 'late-action'; button.textContent = 'Late action'; document.querySelector('[data-testid="late-content"]').replaceChildren(button); }, ${revealDelayMs}));`);
  },
});

function readMode(payload: unknown): DelayedUiMode | undefined {
  if (!isRecord(payload)) return undefined;
  return payload.mode === "baseline" || payload.mode === "too-slow" || payload.mode === "late-recoverable" ? payload.mode : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
