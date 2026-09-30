import { connectFirefoxRdp } from "./rdp-client.js";

/**
 * Installs an unpacked extension into a running Firefox as a temporary add-on,
 * through its remote debugging protocol: the root actor names the add-ons
 * actor, and that actor's `installTemporaryAddon` loads the directory, exactly
 * as about:debugging's "Load Temporary Add-on" does. Firefox must have been
 * started with `-start-debugger-server <port>` and remote debugging allowed
 * without a prompt.
 */
export async function installTemporaryAddon(port: number, addonPath: string, timeoutMs = 30_000): Promise<{ id: string }> {
  const client = await connectFirefoxRdp(port, timeoutMs);
  try {
    const root = await client.request("root", "getRoot");
    const addonsActor = root.addonsActor;
    if (typeof addonsActor !== "string") throw new Error("Firefox's root actor named no add-ons actor");
    const installed = await client.request(addonsActor, "installTemporaryAddon", { addonPath, openDevTools: false });
    const id = (installed.addon as { id?: unknown } | undefined)?.id;
    if (typeof id !== "string") throw new Error("Firefox installed the add-on but did not say its id");
    return { id };
  } finally {
    client.close();
  }
}
