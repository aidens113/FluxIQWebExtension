const KINDS: Readonly<Record<string, string>> = {
  "browser-navigate": "navigate",
  "dom-type": "act: type",
  "dom-click": "act: click",
  "dom-check": "act: check",
  "dom-select": "act: choose",
  "dom-next_page": "act: next page",
  "dom-extract_list": "read",
};

/** A node's kind in plain words, from its action id (`web.output.dom-click` reads `act: click`). */
export function chartNodeKind(actionId: string): string {
  const tail = actionId.replace(/^web\.(output\.)?/u, "");
  return KINDS[tail] ?? (tail.includes("wait") ? "wait" : tail.replace(/^dom-/u, "").replace(/[-_.]/gu, " "));
}
