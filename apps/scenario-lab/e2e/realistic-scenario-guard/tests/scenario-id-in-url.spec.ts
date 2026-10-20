import { expect, test } from "@playwright/test";
import { scenarioIdInUrl } from "../scenario-id-in-url.js";

// No browser: the URL rule alone.

test("a scenario page, a scenario mutation and a control request name their scenario", () => {
  expect(scenarioIdInUrl("http://127.0.0.1:4100/scenarios/everything-store/")).toBe("everything-store");
  expect(scenarioIdInUrl("http://127.0.0.1:4100/scenarios/basic-form")).toBe("basic-form");
  expect(scenarioIdInUrl("http://127.0.0.1:4100/scenarios/job-board/jobs?q=rust")).toBe("job-board");
  expect(scenarioIdInUrl("http://127.0.0.1:4100/api/modal-flows/accept-offer")).toBe("modal-flows");
  expect(scenarioIdInUrl("http://127.0.0.1:4100/__control/final-state?scenario=sensitive-input")).toBe("sensitive-input");
});

test("any other URL names no scenario", () => {
  expect(scenarioIdInUrl("http://127.0.0.1:4100/")).toBeNull();
  expect(scenarioIdInUrl("http://127.0.0.1:4100/__control/health")).toBeNull();
  expect(scenarioIdInUrl("http://127.0.0.1:4100/assets/app.js")).toBeNull();
  expect(scenarioIdInUrl("chrome-extension://abc/sidepanel/index.html")).toBeNull();
  expect(scenarioIdInUrl("not a url")).toBeNull();
});
