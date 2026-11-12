import { PRESS_BINDING_MARK_EVENT, PRESS_BINDING_RELEASE_EVENT, PRESS_BINDING_SINCE_EVENT } from "../../../shared/press-probe-event";

/** Whether this control or a scoped composed ancestor gained a press binding after this mark; never inferred from capture's historical probe. */
export function markPressBinding(pressed: Element): { added(): boolean; stop(): void } | undefined {
  if (typeof CustomEvent !== "function" || typeof pressed.dispatchEvent !== "function") return undefined;
  const token = Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(36)).join("-");
  const ask = (type: string): boolean => !pressed.dispatchEvent(new CustomEvent(type, { cancelable: true, composed: true, detail: token }));
  if (!ask(PRESS_BINDING_MARK_EVENT)) return undefined;
  let stopped = false;
  return {
    added: () => !stopped && ask(PRESS_BINDING_SINCE_EVENT),
    stop() { if (!stopped) { stopped = true;
      ask(PRESS_BINDING_RELEASE_EVENT); } }
  };
}
