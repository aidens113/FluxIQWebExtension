// Validates a sign-up body. Pure: no I/O, no logging.
const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const UNSAFE_PATH = /[\\\s\u0000-\u001f\u007f#]/;

function field(body, name, errors) {
  const v = body[name];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") {
    errors[name] = "Enter text.";
    return null;
  }
  return v;
}

// Keeps a continue value only when it is /connect/authorize on the app origin
// (absolute) or the same path form; returns path + query for Core, else null.
export function resolveContinue(raw, appOrigin) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  if (UNSAFE_PATH.test(raw)) return null;
  let url;
  if (raw.startsWith("/")) {
    if (raw.startsWith("//")) return null;
    if (!URL.canParse(raw, "http://path.invalid")) return null;
    url = new URL(raw, "http://path.invalid");
    if (url.origin !== "http://path.invalid") return null;
  } else {
    if (!appOrigin) return null;
    if (!URL.canParse(appOrigin) || !URL.canParse(raw)) return null;
    url = new URL(raw);
    if (url.origin !== new URL(appOrigin).origin) return null;
  }
  if (url.pathname !== "/connect/authorize") return null;
  const out = url.pathname + url.search;
  return out.length <= 2048 ? out : null;
}

// raw: a string or undefined. Records errors.email and returns the cleaned email or null.
export function validateEmail(raw, errors) {
  if (typeof raw !== "string") {
    errors.email = "Enter your email address.";
    return null;
  }
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email) || CONTROL.test(email)) {
    errors.email = "Enter a valid email address.";
    return null;
  }
  return email;
}

export function validateSignup(body, config) {
  const src = body && typeof body === "object" ? body : {};
  const errors = {};
  const emailRaw = field(src, "email", errors);
  const email = errors.email ? null : validateEmail(emailRaw, errors);

  const nameRaw = field(src, "displayName", errors);
  let displayName = null;
  if (!errors.displayName) {
    const name = (nameRaw ?? "").trim();
    if (name.length < 1 || name.length > 80 || CONTROL.test(name)) errors.displayName = "Enter a name of 1 to 80 characters.";
    else displayName = name;
  }

  const t = src.termsAccepted;
  if (!(t === true || t === "on" || t === "true")) errors.termsAccepted = "Accept the terms to continue.";
  const tv = field(src, "termsVersion", errors);
  if (!errors.termsVersion && tv !== config.termsVersion) errors.termsVersion = "The terms changed. Reload and accept again.";

  const inviteRaw = field(src, "inviteCode", errors);
  if (!errors.inviteCode && config.inviteCodes) {
    if (!inviteRaw || !config.inviteCodes.has(inviteRaw.trim())) errors.inviteCode = "Enter a valid invite code.";
  }

  const contRaw = field(src, "continue", errors);
  const cont = errors.continue ? null : resolveContinue(contRaw, config.appOrigin);

  const humanToken = field(src, "humanToken", errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const value = { email, displayName, termsVersion: tv };
  if (cont) value.continueUrl = cont;
  if (humanToken) value.humanToken = humanToken;
  return { ok: true, value };
}
