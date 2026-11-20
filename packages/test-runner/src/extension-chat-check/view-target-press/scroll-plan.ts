/** A trusted wheel gesture that can expose the button through its actual scroll owners. Self-contained for serialization. */
export function panelScrollPlan(button: HTMLButtonElement, scope: Window): { x: number; y: number; deltaY: number } | undefined {
  const bounds = (element: Element) => {
    const box = element.getBoundingClientRect();
    const left = box.left + element.clientLeft;
    const top = box.top + element.clientTop;
    return { left, top, right: left + element.clientWidth, bottom: top + element.clientHeight };
  };
  const scrolls = (element: Element): boolean => ["auto", "scroll"].includes(scope.getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight;
  let anchor: Element = button;
  for (let owner = button.parentElement; owner; owner = owner.parentElement) {
    const style = scope.getComputedStyle(owner);
    const own = bounds(owner);
    const target = anchor.getBoundingClientRect();
    const center = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
    const locallyClipped = center.y < own.top || center.y >= own.bottom;
    if (["hidden", "clip"].includes(style.overflowY) && locallyClipped) return undefined;
    if (["hidden", "clip"].includes(style.overflowX) && (center.x < own.left || center.x >= own.right)) return undefined;
    if (!scrolls(owner)) {
      if (style.overflowY !== "visible" && locallyClipped) return undefined;
      continue;
    }
    const clip = { left: 0, top: 0, right: scope.innerWidth, bottom: scope.innerHeight };
    for (let parent: Element | null = owner; parent; parent = parent.parentElement) {
      const parentStyle = scope.getComputedStyle(parent);
      const box = bounds(parent);
      if (parent === owner || parentStyle.overflowX !== "visible") {
        clip.left = Math.max(clip.left, box.left);
        clip.right = Math.min(clip.right, box.right);
      }
      if (parent === owner || parentStyle.overflowY !== "visible") {
        clip.top = Math.max(clip.top, box.top);
        clip.bottom = Math.min(clip.bottom, box.bottom);
      }
    }
    if (clip.left >= clip.right || clip.top >= clip.bottom) {
      if (locallyClipped) anchor = owner;
      continue;
    }
    if (center.x <= clip.left || center.x >= clip.right || (center.y >= clip.top && center.y < clip.bottom)) return undefined;
    const deltaY = target.top < clip.top ? target.top - clip.top : target.top + target.height - clip.bottom;
    const x = center.x;
    const y = (clip.top + clip.bottom) / 2;
    const hit = scope.document.elementFromPoint(x, y);
    if (!hit || !owner.contains(hit)) continue;
    for (let receiving: Element | null = hit; receiving; receiving = receiving.parentElement) {
      const remaining = receiving.scrollHeight - receiving.clientHeight - receiving.scrollTop;
      if (!scrolls(receiving) || (deltaY < 0 ? receiving.scrollTop <= 0 : remaining <= 0)) continue;
      if (!receiving.contains(button)) return undefined;
      return { x, y, deltaY: Math.max(-receiving.scrollTop, Math.min(deltaY, remaining)) };
    }
    return undefined;
  }
  return undefined;
}
