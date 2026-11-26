import assert from "node:assert/strict";
import test from "node:test";
import { guardViolationLines } from "../guard-violation-lines.js";
import { attemptPanelAddresses } from "../panel-addresses.js";

test("a blocked frame is named in the report, and nothing blocked says nothing", () => {
  assert.deepEqual(guardViolationLines([]), []);
  const [line] = guardViolationLines([{ kind: "request", destination: "http://127.0.0.1:51005/scenarios/x/booking-widget", resourceType: "document" }, { kind: "request", destination: "http://127.0.0.1:3000/api/health", resourceType: "fetch" }]);
  assert.match(line!, /blocked 2 destination\(s\)/u);
  assert.match(line!, /a frame or page load to http:\/\/127\.0\.0\.1:51005\/scenarios\/x\/booking-widget/u);
  assert.match(line!, /a request \(fetch\) to http:\/\/127\.0\.0\.1:3000\/api\/health/u);
});

test("the attempt's panel is given the run's own addresses, so it never probes the product default", () => {
  assert.deepEqual(attemptPanelAddresses({ gatewayUrl: "ws://127.0.0.1:9/client" }, "http://127.0.0.1:8"), { gatewayUrl: "ws://127.0.0.1:9/client", coreApiUrl: "http://127.0.0.1:8" });
  assert.throws(() => attemptPanelAddresses({}, "http://127.0.0.1:8"), /without a gateway/u);
});
