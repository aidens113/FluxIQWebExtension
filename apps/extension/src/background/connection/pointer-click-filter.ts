// A pointerdown and the click it produces are one user action: the press is
// recorded and its click is dropped. A click is paired with its own press by
// event order in its frame, never by time, so a second activation of the same
// unmoved control is a second action however soon it follows the first.
//
// A press produces at most one click, the next trusted click its document
// dispatches: on the pressed control, or on a common ancestor when the release
// lands elsewhere. So a frame's next click spends that frame's press whether or
// not it pairs, and a later pointerdown replaces a press whose click never came,
// as after a cancelled touch. Only a click on the pressed control (the same
// signature) sent after the press (a higher sequence, which restarts with every
// document) pairs with it.
//
// A click with no press before it -- one the keyboard activated, or the click a
// label forwards to its control -- pairs with nothing and is recorded. An
// untrusted click never arrives here: the content script drops it
// (`content/dom-events.ts`).

type Press = { readonly signature: string | undefined; readonly sequence: number };

function frameKey(tabId: number | undefined, frameId: number | undefined): string {
  return `${tabId ?? "tab"}|${frameId ?? "frame"}`;
}

export class PointerClickFilter {
  private readonly presses = new Map<string, Press>();

  notePress(tabId: number | undefined, frameId: number | undefined, signature: string | undefined, sequence: number): void {
    this.presses.set(frameKey(tabId, frameId), { signature, sequence });
  }

  // Whether a click is the one its frame's press produced, and so is already
  // recorded as that press.
  isClickOfPress(tabId: number | undefined, frameId: number | undefined, signature: string | undefined, sequence: number): boolean {
    const key = frameKey(tabId, frameId);
    const press = this.presses.get(key);
    this.presses.delete(key);
    return press !== undefined && signature !== undefined && press.signature === signature && sequence > press.sequence;
  }

  clear(): void {
    this.presses.clear();
  }
}
