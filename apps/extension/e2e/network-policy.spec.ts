import { expect, test } from "@playwright/test";
import { installDeterministicNetworkGuard, isDeterministicBrowserUrlAllowed } from "./fixtures/network-policy.js";

test("allows only extension/local documents and loopback HTTP or WebSocket", () => {
  for (const url of ["chrome-extension://abcdefghijklmnop/page.html", "data:text/plain,ok", "about:blank", "http://127.0.0.1:3210/path", "http://localhost:3210/path", "ws://127.0.0.1:3211/client"]) {
    expect(isDeterministicBrowserUrlAllowed(url), url).toBe(true);
  }
});

test("rejects malformed, external, secure, file, and lookalike destinations", () => {
  for (const url of ["not a url", "https://127.0.0.1/", "wss://localhost/client", "file:///tmp/secret", "http://127.0.0.1.example.test/", "https://example.invalid/"]) {
    expect(isDeterministicBrowserUrlAllowed(url), url).toBe(false);
  }
});

test("aborts and records a real browser request to an unexpected destination", async ({ context, page }) => {
  const guard = await installDeterministicNetworkGuard(context);
  await expect(page.goto("https://example.invalid/blocked")).rejects.toThrow();
  expect(guard.unexpectedDestinations).toEqual(["https://example.invalid/blocked"]);
  expect(() => guard.assertClean()).toThrow(/network\.unexpected/);
});
