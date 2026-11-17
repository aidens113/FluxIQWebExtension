import type { AuthenticationTabSessionArea } from "../authentication-tabs";
import { HostedPkceFailure, readPkceAttemptEnvelope, type HostedPkceAttemptEnvelope, type HostedPkceAttemptStore } from "../connect/pkce";
import type { BrowserSessionPkceAttemptOptions } from "./options";
import { serializePkceAttemptStorage } from "./serial";
import { PkceAttemptSession } from "./session";

const KEY = "fluxiq.authenticationAttempts.pkce";

async function storage<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch { throw new HostedPkceFailure("attempt_store_unavailable"); }
}

function parse(value: unknown): HostedPkceAttemptEnvelope {
  try { return readPkceAttemptEnvelope(value); }
  catch { throw new HostedPkceFailure("attempt_invalid"); }
}

/** Private browser-session state only. One background owner; no local/sync or memory substitute. */
export function browserSessionPkceAttemptStore(options: BrowserSessionPkceAttemptOptions): HostedPkceAttemptStore {
  const session = new PkceAttemptSession(options.authenticationTabs);
  const supplied = options.area;
  const area = (): AuthenticationTabSessionArea => {
    const selected = supplied ?? (globalThis as { chrome?: { storage?: { session?: AuthenticationTabSessionArea } } }).chrome?.storage?.session;
    if (!selected) throw new HostedPkceFailure("attempt_store_unavailable");
    return selected;
  };
  const write = async (selected: AuthenticationTabSessionArea, identity: string, value: HostedPkceAttemptEnvelope) => {
    session.assert(identity);
    await storage(() => selected.set({ [KEY]: value }));
    session.assert(identity);
    return value;
  };
  const read = async (selected: AuthenticationTabSessionArea, identity: string) => {
    await storage(async () => { await selected.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }); });
    session.assert(identity);
    const saved = await storage(() => selected.get([KEY]));
    session.assert(identity);
    const existing = saved[KEY] === undefined ? undefined : parse(saved[KEY]);
    if (existing?.browserSessionId === identity) return existing;
    // Session storage normally expires this data. A valid old-session record
    // is cleared durably; malformed state is never silently reset.
    return write(selected, identity, parse({ browserSessionId: identity, revision: 0, attempt: null }));
  };
  return Object.freeze({
    load: async () => {
      const selected = area();
      return serializePkceAttemptStorage(selected, async () => {
        const identity = await session.ready();
        return read(selected, identity);
      });
    },
    compareAndSwap: async (expected: Parameters<HostedPkceAttemptStore["compareAndSwap"]>[0], next: Parameters<HostedPkceAttemptStore["compareAndSwap"]>[1]) => {
      const expectedId = expected.browserSessionId;
      const expectedRevision = expected.revision;
      const proposed = parse({ browserSessionId: expectedId, revision: expectedRevision + 1, attempt: next });
      const selected = area();
      return serializePkceAttemptStorage(selected, async () => {
        const identity = await session.ready();
        if (expectedId !== identity) return false;
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new HostedPkceFailure("attempt_invalid");
        const current = await read(selected, identity);
        session.assert(identity);
        if (current.revision !== expectedRevision) return false;
        await write(selected, identity, proposed);
        session.assert(identity);
        return true;
      });
    }
  });
}
