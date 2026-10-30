import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPanelBrandContrast, contrastRatio, PANEL_BRAND_SURFACES, panelProductSchema } from "fluxiq/platform/panel";
import { productManifest } from "../index.ts";

test("the manifest validates against Core's schema", () => {
  const parsed = panelProductSchema.parse(productManifest);
  assert.equal(parsed.id, "fluxiq");
  assert.equal(parsed.auth?.signUpUrl, "https://getfluxiq.com/signup/");
  assert.equal(parsed.extensionStores, undefined, "no store URL is invented");
});

test("the brand accents pass Core's contrast check", () => {
  const result = checkPanelBrandContrast(panelProductSchema.parse(productManifest));
  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
});

test("the brand ratios are the ones recorded in the report", () => {
  for (const mode of ["light", "dark"] as const) {
    const accent = productManifest.brand?.[mode];
    assert.ok(accent, `brand.${mode} is set`);
    const { surface, background } = PANEL_BRAND_SURFACES[mode];
    const ratios = {
      primary: contrastRatio(accent.primary, surface),
      primaryHover: contrastRatio(accent.primaryHover, surface),
      focusSurface: contrastRatio(accent.focus, surface),
      focusBackground: contrastRatio(accent.focus, background)
    };
    console.log(`${mode}: ${JSON.stringify(Object.fromEntries(Object.entries(ratios).map(([key, value]) => [key, Number(value.toFixed(2))])))}`);
    assert.ok(ratios.primary >= 4.5 && ratios.primaryHover >= 4.5 && ratios.focusSurface >= 3 && ratios.focusBackground >= 3);
  }
});
