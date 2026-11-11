// The Humanness slider: 0 is the fastest, higher adds human-like timing, click positions and
// occasional harmless misclicks. It is Core's shared control in draft mode: the value is the
// person's starting value itself (no own/inherited state, no "Use starting value"), and the
// "Save changes" bar saves it, so the control never says "Saved.". Read and filled like a form
// field; `onEdit` fires when the slider settles (drag release, keys at rest, focus leaving).

import "@fluxiq/ui-components/styles/chat.css";
import { createHumannessControl as createSharedControl } from "@fluxiq/ui-components";
import { HUMANNESS_LIMITS } from "./limits";
import { normaliseHumanness } from "./normalise-humanness";

export type HumannessControl = {
  readonly element: HTMLElement;
  read(): number;
  fill(value: number): void;
  onEdit(listener: () => void): void;
};

export function createHumannessControl(): HumannessControl {
  const listeners: Array<() => void> = [];
  const start = HUMANNESS_LIMITS.default;
  const control = createSharedControl({
    mode: "draft",
    level: { own: start, starting: start },
    canClear: false,
    inputId: "humanness",
    label: "Starting humanness for new Flows and tasks",
    explain: "Each Flow and task can set its own level; this is where they start. Higher is slower and more person-like; robot checks always pause for you.",
    onDraft: () => listeners.forEach((listener) => listener())
  });
  const own = (): number => normaliseHumanness(control.level().own ?? control.level().starting);
  return {
    element: control.element,
    read: own,
    fill(value) {
      const level = normaliseHumanness(value);
      control.show({ own: level, starting: level });
    },
    onEdit(listener) {
      listeners.push(listener);
    }
  };
}
