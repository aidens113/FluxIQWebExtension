import type { Page } from "@playwright/test";

/** Forget really reaches Core, then the same request with the now-revoked proof must fail. */
export async function revokeAndProbeCredential(control: Page, coreApiUrl: string, request: unknown): Promise<{ forgotten: boolean; status: number }> {
  return control.evaluate(async (input) => {
    const runtime = (globalThis as any).chrome;
    const all = await runtime.storage.local.get(null) as Record<string, { token?: string; clientId?: string } | undefined>;
    const stored = Object.values(all).find((value) => typeof value?.token === "string" && typeof value?.clientId === "string");
    if (!stored?.token) throw new Error("This browser holds no credential to revoke.");
    const forgotten = await runtime.runtime.sendMessage({ type: "fluxiq.resetSession" }) as { ok?: boolean; forgetReachedCore?: boolean };
    const response = await fetch(`${input.coreApiUrl}/api/programs/automation-studio/append-turn`, {
      method: "POST", credentials: "omit", cache: "no-store",
      headers: { "content-type": "application/json", authorization: `Bearer ${stored.token}` },
      body: JSON.stringify(input.request)
    });
    await response.body?.cancel();
    return { forgotten: forgotten.ok === true && forgotten.forgetReachedCore === true, status: response.status };
  }, { coreApiUrl, request });
}
