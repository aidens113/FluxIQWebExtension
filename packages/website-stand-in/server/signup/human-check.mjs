// Verifies the Turnstile token with the siteverify endpoint. Never logs.
import { readFile } from "node:fs/promises";

// Returns {ok:true} | {ok:false, reason:"missing"|"failed"|"unreachable"}.
export async function verifyHuman({ config, token, ip, fetchImpl = fetch }) {
  if (config.humanCheck === "off") return { ok: true };
  if (!token) return { ok: false, reason: "missing" };
  let secret;
  try {
    secret = (await readFile(config.turnstileSecretFile, "utf8")).split(/\r?\n/)[0].trim();
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!secret) return { ok: false, reason: "unreachable" };
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);
  try {
    const res = await fetchImpl(config.turnstileVerifyUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(config.turnstileTimeoutMs ?? 5000)
    });
    if (!res.ok) return { ok: false, reason: "unreachable" };
    const json = await res.json();
    return json && json.success === true ? { ok: true } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
