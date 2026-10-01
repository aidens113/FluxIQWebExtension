import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "@fluxiq-web-extension/domain/node";
import { automationStudioScreenedNodeParameters } from "fluxiq/automation-studio";
import { createdFlowArtifactScreen } from "../artifact-screen.js";

type ScreenInput = Parameters<typeof automationStudioScreenedNodeParameters>[0];

const core = (parameters: ScreenInput) => automationStudioScreenedNodeParameters(parameters, WEB_LLM_DENIED_EVIDENCE_KEYS);
const artifact = (parameters: ScreenInput) => createdFlowArtifactScreen(parameters as never, core(parameters) as never);

test("a navigation's path and query reach the model but the artifact keeps only the origin, and says so", () => {
  const parameters = { url: "https://shop.example/orders/48213?q=jane+doe&page=2" };
  // What the model is shown stays whole: t200's order, untouched here.
  assert.deepEqual(core(parameters), { values: { url: "https://shop.example/orders/48213?q=jane+doe&page=2" }, withheld: [] });
  assert.deepEqual(artifact(parameters), { values: { url: "https://shop.example" }, withheld: ["url"] });
  // A URL that was already bare is carried as written and names nothing.
  assert.deepEqual(artifact({ url: "http://127.0.0.1:4100/" }), { values: { url: "http://127.0.0.1:4100" }, withheld: [] });
});

test("free text a Flow was authored with is withheld from the artifact; closed words and numbers travel", () => {
  const parameters = { text: "Jane Doe, 12 Elm Street", submit: true, pagination: { mode: "next", maxPages: 3 }, where: [{ field: "Price", equals: "19.99" }] };
  const screened = artifact(parameters);
  // A column name and its comparand near the top are the definition's own words, as before t200.
  assert.deepEqual(screened.values, { text: null, submit: true, pagination: { mode: "next", maxPages: 3 }, where: { count: 1, items: [{ field: "Price", equals: "19.99" }] } });
  assert.deepEqual(screened.withheld, ["text"]);
  // The model still sees every one of those values.
  assert.equal(core(parameters).values.text, "Jane Doe, 12 Elm Street");
});

test("everything Core withholds stays withheld, and a list item Core dropped keeps its own index in the paths", () => {
  const parameters = { password: "hunter2", options: ["#login", "Sign in"], kind: "click" };
  const screened = artifact(parameters);
  assert.equal(screened.values.password, null);
  assert.equal(screened.values.kind, "click");
  assert.deepEqual(screened.values.options, { count: 2, items: [null] });
  // `options.0` is Core's (a locator); `options.1` is the artifact's (not a closed word), at its authored index.
  assert.deepEqual([...screened.withheld].sort(), ["options.0", "options.1", "password"]);
});

test("containers keep the artifact's bounds: twelve keys an object, six items beside the count, three levels", () => {
  const wide = Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`k${index}`, index]));
  const screened = artifact(wide);
  assert.equal(Object.keys(screened.values).length, 12);
  assert.deepEqual(screened.withheld, ["k12", "k13"]);
  const long = artifact({ limits: Array.from({ length: 9 }, (_, index) => index) });
  assert.deepEqual(long.values.limits, { count: 9, items: [0, 1, 2, 3, 4, 5] });
  assert.deepEqual(artifact({ a: { b: { c: { d: 1 } } } }), { values: { a: { b: { c: { d: 1 } } } }, withheld: [] });
  assert.deepEqual(artifact({ a: { b: { c: { d: { e: 1 } } } } }), { values: { a: { b: { c: { d: null } } } }, withheld: ["a.b.c.d"] });
});
