// The document a frame holds now, by the id Chrome gives it (`documentId`,
// Chrome 106+), for the in-flight record: a later look can then tell whether
// the page the command was sent to is the one still there. Firefox gives none,
// and a frame the browser cannot describe has none to give; either way the
// record is kept without it.

export function frameDocumentId(tabId: number, frameId: number): Promise<string | undefined> {
  const navigation = (globalThis as { chrome?: typeof chrome }).chrome?.webNavigation;
  if (typeof navigation?.getFrame !== "function") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigation.getFrame({ tabId, frameId }, (details) => {
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
      const documentId = (details as { documentId?: unknown } | null)?.documentId;
      resolve(typeof documentId === "string" ? documentId : undefined);
    });
  });
}
