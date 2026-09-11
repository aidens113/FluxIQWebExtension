// Waits an action can depend on: each resolves as soon as the page satisfies
// it, re-checking on every DOM mutation, and rejects when the timeout passes.

export function waitForElement(selector: string | undefined, timeoutMs = 10_000): Promise<Element> {
  if (!selector) return Promise.reject(new Error("Selector is required."));
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waitObserver.disconnect();
      reject(new Error(`Timed out waiting for selector: ${selector}`));
    }, timeoutMs);
    const waitObserver = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) return;
      clearTimeout(timeout);
      waitObserver.disconnect();
      resolve(element);
    });
    waitObserver.observe(document.documentElement, { childList: true, subtree: true });
  });
}

export function waitForText(text: string, timeoutMs = 10_000): Promise<void> {
  if (document.body.innerText.includes(text)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waitObserver.disconnect();
      reject(new Error(`Timed out waiting for text: ${text}`));
    }, timeoutMs);
    const waitObserver = new MutationObserver(() => {
      if (!document.body.innerText.includes(text)) return;
      clearTimeout(timeout);
      waitObserver.disconnect();
      resolve();
    });
    waitObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}
