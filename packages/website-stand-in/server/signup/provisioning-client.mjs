// Calls Core's provisioning listener. Never throws, never logs.
import { readFile } from "node:fs/promises";

const unreachable = { ok: false, error: { code: "unreachable" } };

export function createProvisioningClient({ url, tokenFile, fetchImpl = fetch, timeoutMs = 8000 }) {
  async function call(operation, input) {
    let token;
    try {
      token = (await readFile(tokenFile, "utf8")).split(/\r?\n/)[0].trim();
    } catch {
      return unreachable;
    }
    if (!token) return unreachable;
    try {
      const res = await fetchImpl(`${url.replace(/\/+$/, "")}/provisioning/${operation}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const json = await res.json();
      if (json && typeof json === "object" && typeof json.ok === "boolean") return json;
      return { ok: false, error: { code: "bad_response" } };
    } catch {
      return unreachable;
    }
  }
  return {
    createAccount: (input) => call("createAccount", input),
    sendWelcome: (input) => call("sendWelcome", input),
    getAccount: (input) => call("getAccount", input)
  };
}
