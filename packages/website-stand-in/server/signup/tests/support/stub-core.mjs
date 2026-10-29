// Test support: a stub for Core's provisioning listener and Turnstile siteverify.
// Listens on port 0, records every request, answers as scripted.
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSignupConfig } from "../../config.mjs";

export const TOKEN = "t".repeat(40);
export const APP_ORIGIN = "http://127.0.0.1:4800";
export const SITE_ORIGIN = "http://localhost:4810";

const created = () => ({ status: 200, json: { ok: true, result: { status: "created", userId: "u1", workspaceId: "w1" } } });

export async function startStub() {
  const requests = [];
  const stub = {
    requests,
    // Each answer: {status, json} | {destroy:true} | {delayMs, ...}
    provisioning: () => created(),
    siteverify: () => ({ status: 200, json: { success: true } }),
    url: "",
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      const isVerify = req.url.startsWith("/siteverify");
      const record = { url: req.url, headers: req.headers, text, json: isVerify ? null : safeJson(text) };
      requests.push(record);
      const answer = isVerify ? stub.siteverify(record) : stub.provisioning(req.url.split("/").pop(), record);
      const reply = () => {
        if (answer.destroy) return req.socket.destroy();
        res.writeHead(answer.status, { "content-type": "application/json" });
        res.end(answer.raw ?? JSON.stringify(answer.json));
      };
      if (answer.delayMs) setTimeout(reply, answer.delayMs);
      else reply();
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  stub.url = `http://127.0.0.1:${server.address().port}`;
  return stub;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

// A config pointing at the stub, with token / secret / invite files in a temp dir.
export function makeConfig(stub, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "site-stand-in-"));
  const tokenFile = join(dir, "token");
  writeFileSync(tokenFile, `${TOKEN}\nsecond-line-not-used\n`);
  const secretFile = join(dir, "turnstile-secret");
  writeFileSync(secretFile, "turnstile-secret-value\n");
  const env = {
    FLUXIQ_PROVISIONING_URL: stub.url,
    FLUXIQ_PROVISIONING_TOKEN_FILE: tokenFile,
    SITE_APP_ORIGIN: APP_ORIGIN,
    SITE_ORIGIN: SITE_ORIGIN,
    SITE_TERMS_VERSION: "2026-10",
    SITE_HUMAN_CHECK: "off",
    TURNSTILE_SECRET_FILE: secretFile,
    TURNSTILE_SITE_KEY: "site-key-1",
    SITE_TURNSTILE_VERIFY_URL: `${stub.url}/siteverify`,
    ...overrides
  };
  const config = readSignupConfig(env);
  config.dir = dir;
  return config;
}

export const goodBody = () => ({
  email: "Person@Example.COM ", displayName: " Pat Person ", termsAccepted: true, termsVersion: "2026-10"
});

export function jsonRequest(body, headers = {}) {
  return {
    headers: { "content-type": "application/json", origin: SITE_ORIGIN, ...headers },
    remoteAddress: "10.0.0.1",
    rawBody: JSON.stringify(body)
  };
}

export function formRequest(fields, headers = {}) {
  return {
    headers: { "content-type": "application/x-www-form-urlencoded", origin: SITE_ORIGIN, ...headers },
    remoteAddress: "10.0.0.1",
    rawBody: new URLSearchParams(fields).toString()
  };
}
