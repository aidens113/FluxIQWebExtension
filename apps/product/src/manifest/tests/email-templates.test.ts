import assert from "node:assert/strict";
import { test } from "node:test";
import { PANEL_PRODUCT_ASSET_PATH } from "fluxiq/platform/panel";
import { allowedEmailPlaceholders, productEmailTemplates, type EmailTemplateName } from "../index.ts";

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/gu;

function used(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
}

test("each template uses only placeholders Core fills for that template", () => {
  const names = Object.keys(productEmailTemplates) as EmailTemplateName[];
  assert.deepEqual(names.sort(), ["account-exists", "client-connected", "password-reset", "welcome"]);
  for (const name of names) {
    const template = productEmailTemplates[name]!;
    for (const placeholder of [...used(template.subject), ...used(template.text)]) {
      assert.ok(allowedEmailPlaceholders[name].includes(placeholder), `${name} uses {{${placeholder}}}, which Core does not fill`);
    }
    assert.ok(!/\{\{|\}\}/u.test(template.text.replace(PLACEHOLDER, "")), `${name} has a malformed placeholder`);
  }
});

test("the action links each template needs are present", () => {
  assert.ok(used(productEmailTemplates.welcome!.text).includes("welcomeUrl"));
  assert.ok(used(productEmailTemplates["password-reset"]!.text).includes("resetUrl"));
  assert.ok(used(productEmailTemplates["account-exists"]!.text).includes("signInUrl"));
  assert.ok(used(productEmailTemplates["client-connected"]!.text).includes("manageUrl"));
  assert.equal(PANEL_PRODUCT_ASSET_PATH, "/product/assets/");
});
