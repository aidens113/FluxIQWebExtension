const LOOPBACK_HOSTS = ["localhost", "127.0.0.1"] as const;
const RULE_SAFE_HOST = /^[a-z0-9.-]+$/u;

/**
 * The browser-level half of network containment, added to the command line
 * of every browser a guarded lane launches.
 *
 * The deterministic guard (`network-guard.ts`) works at Playwright's route
 * layer, and a service worker's WebSocket never passes through that layer:
 * measured on 2026-09-28 with Playwright 1.51.1, `routeWebSocket` saw none of
 * an extension background's sockets. These switches close what they can below
 * it, in Chromium's own network stack, for every page and worker alike:
 *
 * - `--host-resolver-rules` resolves no host except the two loopback names and
 *   the hosts of `origins` -- the lane's own allowlist, so an `existing` target
 *   on another machine still resolves. It also refused the IP literal
 *   `127.0.0.2` in the same measurement, so an address typed as a number does
 *   not slip past it. Exact origins and ports stay the route guard's job.
 * - `--no-proxy-server` keeps a system proxy from taking the request, since a
 *   proxy resolves the name itself and the rules above would never apply.
 *
 * What neither layer stops is a service worker's WebSocket to an unlisted port
 * on an allowlisted host: on loopback that stays on the machine, but it is not
 * enforced.
 */
export function networkContainmentArgs(origins: readonly (string | undefined)[]): string[] {
  const hosts = new Set<string>(LOOPBACK_HOSTS);
  for (const origin of origins) {
    if (origin === undefined) continue;
    const host = new URL(origin).hostname.toLowerCase();
    // A comma or space would end the rule and start another, so a host that
    // is not a plain name or IPv4 address is refused rather than written.
    if (!RULE_SAFE_HOST.test(host)) throw new Error(`Cannot contain a browser to host ${JSON.stringify(host)}: it is not a plain DNS name or IPv4 address`);
    hosts.add(host);
  }
  return [
    `--host-resolver-rules=MAP * ~NOTFOUND, ${[...hosts].map(host => `EXCLUDE ${host}`).join(", ")}`,
    "--no-proxy-server",
  ];
}
