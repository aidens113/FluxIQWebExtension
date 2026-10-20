// One kind of build memory, held per build in this process and written through
// to Core's store (t728).
//
// Every build memory is read synchronously on the hot path of a call -- whether
// the build has arrived, whether an address was shown -- so the in-process map
// stays in front of the store. The runtime restores a build's memories before
// each call (`restore`), which reads the store only when this process holds
// nothing for that build and has not read it yet: the first call after a
// restart. Each change is written through (`saved`); a fresh opening forgets
// both copies (`forget`).
//
// Bounded per process as every build memory always was (`REMEMBERED_BUILDS` in
// each): a build let go here stays in the store, and is read back if it calls
// again. Core bounds what it keeps per Flow on its side.

import type { JsonValue } from "fluxiq/core";
import { webNodeBuildSlot, type WebNodeBuildKey } from "./build-key";
import type { WebNodeBuildStatePersistence } from "./persistence";

export type WebNodeBuildMemory<T> = {
  /** Read `build`'s stored copy when this process holds none for it and has not read it yet. */
  restore(build: WebNodeBuildKey): Promise<void>;
  /** `build`'s memory, or undefined when it has none. */
  get(build: WebNodeBuildKey): T | undefined;
  /** `build`'s memory, made from `empty` when it has none, as the newest kept. */
  entry(build: WebNodeBuildKey, empty: () => T): T;
  /** `build`'s memory changed: write it through. */
  saved(build: WebNodeBuildKey): void;
  /** Forget `build`'s memory, here and in the store. */
  forget(build: WebNodeBuildKey): void;
};

export function createWebNodeBuildMemory<T>(options: {
  /** The memory's name in the store, unique among this domain's memories. */
  name: string;
  /** How many builds this process holds at once. */
  bound: number;
  encode(memory: T): JsonValue;
  /** The memory a stored value holds, or undefined for a value that is not one. */
  decode(stored: JsonValue): T | undefined;
  persistence: WebNodeBuildStatePersistence | undefined;
}): WebNodeBuildMemory<T> {
  const held = new Map<string, T>();
  // Builds whose stored copy this process has read, or knows is gone: never read again while held.
  const known = new Set<string>();
  const newest = (slot: string, memory: T): void => {
    held.delete(slot);
    held.set(slot, memory);
    for (const oldest of held.keys()) {
      if (held.size <= options.bound) break;
      held.delete(oldest);
      known.delete(oldest);
    }
  };
  return {
    async restore(build) {
      const slot = webNodeBuildSlot(build);
      if (options.persistence === undefined || build.buildId === undefined || known.has(slot) || held.has(slot)) return;
      const stored = await options.persistence.read(build, options.name);
      known.add(slot);
      if (stored === undefined || held.has(slot)) return;
      const memory = options.decode(stored);
      if (memory !== undefined) newest(slot, memory);
    },
    get: (build) => held.get(webNodeBuildSlot(build)),
    entry(build, empty) {
      const slot = webNodeBuildSlot(build);
      const memory = held.get(slot) ?? empty();
      newest(slot, memory);
      return memory;
    },
    saved(build) {
      const memory = held.get(webNodeBuildSlot(build));
      if (memory !== undefined) options.persistence?.write(build, options.name, () => options.encode(memory));
    },
    forget(build) {
      const slot = webNodeBuildSlot(build);
      held.delete(slot);
      known.add(slot);
      options.persistence?.drop(build, options.name);
    }
  };
}
