import { defineScenario } from "../../types.js";
import { storefrontCheckoutManifest } from "./manifest.js";
import { PAYMENT_FRAME_PATH, renderStorefrontCheckout } from "./markup.js";
import { mutateStorefrontCheckoutState } from "./mutate.js";
import { renderPaymentFrame } from "./payment-frame.js";
import { createStorefrontCheckoutState, type StorefrontCheckoutState } from "./state.js";

/**
 * A multi-step store checkout: bag, address, delivery, a card form in a
 * same-origin frame, and a confirmation. The card form is a second document
 * this fixture serves itself, so the frame is a real one with its own script
 * and its own controls rather than a decoration.
 */
export const storefrontCheckoutScenario = defineScenario<StorefrontCheckoutState>({
  id: "storefront-checkout",
  title: "Storefront checkout",
  startPath: "/scenarios/storefront-checkout/",
  seed: 131,
  manifest: storefrontCheckoutManifest,
  createState: createStorefrontCheckoutState,
  mutate: mutateStorefrontCheckoutState,
  render: renderStorefrontCheckout,
  route(state, request, context) {
    if (request.subpath !== PAYMENT_FRAME_PATH) return undefined;
    return { status: 200, body: renderPaymentFrame(state, context.runToken) };
  },
});
