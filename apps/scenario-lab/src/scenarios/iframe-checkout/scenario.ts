import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

type State = { sameOriginClicks: number; crossOriginClicks: number };

// The cross-origin frame is served from the second loopback port, so its
// policy must let the main origin embed it.
const CROSS_FRAME_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:*";

export const iframeCheckoutScenario = defineScenario<State>({
  id: "iframe-checkout", title: "Iframe checkout", startPath: "/scenarios/iframe-checkout/",
  seed: 105,
  manifest: createScenarioManifest({
    id: "iframe-checkout", title: "Iframe checkout", tags: ["iframe", "coordinates"], seed: 105,
    startPath: "/scenarios/iframe-checkout/", capabilities: ["iframe"],
    recordingScript: [
      { id: "same-origin-confirm", operation: "click", target: "frame:Same-origin checkout/testid:same-frame-action" },
      { id: "cross-origin-confirm", operation: "click", target: "frame:Cross-origin checkout/testid:cross-frame-action" },
      { id: "frames-final", operation: "checkpoint" },
    ],
    expected: {
      pageFacts: [{ id: "two-frames", subject: "document", predicate: "iframe-count", value: 2 }],
      recordingEvents: [{ type: "web.element.clicked", count: 2 }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "same-confirmed", subject: "same-frame", predicate: "text", value: "Confirmed" }, { id: "cross-confirmed", subject: "cross-frame", predicate: "text", value: "Confirmed" }],
    },
  }),
  createState: () => ({ sameOriginClicks: 0, crossOriginClicks: 0 }),
  mutate(state, operation) {
    if (operation === "same") return { ...state, sameOriginClicks: state.sameOriginClicks + 1 };
    if (operation === "cross") return { ...state, crossOriginClicks: state.crossOriginClicks + 1 };
    return state;
  },
  render(_state, context) {
    const alternate = context.alternateOrigin ?? "http://localhost";
    return page("Iframe checkout", `<main><h1>Iframe checkout</h1><iframe title="Same-origin checkout" data-testid="same-frame" src="/scenarios/iframe-checkout/same-frame"></iframe><iframe title="Cross-origin checkout" data-testid="cross-frame" src="${alternate}/scenarios/iframe-checkout/cross-frame"></iframe></main>`, "");
  },
  route(_state, request, context) {
    if (request.subpath === "same-frame") return { status: 200, body: iframePage("same", context.runToken) };
    if (request.subpath === "cross-frame") return { status: 200, headers: { "content-security-policy": CROSS_FRAME_CSP }, body: iframePage("cross", context.runToken) };
    return undefined;
  },
});

function iframePage(kind: "same" | "cross", runToken: string): string {
  return page(`${kind} origin frame`, `<main><h1>${kind === "same" ? "Same" : "Cross"}-origin frame</h1><button data-testid="${kind}-frame-action">Confirm synthetic checkout</button><p data-testid="frame-result" aria-live="polite">Pending</p></main>`, `${fixtureClient(runToken, "iframe-checkout")}
document.querySelector('button').addEventListener('click', async () => { await mutate('${kind}'); document.querySelector('[data-testid="frame-result"]').textContent = 'Confirmed'; });`);
}
