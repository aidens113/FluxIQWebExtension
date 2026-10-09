// The Lab's person pressing a run control in the extension's real panel:
// Stop ("Stop run", "Stop build", or "Stop" before Core names the work),
// Take over (a working run) and Hand back (a run held for the person). Stop,
// pause and resume must be pressed where a person presses them, so the Lab
// drives the panel's own buttons rather than calling Core.
//
// A press waits, bounded, for the button to be on screen and enabled: the
// first attempt plus 3 retries, each with its own actionability wait. It never
// throws a raw Playwright error: a control that did not show, stayed disabled,
// or could not be read is a typed refusal. "At step N" waits first for the
// chat's live line (`.chat-live-step`, "Step N", "Step N of M", "Step N:
// label", `panel/chat/view/step-text.ts`) to show step N or later, or for the
// caller's own predicate.
//
// What is recorded is the Lab's closed words, the control's name as the panel
// spells it, step numbers and times: nothing else a page showed.

import type { Page } from "@playwright/test";

/** The run controls the Lab's person presses in the panel. */
export type PanelRunControl = "stop" | "takeOver" | "handBack";

/**
 * Each control's accessible names, exactly as the panel spells them, in the
 * order they are tried. Stop's name follows the work: "Stop run" for a run
 * (the chat and the Automations strip), "Stop build" for a build, and "Stop"
 * while the send says "Starting…" and Core has named no work yet.
 */
export const PANEL_RUN_CONTROL_NAMES: Readonly<Record<PanelRunControl, readonly string[]>> = Object.freeze({
  stop: Object.freeze(["Stop run", "Stop build", "Stop"]),
  takeOver: Object.freeze(["Take over"]),
  handBack: Object.freeze(["Hand back"]),
});

/** Where the bundle keeps every press of the run, relative to its root. */
export const PANEL_RUN_CONTROLS_SNAPSHOT = "snapshots/panel-run-controls.json";

/** One button the panel shows, by its exact name. */
export type PanelButtonState = Readonly<{ name: string; enabled: boolean }>;

/**
 * The panel as the press reads and presses it. `pagePanelRunControlSurface`
 * drives a panel page Playwright was handed (the Firefox popup, a docked
 * popup); `extensionViewPanelRunControlSurface` drives Chrome's real side
 * panel from the run's extension control tab, as the chat entry does.
 */
export type PanelRunControlSurface = {
  /** A visible button named exactly one of `names`, an enabled one first; null when none shows. */
  find(names: readonly string[]): Promise<PanelButtonState | null>;
  /** Presses the visible, enabled button named exactly `name`; false when none was there to press. */
  press(name: string): Promise<boolean>;
  /** The step the chat's live line shows, or null when it shows none. */
  liveStep(): Promise<number | null>;
};

/**
 * Why a press did not happen.
 *
 * - `step-not-reached`: the live line (or the caller's predicate) never showed the step in time.
 * - `not-shown`: no button of the control's names showed in any attempt.
 * - `disabled`: the button showed but stayed disabled.
 * - `press-lost`: the button showed enabled, and was gone when pressed, in every attempt.
 * - `panel-unreadable`: every read of the panel failed (no panel view, a closed page).
 */
export type PanelRunControlRefusal = "step-not-reached" | "not-shown" | "disabled" | "press-lost" | "panel-unreadable";

/** One press, or refusal, as the run's evidence records it. */
export type PanelRunControlPress = Readonly<{
  control: PanelRunControl;
  pressed: boolean;
  /** The exact name pressed; `null` when refused. */
  name: string | null;
  refusal: PanelRunControlRefusal | null;
  /** The step the caller asked to press at, or `null` for at once. */
  atStep: number | null;
  /** The step the live line showed when the press was made or refused; `null` when it showed none. */
  stepSeen: number | null;
  /** Attempts made at the button (at most 1 + retries); 0 when the step never came. */
  attempts: number;
  /** When the button was pressed (ISO time); `null` when refused. */
  pressedAt: string | null;
  /** From the call to the press or the refusal, to a tenth of a second. */
  secondsWaited: number;
  /** The Lab's own reason for a refusal or a failed publish, bounded; never page text. */
  note: string | null;
}>;

export type PressPanelRunControlInput = {
  surface: PanelRunControlSurface;
  control: PanelRunControl;
  /**
   * Press once the live line shows this step or a later one. "Press Stop at
   * step 2" is `atStep: 2`; "take over before step N" is `atStep: N - 1`,
   * since the run holds at the next node boundary.
   */
  atStep?: number;
  /** The caller's own readiness, checked with `atStep` when both are given; for work whose live line shows no step. */
  when?: () => Promise<boolean>;
  /** Bound on the wait for the step; 120 s by default. */
  stepWaitMs?: number;
  /** Each attempt's wait for the button to show enabled; 5 s by default. */
  attemptWaitMs?: number;
  /** Retries after the first attempt; 3 by default, as every Lab action. */
  retries?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Puts the press on the run's timeline. A failure is kept in the press's `note`, never thrown. */
  publish?: (press: PanelRunControlPress) => Promise<unknown>;
};

const STEP_WAIT_MS = 120_000;
const ATTEMPT_WAIT_MS = 5_000;
const RETRIES = 3;
const POLL_MS = 250;
const PRESS_MS = 5_000;
const MAX_NOTE = 200;
const LIVE_STEP = ".chat-live-step";

/** Presses one run control in the panel, as the person would, and says what was pressed and when. Never throws for the panel. */
export async function pressPanelRunControl(input: PressPanelRunControlInput): Promise<PanelRunControlPress> {
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const poll = input.pollMs ?? POLL_MS;
  const started = now();
  const names = PANEL_RUN_CONTROL_NAMES[input.control];
  const atStep = input.atStep ?? null;
  let stepSeen: number | null = null;
  let readFailure: string | null = null;
  const readStep = async (): Promise<number | null> => {
    try {
      stepSeen = await input.surface.liveStep();
    } catch (error) {
      readFailure = `reading the live line failed: ${firstLine(error)}`;
    }
    return stepSeen;
  };
  const finish = async (fields: Pick<PanelRunControlPress, "pressed" | "name" | "refusal" | "attempts" | "note">): Promise<PanelRunControlPress> => {
    const at = now();
    let press: PanelRunControlPress = Object.freeze({ control: input.control, ...fields, atStep, stepSeen, pressedAt: fields.pressed ? new Date(at).toISOString() : null, secondsWaited: Math.round((at - started) / 100) / 10, note: bounded(fields.note) });
    if (input.publish) {
      try {
        await input.publish(press);
      } catch (error) {
        press = Object.freeze({ ...press, note: bounded([press.note, `publishing the press failed: ${firstLine(error)}`].filter(Boolean).join("; ")) });
      }
    }
    return press;
  };

  if (atStep !== null || input.when) {
    const deadline = started + (input.stepWaitMs ?? STEP_WAIT_MS);
    for (;;) {
      const reached = (atStep === null || ((await readStep()) ?? 0) >= atStep) && (await ready(input.when, (reason) => { readFailure = reason; }));
      if (reached) break;
      if (now() >= deadline) return finish({ pressed: false, name: null, refusal: "step-not-reached", attempts: 0, note: readFailure ?? `the panel did not reach ${atStep === null ? "the caller's moment" : `step ${atStep}`} within ${Math.round((input.stepWaitMs ?? STEP_WAIT_MS) / 1000)} s` });
      await sleep(poll);
    }
  }

  const attempts = 1 + Math.max(0, input.retries ?? RETRIES);
  let sawDisabled = false;
  let sawEnabled = false;
  let readOk = false;
  let probeFailure: string | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const deadline = now() + (input.attemptWaitMs ?? ATTEMPT_WAIT_MS);
    for (;;) {
      let shown: PanelButtonState | null = null;
      try {
        shown = await input.surface.find(names);
        readOk = true;
      } catch (error) {
        probeFailure = `reading the panel failed: ${firstLine(error)}`;
      }
      if (shown?.enabled) {
        sawEnabled = true;
        let pressed = false;
        try {
          pressed = await input.surface.press(shown.name);
        } catch (error) {
          probeFailure = `pressing ${shown.name} failed: ${firstLine(error)}`;
        }
        if (pressed) {
          if (atStep !== null) await readStep();
          return finish({ pressed: true, name: shown.name, refusal: null, attempts: attempt, note: null });
        }
        break;
      }
      if (shown) sawDisabled = true;
      if (now() >= deadline) break;
      await sleep(poll);
    }
  }
  const refusal: PanelRunControlRefusal = !readOk ? "panel-unreadable" : sawEnabled ? "press-lost" : sawDisabled ? "disabled" : "not-shown";
  const reason = refusal === "disabled" ? `the panel showed ${names.join(" / ")} but kept it disabled` : refusal === "not-shown" ? `the panel showed no ${names.join(" / ")} button` : refusal === "press-lost" ? `${names.join(" / ")} was gone each time it was pressed` : "the panel could not be read";
  return finish({ pressed: false, name: null, refusal, attempts, note: [reason, probeFailure].filter(Boolean).join("; ") });
}

/** Every press of a run, kept for the bundle's `PANEL_RUN_CONTROLS_SNAPSHOT`. */
export function panelRunControlLog(): { add(press: PanelRunControlPress): void; snapshot(): Readonly<{ presses: readonly PanelRunControlPress[] }> } {
  const presses: PanelRunControlPress[] = [];
  return {
    add: (press) => { presses.push(press); },
    snapshot: () => Object.freeze({ presses: Object.freeze([...presses]) }),
  };
}

/** A panel page Playwright drives, by role and exact accessible name, as the Lab presses "Start recording". */
export function pagePanelRunControlSurface(page: Page): PanelRunControlSurface {
  const visibleButton = async (name: string, enabledOnly: boolean) => {
    const buttons = page.getByRole("button", { name, exact: true });
    const count = await buttons.count();
    let disabled: PanelButtonState | null = null;
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (!(await button.isVisible())) continue;
      if (await button.isEnabled()) return { button, state: Object.freeze({ name, enabled: true }) };
      disabled ??= Object.freeze({ name, enabled: false });
    }
    return enabledOnly || disabled === null ? null : { button: null, state: disabled };
  };
  return {
    async find(names) {
      let disabled: PanelButtonState | null = null;
      for (const name of names) {
        const found = await visibleButton(name, false);
        if (found?.state.enabled) return found.state;
        disabled ??= found?.state ?? null;
      }
      return disabled;
    },
    async press(name) {
      const found = await visibleButton(name, true);
      if (!found?.button) return false;
      await found.button.click({ timeout: PRESS_MS });
      return true;
    },
    async liveStep() {
      const step = page.locator(LIVE_STEP).first();
      if ((await step.count()) === 0 || !(await step.isVisible())) return null;
      return stepNumber(await step.textContent());
    },
  };
}

/**
 * Chrome's real side panel, reached from the run's extension control tab
 * through `chrome.extension.getViews()`, as `extensionViewPanelDriver` reaches
 * it: Playwright 1.51 does not hand over the side panel's page.
 */
export function extensionViewPanelRunControlSurface(control: Page, panelPath: string): PanelRunControlSurface {
  const run = (action: "find" | "press" | "step", names: readonly string[]) => control.evaluate(inPanelView, { panelPath, action, names: [...names], liveStep: LIVE_STEP }) as Promise<ViewAnswer>;
  return {
    async find(names) {
      const answer = await run("find", names);
      if (answer.kind === "missing") throw new Error(answer.why);
      return answer.kind === "button" ? Object.freeze({ name: answer.name, enabled: answer.enabled }) : null;
    },
    async press(name) {
      const answer = await run("press", [name]);
      if (answer.kind === "missing") throw new Error(answer.why);
      return answer.kind === "pressed";
    },
    async liveStep() {
      const answer = await run("step", []);
      if (answer.kind === "missing") throw new Error(answer.why);
      return answer.kind === "step" ? stepNumber(answer.text) : null;
    },
  };
}

type ViewAnswer = { kind: "missing"; why: string } | { kind: "none" } | { kind: "button"; name: string; enabled: boolean } | { kind: "pressed" } | { kind: "step"; text: string };

/** Self-contained because Playwright serializes it into the control tab, where it finds the panel's window among the extension's views. */
function inPanelView({ panelPath, action, names, liveStep }: { panelPath: string; action: "find" | "press" | "step"; names: string[]; liveStep: string }): ViewAnswer {
  const current = globalThis as unknown as Window & { chrome: { extension: { getViews(): Window[] } } };
  const views = current.chrome.extension.getViews();
  const panel = views.find((view) => view !== current && view.location.pathname === `/${panelPath}`);
  if (!panel) return { kind: "missing", why: `no panel view among ${views.length} extension view(s)` };
  const shown = (element: Element) => {
    const html = element as HTMLElement & { checkVisibility?: () => boolean };
    return typeof html.checkVisibility === "function" ? html.checkVisibility() : html.getClientRects().length > 0;
  };
  if (action === "step") {
    const step = panel.document.querySelector(liveStep);
    return step && shown(step) && step.textContent ? { kind: "step", text: step.textContent } : { kind: "none" };
  }
  const buttons = Array.from(panel.document.querySelectorAll("button")).filter(shown);
  const named = (name: string) => buttons.filter((button) => (button.getAttribute("aria-label")?.trim() || button.textContent?.trim() || "") === name);
  let disabled: string | null = null;
  for (const name of names) {
    for (const button of named(name)) {
      if (button.disabled) { disabled ??= name; continue; }
      if (action === "press") { button.click(); return { kind: "pressed" }; }
      return { kind: "button", name, enabled: true };
    }
  }
  return action === "find" && disabled !== null ? { kind: "button", name: disabled, enabled: false } : { kind: "none" };
}

async function ready(when: (() => Promise<boolean>) | undefined, failed: (reason: string) => void): Promise<boolean> {
  if (!when) return true;
  try {
    return await when();
  } catch (error) {
    failed(`the caller's moment could not be read: ${firstLine(error)}`);
    return false;
  }
}

/** The step number in "Step N", "Step N of M" or "Step N: label"; null for anything else. */
function stepNumber(text: string | null): number | null {
  const match = /^\s*Step\s+(\d+)\b/u.exec(text ?? "");
  return match ? Number(match[1]) : null;
}

function bounded(note: string | null): string | null {
  return note === null || note === "" ? null : note.slice(0, MAX_NOTE);
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n", 1)[0]!.slice(0, 120);
}
