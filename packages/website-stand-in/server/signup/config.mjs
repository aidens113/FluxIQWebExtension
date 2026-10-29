// Reads the sign-up configuration from the environment. Secrets stay in files:
// only their paths are held here. The invite list is the one file read at load.
import { readFileSync } from "node:fs";

function intOr(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function readInviteCodes(file) {
  if (!file) return null;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    // Fail closed: refuse to start rather than silently admit nobody (or everybody).
    throw new Error(`SITE_INVITE_CODES_FILE could not be read (${error.code ?? "error"})`, { cause: error });
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  return new Set(lines);
}

export function readSignupConfig(env = process.env) {
  const humanCheck = env.SITE_HUMAN_CHECK === "off" ? "off" : "turnstile";
  const inviteCodesFile = env.SITE_INVITE_CODES_FILE || null;
  return {
    provisioningUrl: env.FLUXIQ_PROVISIONING_URL || "http://127.0.0.1:4801",
    provisioningTokenFile: env.FLUXIQ_PROVISIONING_TOKEN_FILE || null,
    provisioningTimeoutMs: intOr(env.SITE_PROVISIONING_TIMEOUT_MS, 8000),
    appOrigin: env.SITE_APP_ORIGIN || null,
    siteOrigin: env.SITE_ORIGIN || null,
    termsVersion: env.SITE_TERMS_VERSION || "1",
    humanCheck,
    turnstileSecretFile: env.TURNSTILE_SECRET_FILE || null,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    turnstileVerifyUrl: env.SITE_TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    turnstileTimeoutMs: intOr(env.SITE_TURNSTILE_TIMEOUT_MS, 5000),
    inviteCodesFile,
    inviteCodes: readInviteCodes(inviteCodesFile),
    signupOn: env.SITE_SIGNUP !== "off",
    trustForwardedFor: env.SITE_TRUST_FORWARDED_FOR === "1",
    // Defaults: a person fumbling a form stays well inside 10 tries an hour;
    // 500 an hour across the site bounds a flood of mail through Core.
    rateLimitPerIp: intOr(env.SITE_RATE_PER_IP, 10),
    rateLimitTotal: intOr(env.SITE_RATE_TOTAL, 500),
    rateLimitWindowMs: intOr(env.SITE_RATE_WINDOW_MS, 3_600_000),
    port: intOr(env.SITE_PORT, 4810),
    host: env.SITE_HOST || "127.0.0.1"
  };
}
