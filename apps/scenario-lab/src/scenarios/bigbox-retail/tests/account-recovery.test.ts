import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNT_RECOVERY_VALUES, bigboxModes, bigboxRetailScenario, createBigboxState, mutateBigboxState } from "../index.js";
import type { BigboxState } from "../types.js";

/**
 * The `account-recovery` rendering: an armable sign-in wall with the "Forgot
 * your password?" panel open, whose job is to give the browser specs every
 * construct the redaction rule protects on a realistic page. The default site
 * must not change at all, and the panel must read as a store's page.
 */

const { route } = bigboxRetailScenario;
const context = { runToken: "bigbox-retail-test-token", seed: 239, alternateOrigin: "http://127.0.0.1:9" };
const checkout = (state: BigboxState) => route!(state, { subpath: "checkout", query: new URLSearchParams(), method: "GET" }, context)!.body as string;
const armed = () => mutateBigboxState(createBigboxState(), "set-mode", { mode: "account-recovery" });
/** The panel's markup alone: from its section to the end of its form. */
const panelOf = (body: string) => {
  const start = body.lastIndexOf("<section", body.indexOf("Forgot your password?"));
  const end = body.indexOf("</form></section>");
  assert.ok(start >= 0 && end > start, "the checkout carries no recovery panel");
  return body.slice(start, end + "</form></section>".length);
};
const visibleText = (markup: string) => markup.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gu, " ").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");
const SECRETS = [
  ...ACCOUNT_RECOVERY_VALUES.securityAnswers.flatMap((answer) => [answer.value, answer.label]),
  ACCOUNT_RECOVERY_VALUES.passwordHint, ACCOUNT_RECOVERY_VALUES.oneTimeCode.value, ACCOUNT_RECOVERY_VALUES.oneTimeCode.label,
  ACCOUNT_RECOVERY_VALUES.resetEmail, ACCOUNT_RECOVERY_VALUES.savedCardsHeading, ACCOUNT_RECOVERY_VALUES.cardColumn,
  ACCOUNT_RECOVERY_VALUES.billingAddress, ACCOUNT_RECOVERY_VALUES.nicknameCard, ACCOUNT_RECOVERY_VALUES.billingZip,
];

test("account-recovery is armed through set-mode, starts the shopper over, and is never the default", () => {
  assert.ok(bigboxModes.includes("account-recovery"));
  assert.equal(createBigboxState().mode, "baseline");
  const answered = mutateBigboxState(createBigboxState(), "consent", { choice: "reject" });
  const state = mutateBigboxState(answered, "set-mode", { mode: "account-recovery" });
  assert.deepEqual(state, createBigboxState("account-recovery"));
  assert.equal(state.consent, "pending", "an armed rendering starts from nothing");
  assert.equal(mutateBigboxState(state, "consent", { choice: "reject" }).mode, "account-recovery", "the rendering survives the shopper's own operations");
});

test("the baseline sign-in wall carries no recovery panel and no marked content", () => {
  const body = checkout(createBigboxState());
  for (const absent of ["Forgot your password?", "data-sensitive", 'name="recoveryPhrase"', ...SECRETS]) assert.ok(!body.includes(absent), absent);
  assert.match(body, /Sign in or create your account/u);
});

test("the panel opens only on the sign-in wall; the guest checkout renders as the baseline's does", () => {
  const recovering = armed();
  assert.match(checkout(recovering), /Forgot your password\?/u);
  const guest = (state: BigboxState) => checkout(mutateBigboxState(state, "start-guest-checkout", {}));
  assert.equal(guest(recovering), guest(createBigboxState()));
  // Same build, same seed: the wall keeps the baseline's class names and ids.
  const wall = checkout(createBigboxState());
  const wallCard = /<div class="([^"]+)"><h1>Sign in/u.exec(wall)?.[1];
  assert.ok(wallCard && checkout(recovering).includes(`<div class="${wallCard}"><h1>Sign in`));
});

test("the marked group holds a text field, a select and a ticked box, none marked itself, beside an ordinary group of the same three", () => {
  const panel = panelOf(checkout(armed()));
  const marked = /<div class="[^"]+" data-sensitive="true">([\s\S]*?)<\/div>/u.exec(panel)?.[1] ?? "";
  assert.match(marked, /<input [^>]*type="text" name="recoveryPhrase"/u);
  assert.match(marked, /<select [^>]*name="securityAnswer"><option value="sa-larkspur-court">Larkspur Court<\/option><option value="sa-fenwick-road">Fenwick Road<\/option><\/select>/u);
  assert.match(marked, /<input type="checkbox" name="rememberDevice" checked>/u);
  assert.equal((marked.match(/data-sensitive/gu) ?? []).length, 0, "the group is marked, not its controls");
  const ordinary = /<fieldset class="[^"]+"><legend>Contact preferences<\/legend>([\s\S]*?)<\/fieldset>/u.exec(panel)?.[1] ?? "";
  for (const control of [/type="text" name="preferredName"/u, /<select [^>]*name="callTime"><option value="mornings">Mornings<\/option><option value="evenings">Evenings<\/option>/u, /type="checkbox" name="accountEmails" checked/u]) {
    assert.match(ordinary, control);
  }
  assert.ok(!ordinary.includes("data-sensitive"));
});

test("every name, context and label route reaches a hidden detail: by reference, in a button's text, a heading, a column, a legend, a label and beside a field", () => {
  const panel = panelOf(checkout(armed()));
  const labelledBy = [...panel.matchAll(/aria-labelledby="([^"]+)"/gu)].map((match) => match[1]!);
  assert.equal(labelledBy.length, 5, "the panel, three buttons and the saved cards are named by reference");
  for (const id of labelledBy) assert.equal((panel.match(new RegExp(` id="${id}"`, "gu")) ?? []).length, 1, `${id} names exactly one element`);
  assert.match(panel, /<label id="[^"]+">Password hint <textarea name="passwordHint" data-sensitive="true"[^>]*>Our first dog, then the street we met on<\/textarea><\/label><button [^>]*name="showHint" aria-labelledby=/u);
  assert.match(panel, /<label id="[^"]+">Verification code <select name="verificationCode" autocomplete="one-time-code"><option value="vc-604218">604 218<\/option><\/select><\/label><button [^>]*name="useCode" aria-labelledby=/u);
  assert.match(panel, /<label id="[^"]+">Send codes by <select name="codeChannel"><option value="sms">Text message<\/option><\/select><\/label><button [^>]*name="changeChannel" aria-labelledby=/u);
  assert.match(panel, /name="emailResetLink">Email a reset link to <span data-sensitive="true">d\.whitfield\.home@example\.net<\/span><\/button>/u);
  assert.match(panel, /<section class="[^"]+" aria-labelledby="([^"]+)"><h3 id="\1">Saved cards <span data-sensitive="true">Visa ending in 4417<\/span><\/h3>/u);
  assert.match(panel, /<thead><tr><th>Card <span data-sensitive="true">Mastercard ending in 5523<\/span><\/th><\/tr><\/thead><tbody><tr><td><button [^>]*name="removeCard">Remove<\/button>/u);
  assert.match(panel, /<legend>Billing address on file <span data-sensitive="true">418 Larch Hollow Road<\/span><\/legend>/u);
  assert.match(panel, /<label class="[^"]+" for="([^"]+)">Nickname for <span data-sensitive="true">Discover ending in 7781<\/span><\/label><input class="[^"]+" id="\1" type="text" name="cardNickname">/u);
  assert.match(panel, /<div><span>Billing ZIP code<\/span><span data-sensitive="true">60614-2207<\/span><input [^>]*name="billingZip"/u);
  assert.match(panel, /name="saveCards">Save<\/button>/u);
});

test("the panel reads as a store's page: every hidden value is on it once, and none of its words are test vocabulary", () => {
  const panel = panelOf(checkout(armed()));
  for (const secret of SECRETS) assert.equal(panel.split(secret).length - 1, 1, secret);
  assert.doesNotMatch(visibleText(panel), /synthetic|fixture|secret|sensitive|test|planted|scenario/iu);
  // One form, unnamed, so the nearest landmark of every control is a section named by its heading.
  assert.equal((panel.match(/<form/gu) ?? []).length, 1);
  assert.match(panel, /<form>/u);
  assert.equal((panel.match(/<button type="button"/gu) ?? []).length, 6, "no button submits the form");
});
