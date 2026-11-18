import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationTabRoutePolicy, type AuthenticationTabRoute } from "..";

const policy = new AuthenticationTabRoutePolicy([
  { origin: "https://CORE.example:443/", pathname: "/connect", includeDescendants: true },
  { origin: "https://core.example", pathname: "/login" },
  { origin: "https://accounts.example", pathname: "/signup", includeDescendants: true }
]);

for (const url of [
  "https://core.example/connect", "https://core.example/connect/authorize?state=synthetic.state#synthetic.fragment",
  "https://core.example/connect/done#code=synthetic.code", "https://core.example/connect/", "https://core.example/login",
  "https://core.example/connec%74/authorize", "https://core.example/connect%2fauthorize",
  "https://accounts.example/signup", "https://accounts.example/signup/continue"
]) test(`known authentication route is excluded: ${url}`, () => {
  assert.equal(policy.allows(url), false);
});

for (const url of [
  "https://core.example/ordinary?continue=/connect/authorize#login", "https://core.example/connective",
  "https://core.example/connect-promo", "https://core.example/login-history", "https://core.example/login/ordinary",
  "https://core.example.evil/connect", "https://core.example@evil.example/connect", "https://core.example:444/connect",
  "http://core.example/connect", "https://ordinary.example/connect/authorize", "https://ordinary.example/login",
  "https://accounts.example/signup-promo", "https://accounts.example/ordinary?next=/signup", "about:blank", "file:///ordinary.txt"
]) test(`ordinary tab remains usable by the authentication predicate: ${url}`, () => {
  assert.equal(policy.allows(url), true);
});

test("default route matching is exact, including signup roots, with explicit path segment descendants", () => {
  const exact = new AuthenticationTabRoutePolicy([{ origin: "https://signup.example", pathname: "/" }]);
  assert.equal(exact.allows("https://signup.example/"), false);
  assert.equal(exact.allows("https://signup.example/ordinary"), true);
  const descendants = new AuthenticationTabRoutePolicy([{ origin: "https://signup.example", pathname: "/register/", includeDescendants: true }]);
  assert.equal(descendants.allows("https://signup.example/register/step"), false);
  assert.equal(descendants.allows("https://signup.example/register-promo"), true);
});

test("missing and malformed URLs refuse without affecting ordinary valid tab schemes", () => {
  for (const value of [undefined, "", "not a URL", "https://[invalid", "https://core.example/%E0%A4"]) assert.equal(policy.allows(value), false);
});

for (const route of [
  { origin: "https://core.example/path", pathname: "/connect" },
  { origin: "https://user:synthetic.secret@core.example", pathname: "/connect" },
  { origin: "file:///core", pathname: "/connect" },
  { origin: "https://core.example", pathname: "//evil.example/connect" },
  { origin: "https://core.example", pathname: "/connect?synthetic.secret" },
  { origin: "https://core.example", pathname: "/connect#synthetic.secret" },
  { origin: "https://core.example", pathname: "/connect/../ordinary" },
  { origin: "https://core.example", pathname: "/connect", includeDescendants: "true" }
]) test("invalid route configuration fails safely instead of broadening known route matching", () => {
  assert.throws(() => new AuthenticationTabRoutePolicy([route as AuthenticationTabRoute]), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Authentication-tab route configuration is invalid.");
    assert.equal(error.cause, undefined);
    return true;
  });
});
