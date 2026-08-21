export function shouldAttachStateSnapshot(kind: string): boolean {
  return kind === "dom.click" ||
    kind === "dom.input" ||
    kind === "dom.change" ||
    kind === "dom.submit" ||
    kind === "dom.keydown";
}
