// A browser that forgets its pairing with no socket to say so on. Core keeps trusting the
// credential until told, so the credential waits here, in the storage only the extension's
// own pages can read, just long enough to tell it. It is dropped the moment Core has heard,
// and the person is told plainly that Core has not yet.

/** What is kept until Core has heard. */
export type PendingForget = { readonly token: string; readonly coreApiUrl: string; readonly savedAtMs: number };

export type ForgetDeliveryDeps = {
  readonly read: () => Promise<PendingForget | undefined>;
  readonly write: (pending: PendingForget) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly fetch: typeof fetch;
  readonly now: () => number;
};

/** Past this the credential has expired on Core by itself (60 days from its last use), and there is nothing to tell. */
const PENDING_FORGET_MAX_AGE_MS = 60 * 24 * 60 * 60_000;

/** Says it to Core. True when Core answered, whatever it had left to forget. */
async function tellCore(deps: ForgetDeliveryDeps, pending: PendingForget): Promise<boolean> {
  try {
    const response = await deps.fetch(new URL("/api/client-gateway/forget-pairing", pending.coreApiUrl).toString(), { method: "POST", credentials: "omit", headers: { authorization: `Bearer ${pending.token}` } });
    return response.ok;
  } catch (error) {
    console.info("FluxIQ could not reach Core to forget this pairing.", error instanceof Error ? error.name : "non_error");
    return false;
  }
}

/** The person pressed Forget with no socket: tells Core now if it can, otherwise keeps it for the next connection. True when Core heard. */
export async function forgetWithoutSocket(deps: ForgetDeliveryDeps, credential: { token: string; coreApiUrl: string }): Promise<boolean> {
  const pending: PendingForget = { ...credential, savedAtMs: deps.now() };
  if (await tellCore(deps, pending)) return true;
  await deps.write(pending);
  return false;
}

/** Delivers a forget still waiting: when the worker starts, and before a connection. */
export async function deliverPendingForget(deps: ForgetDeliveryDeps): Promise<void> {
  const pending = await deps.read();
  if (!pending) return;
  if (deps.now() - pending.savedAtMs > PENDING_FORGET_MAX_AGE_MS || await tellCore(deps, pending)) await deps.clear();
}
