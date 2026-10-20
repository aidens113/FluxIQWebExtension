// Writing a build's memories through to Core's durable domain build state
// (t728, audit finding 8).
//
// Each memory a build keeps across calls (`../arrival.ts`,
// `../shown-addresses.ts`, `../held-literals/`, `../own-layers/`) lived in this
// process alone, so a restarted host forgot them mid-build. Core owns durable
// state (`automationStudioDomainBuildState`), so each memory is written there
// as it changes, under its build (`buildId`), with the brief's `callScope` in
// its key when briefs run side by side, and read back when this process has
// none for that build.
//
// **Ordered and coalesced.** Writes of one key go out one at a time in the
// order they were made, and a write queued behind a running one is replaced by
// a newer one: what reaches the store last is the memory as it last stood. A
// value is encoded when it goes out, not when it is queued.
//
// **Best effort.** The in-process memory stays the authority while the process
// lives. A write Core refuses (a value past its bounds, a full scope) or a
// store that fails leaves the stored copy as it was, which costs exactly what
// a restart cost before this store existed. Nothing is logged: values are
// opaque, and a refusal's code says nothing a reader of the build could act on.
// Reading is stricter: a stored copy Core refuses to read is none to restore,
// and any other failure to read is the call's, never taken for an empty memory.
//
// A call with no build (`./build-key.ts`) keeps nothing durable.

import { AutomationStudioDomainBuildStateRefusal, type AutomationStudioDomainBuildState, type AutomationStudioDomainBuildStateScope } from "fluxiq/automation-studio";
import type { JsonValue } from "fluxiq/core";
import { webNodeBuildSlot, type WebNodeBuildKey } from "./build-key";

/** Where the store comes from: asked when first needed, since a host registers the domain after it builds the runtime. */
export type WebNodeBuildStateSource = () => AutomationStudioDomainBuildState | undefined;

export type WebNodeBuildStatePersistence = {
  /** The stored value of memory `name` for `build`, or undefined when none is stored or Core refuses to read it. */
  read(build: WebNodeBuildKey, name: string): Promise<JsonValue | undefined>;
  /** Queue memory `name` of `build` to be stored as `encode` gives it when the write goes out. */
  write(build: WebNodeBuildKey, name: string, encode: () => JsonValue): void;
  /** Queue memory `name` of `build` to be removed from the store. */
  drop(build: WebNodeBuildKey, name: string): void;
  /** Resolves once every queued write has gone out. Never rejects. */
  settled(): Promise<void>;
};

type Queue = { next: (() => Promise<unknown>) | undefined; running: Promise<void> | undefined };

export function createWebNodeBuildStatePersistence(source: WebNodeBuildStateSource): WebNodeBuildStatePersistence {
  const queues = new Map<string, Queue>();
  const scopeOf = (build: WebNodeBuildKey): AutomationStudioDomainBuildStateScope | undefined =>
    build.buildId === undefined ? undefined : { projectId: build.projectId, flowId: build.flowId, buildId: build.buildId };
  const keyOf = (build: WebNodeBuildKey, name: string): string => (build.callScope === undefined ? name : `${name}:${build.callScope}`);
  const enqueue = (build: WebNodeBuildKey, name: string, step: (store: AutomationStudioDomainBuildState, scope: AutomationStudioDomainBuildStateScope, key: string) => Promise<unknown>): void => {
    const scope = scopeOf(build);
    if (scope === undefined) return;
    const store = source();
    if (store === undefined) return;
    const key = keyOf(build, name);
    const slot = `${webNodeBuildSlot(build)}\u0000${key}`;
    const queue = queues.get(slot) ?? { next: undefined, running: undefined };
    queues.set(slot, queue);
    queue.next = () => step(store, scope, key);
    if (queue.running !== undefined) return;
    queue.running = (async () => {
      while (queue.next !== undefined) {
        const next = queue.next;
        queue.next = undefined;
        try {
          await next();
        } catch {
          /* best-effort: the in-process memory stays the authority, and a lost write costs only what a restart forgets (header) */
        }
      }
      queue.running = undefined;
      if (queues.get(slot) === queue) queues.delete(slot);
    })();
  };
  return {
    async read(build, name) {
      const scope = scopeOf(build);
      const store = scope === undefined ? undefined : source();
      if (scope === undefined || store === undefined) return undefined;
      const key = keyOf(build, name);
      // A write of this key still going out is waited for, so a read never sees the store behind this process.
      await queues.get(`${webNodeBuildSlot(build)}\u0000${key}`)?.running;
      try {
        return await store.get(scope, key);
      } catch (error) {
        // A stored copy Core refuses to read (`document_invalid`) is none to restore, and Core refuses the
        // write that would overwrite it as well. Any other failure is a fault of the store, and is the call's.
        if (error instanceof AutomationStudioDomainBuildStateRefusal) return undefined;
        throw error;
      }
    },
    write(build, name, encode) {
      enqueue(build, name, (store, scope, key) => store.put(scope, key, encode()));
    },
    drop(build, name) {
      enqueue(build, name, (store, scope, key) => store.drop(scope, key));
    },
    async settled() {
      while (true) {
        const running = [...queues.values()].flatMap((queue) => (queue.running === undefined ? [] : [queue.running]));
        if (running.length === 0) return;
        await Promise.all(running);
      }
    }
  };
}
