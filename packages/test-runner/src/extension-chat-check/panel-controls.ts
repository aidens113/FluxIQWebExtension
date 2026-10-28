import type { Page } from "@playwright/test";

/**
 * Controls of the extension's panel pressed by the name a person reads, from the run's control tab
 * (`chrome.extension.getViews()`, as `extensionViewPanelDriver` reaches the chat). The chat driver
 * presses a button by its text; the recording controls are named by `aria-label` ("Start recording"
 * is an icon), a dialog's textarea by its label, and the recording attachment's list is a group
 * headed "Attach a recording". Each press waits for a visible, enabled control and fails, naming
 * what the panel showed, at the bound.
 */
export type PanelControls = {
  /** Presses the visible, enabled button named `name` by its aria-label or its text. */
  pressNamed(name: string, timeoutMs: number): Promise<void>;
  /** Types `text` into the visible text area labelled `label`. */
  fillLabelled(label: string, text: string, timeoutMs: number): Promise<void>;
  /** Presses the button named exactly `name` inside the visible group labelled `group`. */
  pressInGroup(group: string, name: string, timeoutMs: number): Promise<void>;
  /** The panel's visible text, whitespace collapsed. */
  text(): Promise<string>;
};

type Action = { kind: "press" | "fill" | "press-in-group" | "text"; name: string; label: string; text: string };

export function extensionViewPanelControls(control: Page, panelPath: string): PanelControls {
  const act = (action: Action) => control.evaluate(inPanel, { panelPath, action }) as Promise<string>;
  const until = async (timeoutMs: number, attempt: () => Promise<string>, done: string, describe: string): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const outcome = await attempt();
      if (outcome === done) return;
      if (Date.now() >= deadline) throw new Error(`The panel offered no ${describe}: ${outcome}`);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };
  return {
    pressNamed: (name, timeoutMs) => until(timeoutMs, () => act({ kind: "press", name, label: "", text: "" }), "done", `enabled "${name}" button`),
    fillLabelled: (label, text, timeoutMs) => until(timeoutMs, () => act({ kind: "fill", name: "", label, text }), "done", `text area labelled "${label}"`),
    pressInGroup: (group, name, timeoutMs) => until(timeoutMs, () => act({ kind: "press-in-group", name, label: group, text: "" }), "done", `"${name.slice(0, 80)}" button in the "${group}" list`),
    text: () => act({ kind: "text", name: "", label: "", text: "" }),
  };
}

/** Self-contained because Playwright serializes it into the actual extension view. */
function inPanel({ panelPath, action }: { panelPath: string; action: Action }): string {
  const chrome = (globalThis as any).chrome;
  const views: Window[] = chrome.extension.getViews();
  const panel = views.find((view) => view !== (globalThis as unknown as Window) && view.location.pathname === `/${panelPath}`);
  if (!panel) return `no panel view among ${views.length} extension view(s): ${views.map((view) => view.location.pathname).join(", ")}`;
  const document = panel.document;
  const squash = (value: string | null | undefined) => (value ?? "").replace(/\s+/gu, " ").trim();
  const shown = (element: Element) => !element.closest("[hidden]") && (element as HTMLElement).getClientRects().length > 0;
  if (action.kind === "text") return squash(document.body?.innerText);
  if (action.kind === "fill") {
    const boxes = Array.from(document.querySelectorAll("textarea")).filter((box) => box.getAttribute("aria-label") === action.label && shown(box));
    const box = boxes[0] as HTMLTextAreaElement | undefined;
    if (!box) return "not shown yet";
    if (box.disabled || box.readOnly) return "disabled";
    const setter = Object.getOwnPropertyDescriptor((panel as any).HTMLTextAreaElement.prototype, "value")!.set!;
    box.focus();
    setter.call(box, action.text);
    box.dispatchEvent(new (panel as any).Event("input", { bubbles: true }));
    return "done";
  }
  let scope: ParentNode = document;
  if (action.kind === "press-in-group") {
    const group = Array.from(document.querySelectorAll('[role="group"]')).find((candidate) => candidate.getAttribute("aria-label") === action.label && shown(candidate));
    if (!group) return `the "${action.label}" list is not open`;
    scope = group;
  }
  const buttons = Array.from(scope.querySelectorAll("button")).filter((button) => shown(button));
  const matches = buttons.filter((button) => action.kind === "press-in-group" ? squash(button.textContent) === squash(action.name) : button.getAttribute("aria-label") === action.name || squash(button.textContent) === action.name);
  const enabled = matches.find((button) => !(button as HTMLButtonElement).disabled);
  if (!enabled) return matches.length > 0 ? "disabled" : `not shown yet (buttons shown: ${buttons.map((button) => squash(button.getAttribute("aria-label") || button.textContent).slice(0, 40)).join(" | ").slice(0, 400)})`;
  (enabled as HTMLButtonElement).click();
  return "done";
}
