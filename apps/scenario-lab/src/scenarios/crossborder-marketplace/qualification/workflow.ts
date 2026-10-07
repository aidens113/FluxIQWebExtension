import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { VOLTBAY_OFFICIAL_ID } from "../catalog/index.js";
import { itemHref } from "../markup/index.js";
import { couponOnlyExpected } from "./expected.js";

export const couponOnlyWorkflow: ScenarioWorkflow = {
  id: "collect-official-coupon-only",
  description: "Collect only the official store coupon, report it, and leave cart, checkout and orders untouched.",
  recordingScript: [
    { id: "coupon-only-welcome", operation: "waitForState", target: 'text="Welcome back, Mara!"', timeoutMs: 8000 },
    { id: "coupon-only-decline-platform", operation: "click", target: 'text="No thanks"' },
    { id: "coupon-only-consent", operation: "click", target: 'text="Accept all"' },
    { id: "coupon-only-search", operation: "type", target: 'input[name="q"]', value: "usb c hub" },
    { id: "coupon-only-submit", operation: "press", target: 'input[name="q"]', value: "Enter" },
    { id: "coupon-only-results", operation: "waitForState", target: 'text="Voltbay Official Store"', timeoutMs: 6000 },
    { id: "coupon-only-open-item", operation: "click", target: `a[href="${itemHref(VOLTBAY_OFFICIAL_ID)}"] >> nth=1` },
    { id: "coupon-only-item-tab", operation: "switchTab", path: itemHref(VOLTBAY_OFFICIAL_ID), timeoutMs: 30_000 },
    { id: "coupon-only-chat", operation: "waitForState", target: '[title="Minimize chat"] >> nth=0', timeoutMs: 6000 },
    { id: "coupon-only-minimize-chat", operation: "click", target: '[title="Minimize chat"] >> nth=0' },
    { id: "coupon-only-claim", operation: "click", target: 'text="Get coupons"' },
    { id: "coupon-only-retry-ready", operation: "waitForState", target: 'text="Network busy, please try again"', timeoutMs: 5000 },
    { id: "coupon-only-retry", operation: "click", target: 'text="Get coupons"' },
    { id: "coupon-only-collected", operation: "waitForState", target: 'text="Collected"', timeoutMs: 5000 },
    { id: "coupon-only-show-account", operation: "click", target: 'span:has(> b:text-is("Mara"))' },
    { id: "coupon-only-account-visible", operation: "waitForState", target: "testid:store-coupons", timeoutMs: 5000 },
    { id: "extract-official-coupon-only", operation: "extract", target: "testid:store-coupons", fields: { coupon: ":scope" } },
    { id: "coupon-only-complete", operation: "checkpoint" },
  ],
  expected: couponOnlyExpected,
};
