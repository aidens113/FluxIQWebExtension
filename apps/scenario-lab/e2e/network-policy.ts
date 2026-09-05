import type { BrowserContext, Page, Route } from "@playwright/test";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const LOCAL_SCHEMES = new Set(["chrome-extension:", "data:", "about:"]);

export function isDeterministicBrowserUrlAllowed(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (LOCAL_SCHEMES.has(url.protocol)) return true;
  return (url.protocol === "http:" || url.protocol === "ws:") && LOOPBACK_HOSTS.has(url.hostname);
}

export type DeterministicNetworkGuard = {
  readonly unexpectedDestinations: readonly string[];
  assertClean(): void;
};

export async function installDeterministicNetworkGuard(context: BrowserContext): Promise<DeterministicNetworkGuard> {
  const unexpected = new Set<string>();
  const observe = (url: string) => { if (!isDeterministicBrowserUrlAllowed(url)) unexpected.add(url); };
  const observePage = (page: Page) => page.on("websocket", socket => observe(socket.url()));
  context.pages().forEach(observePage);
  context.on("page", observePage);
  context.on("request", request => observe(request.url()));
  await context.route("**/*", async (route: Route) => {
    const url = route.request().url();
    if (isDeterministicBrowserUrlAllowed(url)) await route.continue();
    else { unexpected.add(url); await route.abort("blockedbyclient"); }
  });
  return {
    get unexpectedDestinations() { return [...unexpected].sort(); },
    assertClean() {
      if (unexpected.size > 0) throw new Error(`network.unexpected: deterministic browser attempted non-loopback destinations:\n${[...unexpected].sort().join("\n")}`);
    },
  };
}
