import assert from "node:assert/strict";
import { webOfflineReadModelResult } from "../model-result";

const payload = Object.freeze({ url: "http://127.0.0.1:4100/scenarios/everything-store/list", extracted: [{ title: "Fixture", link: "http://127.0.0.1:4100/scenarios/everything-store/item?x=1#detail", external: "https://external.invalid/item", note: null }] });
Object.freeze(payload.extracted[0]);
Object.freeze(payload.extracted);
const parameters = Object.freeze({});
const result = webOfflineReadModelResult(payload, parameters);
assert.ok(result && typeof result === "object" && !Array.isArray(result));
assert.equal(result.origin, "http://127.0.0.1:4100");
assert.deepEqual(result.extracted, [{ title: "Fixture", link: "/scenarios/everything-store/item?x=1#detail", external: "https://external.invalid/item", note: null }]);
assert.equal(payload.extracted[0]?.link, "http://127.0.0.1:4100/scenarios/everything-store/item?x=1#detail");
assert.equal(webOfflineReadModelResult(undefined, parameters), undefined);
console.log("offline model projection delegates without mutating raw rows");
