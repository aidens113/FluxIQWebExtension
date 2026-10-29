// The sign-up request handler: transport-free. Takes a plain request object
// {headers, remoteAddress, rawBody} and returns {status, headers, body}.
// The log holds requestId, outcome, status and ms only.
import { randomUUID } from "node:crypto";
import { createProvisioningClient } from "./provisioning-client.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
import { validateEmail, validateSignup, resolveContinue } from "./validate.mjs";
import { verifyHuman } from "./human-check.mjs";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const UNAVAILABLE = { ok: false, message: "Sign-up is unavailable, try again shortly." };

function jsonResponse(status, payload, extra = {}) {
  return { status, headers: { ...JSON_HEADERS, ...extra }, body: JSON.stringify(payload) };
}

function redirect(location) {
  return { status: 303, headers: { location, "cache-control": "no-store" }, body: "" };
}

function parseBody(req) {
  const type = String(req.headers["content-type"] ?? "").toLowerCase();
  if (type.includes("application/json")) {
    try {
      const parsed = JSON.parse(req.rawBody || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    const out = {};
    for (const [k, v] of new URLSearchParams(req.rawBody)) if (!(k in out)) out[k] = v;
    if (out["cf-turnstile-response"] && !out.humanToken) out.humanToken = out["cf-turnstile-response"];
    return out;
  }
  return null;
}

function wantsJson(req) {
  const type = String(req.headers["content-type"] ?? "").toLowerCase();
  return type.includes("application/json") || String(req.headers.accept ?? "").includes("application/json");
}

function clientIp(req, config) {
  if (config.trustForwardedFor) {
    // The rightmost entry is the one our own proxy appended; earlier ones are client-claimed.
    const parts = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.remoteAddress || "unknown";
}

function sameOrigin(req, config) {
  const origin = req.headers.origin;
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite !== undefined && fetchSite !== "same-origin") return false;
  if (origin !== undefined) return Boolean(config.siteOrigin) && origin === config.siteOrigin;
  return fetchSite === "same-origin";
}

function success(req) {
  return wantsJson(req) ? jsonResponse(202, { ok: true }) : redirect("/check-email/");
}

export function createSignupHandler({ config, log = () => {}, fetchImpl = fetch, now = Date.now, randomId = randomUUID, client, limiter }) {
  const core = client ?? createProvisioningClient({
    url: config.provisioningUrl, tokenFile: config.provisioningTokenFile, fetchImpl, timeoutMs: config.provisioningTimeoutMs
  });
  const limits = limiter ?? createRateLimiter({
    perIp: config.rateLimitPerIp, total: config.rateLimitTotal, windowMs: config.rateLimitWindowMs, now
  });

  function failure(req, kind, fields, jsonStatus, jsonPayload, extra) {
    if (wantsJson(req)) return jsonResponse(jsonStatus, jsonPayload, extra);
    return redirect(`/signup/?error=${kind}&fields=${encodeURIComponent(fields.join(","))}`);
  }

  async function run(req, resend) {
    const requestId = randomId();
    const started = now();
    const done = (outcome, response) => {
      log(`signup requestId=${requestId} outcome=${outcome} status=${response.status} ms=${now() - started}`);
      return response;
    };
    const refuse = (outcome, kind, fields, status, payload, extra) => done(outcome, failure(req, kind, fields, status, payload, extra));
    const unavailable = (outcome) => refuse(outcome, "unavailable", [], 503, UNAVAILABLE);

    if (!config.signupOn) return unavailable("signup_off");
    if (!sameOrigin(req, config)) return refuse("origin", "origin", [], 403, { ok: false });
    const ip = clientIp(req, config);
    const limit = limits.check(ip);
    if (!limit.ok) return refuse("rate", "rate", [], 429, { ok: false }, { "retry-after": String(limit.retryAfterSec) });

    const body = parseBody(req);
    if (!body) return refuse("bad_body", "invalid", [], 400, { ok: false, errors: { body: "Send the form fields." } });

    let value;
    if (resend) {
      const errors = {};
      const email = validateEmail(typeof body.email === "string" ? body.email : undefined, errors);
      if (!email) return refuse("invalid", "invalid", Object.keys(errors), 400, { ok: false, errors });
      value = {
        email,
        humanToken: typeof body.humanToken === "string" ? body.humanToken : undefined,
        continueUrl: typeof body.continue === "string" ? resolveContinue(body.continue, config.appOrigin) : null
      };
    } else {
      const checked = validateSignup(body, config);
      if (!checked.ok) return refuse("invalid", "invalid", Object.keys(checked.errors), 400, { ok: false, errors: checked.errors });
      value = checked.value;
    }

    const human = await verifyHuman({ config, token: value.humanToken, ip, fetchImpl });
    if (!human.ok) {
      if (human.reason === "unreachable") return unavailable("human_unreachable");
      return refuse(`human_${human.reason}`, "invalid", ["humanToken"], 400,
        { ok: false, errors: { humanToken: "Complete the check and try again." } });
    }

    if (resend) {
      const input = { requestId, email: value.email };
      if (value.continueUrl) input.continueUrl = value.continueUrl;
      const answer = await core.sendWelcome(input);
      if (!answer.ok || answer.result?.status !== "accepted") return unavailable(`core_${answer.error?.code ?? "unexpected"}`);
      return done("accepted", success(req));
    }
    const input = {
      requestId, email: value.email, displayName: value.displayName, policies: ["FluxIQUserAccess"],
      workspace: "new", termsVersion: value.termsVersion, sendWelcome: true
    };
    if (value.continueUrl) input.continueUrl = value.continueUrl;
    const answer = await core.createAccount(input);
    const status = answer.ok ? answer.result?.status : undefined;
    if (status !== "created" && status !== "exists") return unavailable(`core_${answer.ok ? "unexpected" : answer.error?.code ?? "unexpected"}`);
    // created and exists are deliberately indistinguishable to the visitor; only the log says which.
    return done(status, success(req));
  }

  async function guarded(req, resend) {
    try {
      return await run(req, resend);
    } catch {
      log("signup outcome=internal_error status=503");
      return failure(req, "unavailable", [], 503, UNAVAILABLE);
    }
  }

  return {
    signup: (req) => guarded(req, false),
    resend: (req) => guarded(req, true),
    config() {
      return jsonResponse(200, {
        humanCheck: config.humanCheck,
        siteKey: config.humanCheck === "turnstile" ? config.turnstileSiteKey : null,
        termsVersion: config.termsVersion,
        inviteRequired: Boolean(config.inviteCodes),
        appOrigin: config.appOrigin,
        signupOn: config.signupOn
      });
    }
  };
}
