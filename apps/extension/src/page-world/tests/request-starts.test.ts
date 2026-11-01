import assert from "node:assert/strict";
import test from "node:test";
import { installRequestStartWatch } from "../request-starts";
import { REQUEST_HEALTH_EVENT, REQUEST_MARK_EVENT, REQUEST_SINCE_EVENT } from "../../shared/request-start-event";

class Probe extends Event {
  constructor(type: string, private readonly pressed: EventTarget) { super(type, { cancelable: true }); }
  override composedPath(): EventTarget[] { return [this.pressed]; }
}

function requests(options: { missingFetch?: boolean; partialFetch?: boolean; missingXhr?: boolean; absentBeacon?: boolean } = {}) {
  const globals = globalThis as Record<string, unknown>;
  const names = ["window", "chrome", "XMLHttpRequest", "Navigator", "WebSocket"];
  const previous = Object.fromEntries(names.map((name) => [name, globals[name]]));
  const host = Object.assign(new EventTarget(), { fetch: () => 1 });
  if (options.missingFetch) Reflect.deleteProperty(host, "fetch");
  if (options.partialFetch) Object.defineProperty(host, "fetch", { value: () => 1, writable: false, configurable: false });
  class Xhr { send(): void {} }
  class NavigatorStandin {}
  if (!options.absentBeacon) Reflect.set(NavigatorStandin.prototype, "sendBeacon", () => true);
  class Socket { send(): void {} }
  globals.window = host;
  globals.chrome = undefined;
  globals.XMLHttpRequest = options.missingXhr ? undefined : Xhr;
  globals.Navigator = NavigatorStandin;
  globals.WebSocket = Socket;
  const pressed = new EventTarget();
  assert.equal(installRequestStartWatch(), true);
  const ask = (name: string): boolean => !host.dispatchEvent(new Probe(name, pressed));
  return { host, NavigatorStandin, ask, restore: () => Object.assign(globals, previous) };
}

test("positive request health requires baseline fetch/XHR and intact installed slots, independently of legacy acknowledgement", () => {
  for (const options of [{}, { missingFetch: true }, { missingXhr: true }, { partialFetch: true }]) {
    const f = requests(options);
    try {
      assert.equal(f.ask(REQUEST_MARK_EVENT), true);
      assert.equal(f.ask(REQUEST_HEALTH_EVENT), Object.keys(options).length === 0);
      assert.equal(f.ask(REQUEST_SINCE_EVENT), false);
      if (Object.keys(options).length === 0) {
        f.host.fetch();
        assert.equal(f.ask(REQUEST_SINCE_EVENT), true);
        f.host.fetch = () => 1;
        assert.equal(f.ask(REQUEST_HEALTH_EVENT), false);
      }
    } finally { f.restore(); }
  }
});

test("a newly supplied optional request method cannot escape the positive health query", () => {
  const f = requests({ absentBeacon: true });
  try {
    f.ask(REQUEST_MARK_EVENT);
    assert.equal(f.ask(REQUEST_HEALTH_EVENT), true);
    Reflect.set(f.NavigatorStandin.prototype, "sendBeacon", () => true);
    assert.equal(f.ask(REQUEST_HEALTH_EVENT), false);
  } finally { f.restore(); }
});

test("request health refuses accessor replacements without invoking their page getters", () => {
  const f = requests();
  try {
    f.ask(REQUEST_MARK_EVENT);
    const original = f.host.fetch;
    let reads = 0;
    Object.defineProperty(f.host, "fetch", { configurable: true, get() { reads += 1;
      return original; } });
    assert.equal(f.ask(REQUEST_HEALTH_EVENT), false);
    assert.equal(reads, 0);
  } finally { f.restore(); }
  const constructors = requests();
  const before = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  try {
    constructors.ask(REQUEST_MARK_EVENT);
    assert.ok(before && Object.hasOwn(before, "value"));
    let reads = 0;
    Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, get() { reads += 1;
      return before.value; } });
    assert.equal(constructors.ask(REQUEST_HEALTH_EVENT), false);
    assert.equal(reads, 0);
  } finally {
    if (before) Object.defineProperty(globalThis, "XMLHttpRequest", before);
    constructors.restore();
  }
});
