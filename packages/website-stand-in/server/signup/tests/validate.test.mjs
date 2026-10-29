import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSignup, resolveContinue } from "../validate.mjs";

const config = { termsVersion: "v1", appOrigin: "http://app.test:4800", inviteCodes: null };
const base = () => ({ email: "A@B.co", displayName: "Ann", termsAccepted: true, termsVersion: "v1" });
const errorsOf = (body, cfg = config) => {
  const r = validateSignup(body, cfg);
  assert.equal(r.ok, false);
  return r.errors;
};

test("accepts a good body and normalises email and name", () => {
  const r = validateSignup({ ...base(), email: "  Pat@Example.COM ", displayName: "  Pat  " }, config);
  assert.equal(r.ok, true);
  assert.equal(r.value.email, "pat@example.com");
  assert.equal(r.value.displayName, "Pat");
  assert.equal(r.value.continueUrl, undefined);
});

test("email rejects missing, malformed, too long and non-string", () => {
  assert.ok(errorsOf({ ...base(), email: undefined }).email);
  assert.ok(errorsOf({ ...base(), email: "nope" }).email);
  assert.ok(errorsOf({ ...base(), email: "a@b" }).email);
  assert.ok(errorsOf({ ...base(), email: `${"a".repeat(250)}@b.co` }).email);
  assert.ok(errorsOf({ ...base(), email: 5 }).email);
  assert.ok(errorsOf({ ...base(), email: ["a@b.co"] }).email);
});

test("displayName is 1 to 80 characters after trimming", () => {
  assert.ok(errorsOf({ ...base(), displayName: "   " }).displayName);
  assert.ok(errorsOf({ ...base(), displayName: "x".repeat(81) }).displayName);
  assert.ok(errorsOf({ ...base(), displayName: 7 }).displayName);
  assert.equal(validateSignup({ ...base(), displayName: "x".repeat(80) }, config).ok, true);
  assert.equal(validateSignup({ ...base(), displayName: "x" }, config).ok, true);
});

test("terms must be accepted (true, on, true-string) at the current version", () => {
  for (const t of [true, "on", "true"]) assert.equal(validateSignup({ ...base(), termsAccepted: t }, config).ok, true);
  for (const t of [false, "off", undefined, "yes", 1]) assert.ok(errorsOf({ ...base(), termsAccepted: t }).termsAccepted);
  assert.ok(errorsOf({ ...base(), termsVersion: "v0" }).termsVersion);
  assert.ok(errorsOf({ ...base(), termsVersion: undefined }).termsVersion);
});

test("invite code is required and checked only when a list is configured", () => {
  const cfg = { ...config, inviteCodes: new Set(["good-code"]) };
  assert.ok(errorsOf(base(), cfg).inviteCode);
  assert.ok(errorsOf({ ...base(), inviteCode: "bad" }, cfg).inviteCode);
  assert.ok(errorsOf({ ...base(), inviteCode: 4 }, cfg).inviteCode);
  assert.equal(validateSignup({ ...base(), inviteCode: " good-code " }, cfg).ok, true);
  assert.equal(validateSignup({ ...base(), inviteCode: "anything" }, config).ok, true);
});

test("unknown fields are ignored", () => {
  const r = validateSignup({ ...base(), password: "x", admin: true }, config);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.value).sort(), ["displayName", "email", "termsVersion"]);
});

test("continue is kept only for /connect/authorize on the app origin, sent as path+query", () => {
  const app = "http://app.test:4800";
  assert.equal(resolveContinue(`${app}/connect/authorize?client=x&state=1`, app), "/connect/authorize?client=x&state=1");
  assert.equal(resolveContinue(`${app}/connect/authorize`, app), "/connect/authorize");
  assert.equal(resolveContinue("/connect/authorize?a=1", app), "/connect/authorize?a=1");
  for (const bad of [
    "//evil.test/connect/authorize", "http://evil.test/connect/authorize?a=1", `${app}/connect/authorizeX`,
    "/connect/authorizeX", `${app}/other`, "https://app.test:4800/connect/authorize", `${app}/connect/authorize#frag`,
    "/connect/authorize?a=\\b", "/connect/authorize ?a=1", "javascript:alert(1)", "", 5, null
  ]) assert.equal(resolveContinue(bad, app), null, String(bad));
  assert.equal(resolveContinue(`${app}/connect/authorize?${"a".repeat(2100)}`, app), null);
});

test("an invalid continue is silently dropped, not an error", () => {
  const r = validateSignup({ ...base(), continue: "//evil.test/connect/authorize" }, config);
  assert.equal(r.ok, true);
  assert.equal("continueUrl" in r.value, false);
  const kept = validateSignup({ ...base(), continue: "http://app.test:4800/connect/authorize?x=1" }, config);
  assert.equal(kept.value.continueUrl, "/connect/authorize?x=1");
});
