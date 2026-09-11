// A pointerdown and the click that follows it are one user action. The first to
// arrive is recorded and claims the signature; the second is dropped.

const POINTER_CLICK_SUPPRESS_DELAY_MS = 750;

export class PointerClickFilter {
  private readonly suppressed = new Map<string, ReturnType<typeof setTimeout>>();

  suppressNext(signature: string): void {
    if (this.suppressed.has(signature)) return;
    const timer = setTimeout(() => {
      this.suppressed.delete(signature);
    }, POINTER_CLICK_SUPPRESS_DELAY_MS);
    this.suppressed.set(signature, timer);
  }

  isSuppressed(signature: string): boolean {
    return this.suppressed.has(signature);
  }

  clear(): void {
    for (const timer of this.suppressed.values()) clearTimeout(timer);
    this.suppressed.clear();
  }
}
