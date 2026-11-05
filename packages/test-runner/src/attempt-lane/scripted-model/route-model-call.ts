/** The variable the preload reads the scripted server's address from. */
export const SCRIPTED_MODEL_ORIGIN_ENV = "FLUXIQ_LAB_SCRIPTED_MODEL_ORIGIN";

/** Where one outgoing fetch of the Core child goes under a scripted model. */
export type ModelCallRoute = "as_is" | "scripted" | "refused";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

function headerOf(headers: RequestInit["headers"], name: string): string | null {
  return headers === undefined ? null : new Headers(headers).get(name);
}

/**
 * Loopback is this run's own: Core's calls to itself, the fixture, the gateway. A
 * Messages call goes to the scripted server. Anything else leaving this machine is
 * refused, so a scripted run reaches no provider and spends nothing.
 *
 * A Messages call is told by its shape, the POST to `/v1/messages` over https with
 * `anthropic-version` that Core's one transport sends, and not by its host. This
 * repository's structure audit refuses a provider's host written in source
 * (`scripts/structure-audit/config.mjs`) and Core exports no name for it. Nothing is
 * lost by it: whichever host such a call names, it reaches only the loopback server.
 */
export function routeModelCall(url: URL, init: RequestInit | undefined): ModelCallRoute {
  if (LOOPBACK.has(url.hostname)) return "as_is";
  if (url.protocol === "https:" && url.pathname === "/v1/messages" && init?.method === "POST" && headerOf(init.headers, "anthropic-version") !== null) return "scripted";
  return "refused";
}

/**
 * `real`, with every outgoing call routed as above. A scripted reply is rebuilt as a
 * plain `Response` with no URL, because Core refuses a reply from anywhere but its fixed
 * endpoint (`runtime/models/providers/anthropic/messages.ts`) and an empty one is what
 * its check lets past.
 */
export function routedFetch(real: typeof fetch, origin: string): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const route = routeModelCall(url, init ?? (input instanceof Request ? { method: input.method, headers: input.headers } : undefined));
    if (route === "as_is") return real(input, init);
    if (route === "refused") throw new TypeError(`A scripted-model run refuses a call leaving this machine, to ${url.hostname}`);
    const reply = await real(`${origin}/v1/messages`, init);
    return new Response(reply.body, { status: reply.status, statusText: reply.statusText, headers: reply.headers });
  };
}
