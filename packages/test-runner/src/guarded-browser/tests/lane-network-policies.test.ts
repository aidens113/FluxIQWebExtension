import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedDeterministicDestination } from "../../network-guard.js";
import { loopbackLanePolicies } from "../lane-network-policies.js";
import { panelNetworkPolicy } from "../panel-network-policy.js";

// The endpoints of one demo or UI end-to-end lane, on its allocated ports.
const SCENARIO = "http://127.0.0.1:41001";
const PANEL = "http://127.0.0.1:41002";
const GATEWAY = "ws://127.0.0.1:41003/client";
const policies = loopbackLanePolicies({ scenarioOrigin: SCENARIO, scenarioLabToken: "lab-token", fluxiqOrigin: PANEL, gatewayUrl: GATEWAY });

/** Destinations no browser in these lanes legitimately reaches. */
const NEVER = [
  // A model provider: an LLM lane's provider calls are made by Core's Node process, never by a browser.
  "https://api.deepseek.com/chat/completions",
  "https://example.com/",
  // The user's own panel and gateway, and the fixed demo defaults, on this machine.
  "http://127.0.0.1:3000/", "ws://127.0.0.1:4711/client", "http://127.0.0.1:3300/", "ws://127.0.0.1:4877/client",
  // An unlisted loopback port, which only a signed Lab origin proof can admit.
  "http://127.0.0.1:41999/",
  // Another loopback address, which is not the Lab.
  "http://127.0.0.2:41001/",
];

test("the extension's browser reaches the Lab, the panel API and the gateway socket, and nothing else", () => {
  for (const url of [
    `${SCENARIO}/scenarios/basic-form/`, "http://localhost:41001/scenarios/basic-form/",
    `${PANEL}/api/programs/automation-studio/runs`, GATEWAY,
    "chrome-extension://extension-id/sidepanel/index.html",
  ]) assert.equal(isAllowedDeterministicDestination(url, policies.extension), true, url);
  for (const url of [
    ...NEVER,
    // The panel's HTTP origin carries no WebSocket, and the gateway port serves no pages.
    "ws://127.0.0.1:41002/", "http://127.0.0.1:41003/client",
  ]) assert.equal(isAllowedDeterministicDestination(url, policies.extension), false, url);
});

test("a second Lab port is admitted only by the Lab's signed proof, as in a scenario run", () => {
  assert.equal(typeof policies.extension.verifyScenarioOrigin, "function");
  assert.equal(policies.panel.verifyScenarioOrigin, undefined);
});

test("the panel's browser reaches the panel and nothing else", () => {
  assert.deepEqual(policies.panel, panelNetworkPolicy(PANEL));
  assert.equal(isAllowedDeterministicDestination(`${PANEL}/`, policies.panel), true);
  assert.equal(isAllowedDeterministicDestination(`${PANEL}/_next/static/chunks/main.js`, policies.panel), true);
  for (const url of [...NEVER, `${SCENARIO}/scenarios/basic-form/`, GATEWAY, "ws://127.0.0.1:41002/"]) {
    assert.equal(isAllowedDeterministicDestination(url, policies.panel), false, url);
  }
});
