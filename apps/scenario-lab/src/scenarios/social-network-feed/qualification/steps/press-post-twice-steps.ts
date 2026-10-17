import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/** The composer's Post button swallows its first press, so the honest path presses, waits for it to stop spinning, and presses again. */
export function pressPostTwiceSteps(prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-press-post`, operation: "click", target: "role:button:Post" },
    { id: `${prefix}-post-ready-again`, operation: "waitForState", target: "[aria-label=\"Post\"]:not([aria-busy])", timeoutMs: 3000 },
    { id: `${prefix}-press-post-again`, operation: "click", target: "role:button:Post" },
  ];
}
