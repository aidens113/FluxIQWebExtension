import type { AuthenticationTabOwnership, AuthenticationTabSessionArea, AuthenticationTabSessionStore } from "..";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export function memoryStore(browserSessionId = "browser-session.1", initial?: unknown) {
  let ownership = initial;
  const saved: AuthenticationTabOwnership[] = [];
  const store: AuthenticationTabSessionStore = {
    load: async () => ({ browserSessionId, ownership: structuredClone(ownership) }),
    save: async (next) => {
      ownership = structuredClone(next);
      saved.push(structuredClone(next));
    }
  };
  return { store, saved, snapshot: () => structuredClone(ownership) };
}

export function memoryArea(initial: Record<string, unknown> = {}) {
  const values = structuredClone(initial);
  const calls: string[] = [];
  const area: AuthenticationTabSessionArea = {
    get: async (keys) => {
      calls.push("get");
      return Object.fromEntries(keys.map((key) => [key, structuredClone(values[key])]));
    },
    set: async (next) => {
      calls.push("set");
      Object.assign(values, structuredClone(next));
    },
    setAccessLevel: async ({ accessLevel }) => { calls.push(accessLevel); }
  };
  return { area, values, calls };
}
