import type { ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";
import type { PersonTab } from "../tab.js";

/** A tab that shows what the test says, and records what the person did to it. `onStep` plays the page's answer to each step. */
export class FakeTab implements PersonTab {
  readonly done: string[] = [];
  loadCount = 0;
  constructor(public showing: string[], private readonly onStep: (step: string, tab: FakeTab) => void = () => undefined, private readonly failOn?: string) {}
  async shows(text: string): Promise<boolean> { return this.showing.includes(text); }
  loads(): number { return this.loadCount; }
  async settle(): Promise<void> { this.done.push("settle"); }
  async front(): Promise<void> { this.done.push("front"); }
  async click(text: string): Promise<void> { this.step(`click ${text}`); }
  async pressAndHold(text: string, holdMs: number): Promise<void> { this.step(`hold ${text} ${holdMs}`); }
  async typeInto(label: string, value: string): Promise<void> { this.step(`type ${label}=${value}`); }
  async pressButton(name: string): Promise<void> { this.step(`press ${name}`); }
  /** The page loading a new document that shows `showing`. */
  load(showing: string[]): void { this.loadCount += 1; this.showing = showing; }
  private step(step: string): void {
    if (this.failOn !== undefined && step.startsWith(this.failOn)) throw new Error(`locator failed: ${step}\n  <div class="x">page markup the record must not carry</div>`);
    this.done.push(step);
    this.onStep(step, this);
  }
}

/** A clock the person's waits advance, so a test of a ten-second wait takes no time. */
export function virtualClock(): { now: () => number; sleep: (ms: number) => Promise<void>; at: () => number; onTick: (hook: (at: number) => void) => void } {
  let at = 0;
  const hooks: Array<(at: number) => void> = [];
  return {
    now: () => at,
    sleep: async (ms) => { at += ms; for (const hook of hooks) hook(at); },
    at: () => at,
    onTick: (hook) => { hooks.push(hook); },
  };
}

/** A store whose check is read and typed, as the everything store's is. */
export const TYPED_CHECK: ScenarioPersonChecks = {
  scenarioId: "everything-store",
  checks: [{ id: "type-the-characters", description: "type what the image shows", shows: "Enter the characters you see below", steps: [{ action: "type-answer", label: "Type characters" }, { action: "press", button: "Continue shopping" }], clears: "navigation", clearsWithinMs: 8_000 }],
  handOffs: [{ workflowId: "first-page-earbuds", variantId: "robot-check", person: "completes", required: true, because: "The store answers every page with its check until a person passes it." }],
  answer: (state) => `CODE-${(state as { image: number }).image}`,
  tampered: (state) => ((state as { wrong: number }).wrong > 0 ? "a guess was typed" : null),
};

/** A traffic screen whose box turns into "Checking your browser…" at once and reloads later, as crossborder's does. */
export const CLICKED_CHECK: ScenarioPersonChecks = {
  scenarioId: "crossborder-marketplace",
  checks: [{ id: "traffic-screen", description: "press the box", shows: "I'm not a robot", steps: [{ action: "click", text: "I'm not a robot" }], clears: "navigation", clearsWithinMs: 10_000 }],
  handOffs: [],
};
