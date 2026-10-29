// Scripted sign-up round trip against a running stand-in stack (`site:up`).
//
//   node scripts/round-trip.mjs --site http://localhost:P --app http://127.0.0.1:P \
//     --prov http://127.0.0.1:P --token-file <file> --mail <outbox dir>
//
// Steps (one PASS/FAIL line each, non-secret facts only; the welcome token, the
// password, the bearer token and the mail text are never printed):
//   1 sign-up on the site answers 202
//   2 the welcome mail arrives and links to the app's /welcome#token=
//   3 the password is set on the app exactly like the page does
//   4 Core's listener reports the account active
//   5 a second sign-up with the same email answers identically, and an
//     account-exists mail follows; /api/signup/resend answers the same 202
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POLL_MS = 250;
const MAIL_WAIT_MS = 15_000;

function readMail(dir) {
  let names;
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const mails = [];
  for (const name of names) {
    try {
      mails.push({ name, ...JSON.parse(readFileSync(path.join(dir, name), "utf8")) });
    } catch {
      /* best-effort: a file mid-write is read on the next poll */
    }
  }
  return mails;
}

async function waitForMail(dir, wanted, seen) {
  const deadline = Date.now() + MAIL_WAIT_MS;
  for (;;) {
    const found = readMail(dir).find((mail) => !seen.has(mail.name) && wanted(mail));
    if (found) return found;
    if (Date.now() > deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function postJson(url, body, headers) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), redirect: "manual" });
  const text = await response.text();
  return { status: response.status, text };
}

/**
 * @param {{ site: string, app: string, prov: string, tokenFile: string, mail: string, log?: (line: string) => void }} input
 * @returns {Promise<{ ok: boolean, steps: { step: number, name: string, ok: boolean, note: string }[] }>}
 */
export async function runRoundTrip(input) {
  const log = input.log ?? ((line) => console.log(line));
  const steps = [];
  const record = (step, name, ok, note) => {
    steps.push({ step, name, ok, note });
    log(`step ${step} ${ok ? "PASS" : "FAIL"} ${name}${note ? `: ${note}` : ""}`);
    return ok;
  };
  const finish = () => ({ ok: steps.length > 0 && steps.every((s) => s.ok), steps });

  const siteOrigin = new URL(input.site).origin;
  const appOrigin = new URL(input.app).origin;
  const email = `rt-${randomBytes(5).toString("hex")}@example.test`;
  const signup = { email, displayName: "Round Trip", termsAccepted: true, termsVersion: "stand-in-1" };
  const seen = new Set(readMail(input.mail).map((mail) => mail.name));

  // 1
  let first;
  try {
    first = await postJson(`${siteOrigin}/api/signup`, signup, { origin: siteOrigin, accept: "application/json" });
  } catch (error) {
    record(1, "site sign-up", false, `site unreachable (${error.cause?.code ?? error.name})`);
    return finish();
  }
  if (!record(1, "site sign-up", first.status === 202, `status ${first.status}`)) return finish();

  // 2
  const welcome = await waitForMail(input.mail, (mail) => mail.template === "welcome" && mail.to === email, seen);
  if (!welcome) {
    record(2, "welcome mail", false, `no welcome mail in the folder within ${MAIL_WAIT_MS / 1000}s`);
    return finish();
  }
  seen.add(welcome.name);
  const link = /https?:\/\/[^\s"<>]+\/welcome#token=([A-Za-z0-9_-]+)/u.exec(String(welcome.text ?? ""));
  if (!link) {
    record(2, "welcome mail", false, "mail holds no welcome link with #token=");
    return finish();
  }
  const linkUrl = new URL(link[0]);
  const token = link[1];
  const originOk = linkUrl.origin === appOrigin;
  if (!record(2, "welcome mail", originOk && linkUrl.pathname === "/welcome" && token.length === 43, `template welcome, link origin ${originOk ? "is" : "is NOT"} the app origin, path ${linkUrl.pathname}, token length ${token.length}`)) return finish();

  // 3
  const password = randomBytes(18).toString("base64url");
  let submitted;
  try {
    submitted = await postJson(`${appOrigin}/welcome/submit`, { token, password }, { origin: appOrigin });
  } catch (error) {
    record(3, "set password", false, `app unreachable (${error.cause?.code ?? error.name})`);
    return finish();
  }
  let submitBody = {};
  try {
    submitBody = JSON.parse(submitted.text);
  } catch {
    /* best-effort: a non-JSON answer is reported by status alone */
  }
  if (!record(3, "set password", submitted.status === 200 && submitBody.ok === true, `status ${submitted.status}${submitBody.ok === true ? "" : `, code ${String(submitBody.code ?? "none")}`}`)) return finish();

  // 4
  const bearer = readFileSync(input.tokenFile, "utf8").split(/\r?\n/u)[0].trim();
  let account;
  try {
    account = await postJson(`${input.prov.replace(/\/$/u, "")}/provisioning/getAccount`, { email }, { authorization: `Bearer ${bearer}` });
  } catch (error) {
    record(4, "listener getAccount", false, `listener unreachable (${error.cause?.code ?? error.name})`);
    return finish();
  }
  let accountBody = {};
  try {
    accountBody = JSON.parse(account.text);
  } catch {
    /* best-effort: a non-JSON answer is reported by status alone */
  }
  const state = accountBody.ok === true ? accountBody.result?.status : undefined;
  if (!record(4, "listener getAccount", account.status === 200 && state === "active", `status ${account.status}, account status ${String(state ?? accountBody.error?.code ?? "none")}`)) return finish();

  // 5
  let second;
  try {
    second = await postJson(`${siteOrigin}/api/signup`, signup, { origin: siteOrigin, accept: "application/json" });
  } catch (error) {
    record(5, "repeat sign-up", false, `site unreachable (${error.cause?.code ?? error.name})`);
    return finish();
  }
  const same = second.status === first.status && second.text === first.text;
  const exists = await waitForMail(input.mail, (mail) => mail.template === "account-exists" && mail.to === email, seen);
  if (exists) seen.add(exists.name);
  let resend;
  try {
    resend = await postJson(`${siteOrigin}/api/signup/resend`, { email }, { origin: siteOrigin, accept: "application/json" });
  } catch (error) {
    resend = { status: 0, text: String(error.name) };
  }
  const resendSame = resend.status === first.status && resend.text === first.text;
  record(5, "repeat sign-up", same && exists !== undefined && resendSame, `status ${second.status} (first ${first.status}), body ${same ? "identical" : "DIFFERS"}, account-exists mail ${exists ? "arrived" : "MISSING"}, resend status ${resend.status} ${resendSame ? "same" : "DIFFERS"}`);
  return finish();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/u, "")] = argv[i + 1];
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs(process.argv.slice(2));
  const missing = ["site", "app", "prov", "token-file", "mail"].filter((name) => !args[name]);
  if (missing.length > 0) {
    console.error(`usage: round-trip.mjs --site URL --app URL --prov URL --token-file FILE --mail DIR (missing: ${missing.join(", ")})`);
    process.exit(2);
  }
  const result = await runRoundTrip({ site: args.site, app: args.app, prov: args.prov, tokenFile: args["token-file"], mail: args.mail });
  console.log(result.ok ? "round trip PASS" : "round trip FAIL");
  process.exit(result.ok ? 0 : 1);
}
