import assert from "node:assert/strict";
import test from "node:test";
import { webActionabilityProperty, webActionabilityFromPayload, webActionabilityPayloadCopy } from "..";
import { webActionabilityProperty as browserReader } from "../../../client";
import { webOwnDataProperty } from "../own-data";

test("the browser and host use one strict pure optional-property reader", () => {
  assert.equal(browserReader, webActionabilityProperty);
  for (const actionability of [{ actionable: true }, { actionable: false, cause: "hidden" }, { actionable: false, cause: "disabled" }, { actionable: false, cause: "covered" }]) {
    const source = Object.freeze({ actionability: Object.freeze(actionability) });
    const read = webActionabilityProperty(source);
    assert.deepEqual(read, actionability);
    assert.notEqual(read, actionability);
    assert.deepEqual(webActionabilityFromPayload({ payload: source }), actionability);
  }
  for (const actionability of [undefined, null, [], { actionable: true, cause: undefined }, { actionable: false }, { actionable: false, cause: "other" }, { actionable: false, cause: "covered", text: "private" }]) {
    assert.equal(webActionabilityProperty({ actionability }), undefined);
  }
});

test("optional accessor and proxy carriers are classified without erasing or invoking the actual call", () => {
  let getters = 0;
  const accessor = Object.defineProperty({ actual: "call remains" }, "actionability", {
    get() {
      getters += 1;
      throw new Error("private");
    }
  });
  assert.deepEqual(webOwnDataProperty(accessor, "actionability"), { kind: "accessor" });
  assert.equal(webActionabilityProperty(accessor), undefined);
  const proxy = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("private"); } });
  assert.deepEqual(webOwnDataProperty(proxy, "actionability"), { kind: "unreadable" });
  assert.equal(webActionabilityProperty(proxy), undefined);
  assert.equal(webActionabilityFromPayload({ payload: proxy }), undefined);
  assert.equal(webActionabilityFromPayload(Object.defineProperty({}, "payload", { get() { getters += 1; } })), undefined);
  assert.equal(getters, 0);
  assert.equal(accessor.actual, "call remains");
});

test("the local payload copy never revisits an unreadable optional descriptor and preserves raw facts/descriptors", () => {
  const legacy = { status: "succeeded", payload: { actual: "old browser" } };
  assert.equal(webActionabilityPayloadCopy(legacy), legacy);
  let reads = 0;
  let getters = 0;
  const target = Object.defineProperty({ actual: "kept", actionability: { actionable: true } }, "untouched", { value: 4, enumerable: false });
  const payload = new Proxy(target, {
    getOwnPropertyDescriptor(source, key) {
      if (key === "actionability") {
        reads += 1;
        throw new Error("private optional trap");
      }
      return Object.getOwnPropertyDescriptor(source, key);
    }
  });
  const result = Object.freeze({ status: "succeeded", effectApplied: true, payload });
  const copied = webActionabilityPayloadCopy(result);
  assert.notEqual(copied, result);
  assert.equal(copied.status, "succeeded");
  assert.equal(copied.effectApplied, true);
  assert.equal(copied.payload.actual, "kept");
  assert.equal("actionability" in copied.payload, false);
  assert.deepEqual(Object.getOwnPropertyDescriptor(copied.payload, "untouched"), Object.getOwnPropertyDescriptor(target, "untouched"));
  assert.deepEqual(Object.getOwnPropertyDescriptor(copied, "status"), Object.getOwnPropertyDescriptor(result, "status"));
  assert.equal(result.payload, payload);
  assert.equal(reads, 1);
  const accessor = Object.defineProperty({ actual: "still kept" }, "actionability", {
    enumerable: true,
    get() {
      getters += 1;
      throw new Error("private");
    }
  });
  const clean = webActionabilityPayloadCopy({ payload: accessor });
  assert.equal(JSON.stringify(clean), '{"payload":{"actual":"still kept"}}');
  assert.equal(getters, 0);
});
