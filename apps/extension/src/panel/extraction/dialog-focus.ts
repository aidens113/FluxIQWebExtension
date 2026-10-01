// Modal lifecycle within the extension document only. Browser/page focus is free.
export function createExtractionDialogFocus(panel: HTMLElement, hooks: {
  initial(): HTMLElement;
  returnTo(): HTMLElement | undefined;
  dismiss(): void;
  busy(): boolean;
}) {
  const doc = panel.ownerDocument;
  const inert = new Map<HTMLElement, boolean>();
  let opened = false;
  let parent: HTMLElement | null = null;
  let next: ChildNode | null = null;
  let opener: HTMLElement | null = null;
  let observer: MutationObserver | undefined;

  const ownsFocus = () => doc.visibilityState === "visible" && doc.hasFocus();
  const visible = (element: HTMLElement) => element.isConnected && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0;
  const enabled = (element: HTMLElement) => visible(element) && !(element as HTMLButtonElement).disabled;
  const focus = (element: HTMLElement) => { if (ownsFocus() && enabled(element)) element.focus({ preventScroll: true }); };
  function isolate(): void {
    for (const child of Array.from(doc.body.children) as HTMLElement[]) {
      if (child === panel) continue;
      if (!inert.has(child)) inert.set(child, child.inert);
      child.inert = true;
    }
  }
  function candidates(): HTMLElement[] {
    return Array.from(panel.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"))
      .filter((element) => enabled(element) && element.tabIndex >= 0);
  }
  function keydown(event: KeyboardEvent): void {
    if (!opened || !ownsFocus() || event.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      if (!hooks.busy()) hooks.dismiss();
    } else if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const all = candidates();
      const index = all.indexOf(doc.activeElement as HTMLElement);
      if (index < 0 || (event.shiftKey ? index === 0 : index === all.length - 1)) {
        event.preventDefault();
        focus((event.shiftKey ? all[all.length - 1] : all[0]) ?? panel);
      }
    }
  }
  function focusin(event: FocusEvent): void {
    if (opened && ownsFocus() && !panel.contains(event.target as Node)) focus(hooks.initial());
  }
  function open(): void {
    if (opened) return;
    parent = panel.parentElement;
    next = panel.nextSibling;
    opener = doc.activeElement as HTMLElement | null;
    opened = true;
    panel.hidden = false;
    doc.body.append(panel);
    isolate();
    observer = new MutationObserver(isolate);
    observer.observe(doc.body, { childList: true });
    doc.addEventListener("keydown", keydown, true);
    doc.addEventListener("focusin", focusin, true);
    focus(hooks.initial());
  }
  function close(): void {
    if (!opened) { panel.hidden = true; return; }
    const restore = ownsFocus() && panel.contains(doc.activeElement);
    opened = false;
    observer?.disconnect(); observer = undefined;
    doc.removeEventListener("keydown", keydown, true);
    doc.removeEventListener("focusin", focusin, true);
    panel.hidden = true;
    for (const [element, prior] of inert) element.inert = prior;
    inert.clear();
    if (parent?.isConnected) parent.insertBefore(panel, next?.parentNode === parent ? next : null);
    else panel.remove();
    const target = opener && opener !== doc.body && enabled(opener) ? opener : hooks.returnTo();
    if (restore && target) focus(target);
    parent = null; next = null; opener = null;
  }
  function render(work: () => void): void {
    const active = doc.activeElement as HTMLInputElement | null;
    const inside = opened && active !== null && panel.contains(active) && ownsFocus();
    const field = inside ? active.closest<HTMLElement>(".extraction-field") : null;
    const order = field ? Array.from(panel.querySelectorAll<HTMLElement>(".extraction-field")).map((row) => row.dataset.field) : [];
    const key = field?.dataset.field;
    const selection = active ? [active.selectionStart, active.selectionEnd, active.selectionDirection] as const : undefined;
    work();
    if (!inside || !active || !ownsFocus()) return;
    // Preserve deliberate focus changes; only repair focus lost by this redraw.
    if (doc.activeElement !== active && doc.activeElement !== doc.body && doc.activeElement !== null) return;
    if (enabled(active)) return;
    const fields = Array.from(panel.querySelectorAll<HTMLElement>(".extraction-field"));
    const replacement = fields.find((row) => row.dataset.field === key);
    let target: HTMLElement | undefined;
    if (replacement) target = Array.from(replacement.querySelectorAll<HTMLElement>("input, select, button, [tabindex]"))
      .find((element) => element.tagName === active.tagName && element.className === active.className
        && (active.type !== "radio" || (element as HTMLInputElement).value === active.value));
    if (!target && key) {
      const index = order.indexOf(key);
      const nextKey = order.slice(index + 1).find((id) => fields.some((row) => row.dataset.field === id))
        ?? order.slice(0, index).reverse().find((id) => fields.some((row) => row.dataset.field === id));
      target = fields.find((row) => row.dataset.field === nextKey)?.querySelector<HTMLElement>(".extraction-field-label") ?? undefined;
    }
    if (!target || !enabled(target)) target = hooks.initial();
    focus(target);
    if (target.tagName === "INPUT" && ["text", "search", "url", "tel", "password"].includes((target as HTMLInputElement).type) && selection && typeof selection[0] === "number" && typeof selection[1] === "number") {
      (target as HTMLInputElement).setSelectionRange(selection[0], selection[1], selection[2] ?? undefined);
    }
  }
  return { open, close, render };
}
