import assert from "node:assert/strict";
import test from "node:test";
import { SAVED_LOGINS_VALUES as V, createPhotoState, mutatePhotoState, photoModes, photoSocialScenario } from "../index.js";
import type { PhotoState } from "../types.js";

/**
 * The `saved-logins` rendering: the login page on a device that remembers its
 * accounts, whose job is to give the browser specs every construct the
 * redaction rule protects on a realistic page. Every other page must not
 * change at all, and the login page must read as a photo network's page.
 */

const context = { runToken: "photo-social-unit-token-0001", seed: 238 };
const route = (state: PhotoState, subpath: string) => photoSocialScenario.route!(state, { subpath, query: new URLSearchParams(), method: "GET" }, context)!.body as string;
const armed = () => mutatePhotoState(createPhotoState(), "set-mode", { mode: "saved-logins" });
/** The document without its script, which quotes selectors and class names that are not markup. */
const markupOf = (html: string) => html.slice(0, html.indexOf(`<script type="module">`));
/** The login page's main column: from its heading to the end of the last section. */
const loginOf = (state: PhotoState) => {
  const body = markupOf(route(state, "accounts/login"));
  const start = body.indexOf("<h1 style=\"font:italic");
  const end = body.indexOf("</main>");
  assert.ok(start >= 0 && end > start, "the login page has no main column");
  return body.slice(start, end);
};
const formOf = (main: string) => main.slice(main.indexOf("<form"), main.indexOf("</form>") + "</form>".length);
const visibleText = (markup: string) => markup.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gu, " ").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
const HIDDEN = [
  V.password, V.passwordHint, V.securityAnswer.value, V.securityAnswer.label,
  ...V.accounts.map((account) => account.password), ...V.backupCodes, ...V.loginCodes,
  V.recoveryNote.words, V.recoveryNote.contact, V.recoveryNote.phone,
];

test("saved-logins is armed through set-mode, starts the visit over, and is never the default", () => {
  assert.ok(photoModes.includes("saved-logins"));
  assert.equal(createPhotoState().mode, "baseline");
  const answered = mutatePhotoState(createPhotoState(), "consent", { choice: "essential" });
  const state = mutatePhotoState(answered, "set-mode", { mode: "saved-logins" });
  assert.deepEqual({ ...state, activity: [] }, { ...createPhotoState("saved-logins"), activity: [] });
  assert.equal(state.consent, "pending", "an armed rendering starts from nothing");
  assert.equal(mutatePhotoState(state, "consent", { choice: "essential" }).mode, "saved-logins", "the rendering survives the visitor's own operations");
});

test("the baseline login page carries no remembered sign-in, no marked content and none of the hidden values", () => {
  const main = loginOf(createPhotoState());
  for (const absent of ["data-sensitive", "value=", "Accounts on this device", "Backup codes", "Two-step verification", "Password hint", ...HIDDEN]) assert.ok(!main.includes(absent), absent);
  assert.match(main, /<p role="alert" class="[^"]+" hidden>Sorry, your password was incorrect\. Please double-check your password\.<\/p><\/form><\/div>$/u, "nothing follows the form");
});

test("every page but the login page renders as the baseline's does", () => {
  const baseline = createPhotoState();
  const saved = armed();
  for (const subpath of ["harbourlight.studio", "explore", "verified/subscribe", "direct/inbox", "tamsin.reyes/saved"]) {
    assert.equal(markupOf(route(saved, subpath)), markupOf(route(baseline, subpath)), subpath);
  }
  assert.equal(markupOf(photoSocialScenario.render(saved, context)), markupOf(photoSocialScenario.render(baseline, context)));
});

test("the login form is pre-filled with the remembered sign-in and offers a marked hint and answer beside an ordinary select", () => {
  const form = formOf(loginOf(armed()));
  assert.match(form, /<input class="[^"]+" name="username" aria-label="Phone number, username, or email" placeholder="Phone number, username, or email" autocomplete="username" value="tamsin\.reyes">/u);
  assert.match(form, /<input class="[^"]+" name="password" type="password" aria-label="Password" placeholder="Password" autocomplete="current-password" value="kelp-lantern-0417">/u);
  const hint = /<label id="([^"]+)" style="flex:1">Password hint <textarea class="[^"]+" name="passwordHint" data-sensitive="true" rows="1" readonly>The boat Grandad named, then the year we moved<\/textarea><\/label><div role="button" tabindex="0" class="[^"]+" aria-labelledby="([^"]+)">Show<\/div>/u.exec(form);
  assert.ok(hint, "the hint's label names the Show control beside it");
  assert.equal(hint[1], hint[2]);
  assert.equal(count(form, ` id="${hint[1]}"`), 1, "the reference names exactly one element");
  assert.match(form, /<label>Security question <select class="[^"]+" name="securityAnswer" data-sensitive="true"><option value="sq-wren-cottage">Wren Cottage<\/option><\/select><\/label>/u);
  assert.match(form, /<label>Stay logged in <select class="[^"]+" name="stayLoggedIn"><option value="30-days">For 30 days<\/option><\/select><\/label>/u);
  assert.equal(count(form, "data-sensitive"), 2, "only the hint and the answer are marked");
});

test("the accounts on this device are rows of one template, each password marked by its type alone, and the backup codes are rows of nothing but a password", () => {
  const main = loginOf(armed());
  const after = main.slice(main.indexOf("</form>"));
  const rows = [...after.matchAll(/<li data-testid="saved-login"[^>]*>([\s\S]*?)<\/li>/gu)].map((match) => match[1]!);
  assert.deepEqual(rows, V.accounts.map((account) =>
    `<span data-testid="saved-login-handle">${account.handle}</span><span data-testid="saved-login-last-used" class="${/data-testid="saved-login-last-used" class="([^"]+)"/u.exec(after)![1]}">${account.lastUsed}</span><input type="password" data-testid="saved-login-password" name="password-${account.handle}" value="${account.password}">`));
  const codes = [...after.matchAll(/<li data-testid="backup-code">([\s\S]*?)<\/li>/gu)].map((match) => match[1]!);
  assert.deepEqual(codes, V.backupCodes.map((code, index) => `<input type="password" data-testid="backup-code-value" name="backup-code-${index + 1}" value="${code}">`));
  assert.match(after, /<label>Recent login codes <select class="[^"]+" name="loginCodes" data-sensitive="true" size="2"><option>481 093<\/option><option>772 510<\/option><\/select><\/label>/u);
  assert.match(after, /<div class="[^"]+" contenteditable="true" data-sensitive="true" aria-label="Recovery note">Spare phone is with <data value="\+44 7700 900461">Aunt Rosalind<\/data><\/div>/u);
  assert.equal(count(after, "data-sensitive"), 2, "only the list box and the note are marked; the rows' passwords are marked by type");
  for (const heading of ["Accounts on this device", "Backup codes", "Two-step verification"]) {
    assert.match(after, new RegExp(`<section aria-labelledby="([^"]+)"[^>]*><h2 id="\\1"[^>]*>${heading}</h2>`, "u"), heading);
  }
});

test("the login page reads as a photo network's page: every hidden value is on it as often as it is shown, and none of its words are test vocabulary", () => {
  const main = loginOf(armed());
  // The remembered sign-in's password is also the first account's.
  assert.equal(count(main, V.password), 2);
  for (const value of HIDDEN.filter((entry) => entry !== V.password)) assert.equal(count(main, value), 1, value);
  assert.doesNotMatch(visibleText(main), /synthetic|fixture|secret|sensitive|test|planted|scenario/iu);
  assert.equal(count(main, "<form"), 1, "one form");
  assert.equal(count(main, "<button"), 0, "nothing on the page submits the form");
});
