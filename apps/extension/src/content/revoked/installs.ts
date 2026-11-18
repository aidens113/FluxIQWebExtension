// The disposers of everything this content script installed once its document
// was known to be ordinary (page-change counter, frame-geometry bridge,
// recording listeners), so a revocation can take them all down.

const disposers: Array<() => void> = [];

export const contentInstalls = {
  /** Keeps `dispose` to run on revocation, and returns it. */
  own(dispose: () => void): () => void {
    disposers.push(dispose);
    return dispose;
  },
  /** Runs and forgets every disposer. */
  disposeAll(): void {
    for (const dispose of disposers.splice(0)) dispose();
  }
};
