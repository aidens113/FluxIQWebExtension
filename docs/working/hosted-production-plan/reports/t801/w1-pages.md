# t801 W1-pages report

## Outcome
Done (pages written; served-by-backend check not possible, see Not verified).

## What changed
All under `packages/website-stand-in/public/`: `index.html`, `site.css`, `signup/{index.html,signup.js}`, `check-email/{index.html,check-email.js}`, `signin/{index.html,signin.js}`. No dependencies, no external fonts; the only external script is Cloudflare Turnstile, loaded by signup.js only when config says so.

## Field names (signup form)
Form POST /api/signup: `email`, `displayName`, `inviteCode` (field hidden until config.inviteRequired), `termsAccepted` (checkbox), hidden `termsVersion` (filled from config), hidden `continue` (from the page's `?continue=`). Human check container `#human-check`; Turnstile adds `cf-turnstile-response` itself on the form path, and the JS path sends it as `humanToken` in the JSON. Error slots exist for email, displayName, inviteCode, termsAccepted, termsVersion, humanToken. No password field. Resend posts JSON `{email}`; email kept in sessionStorage key `fluxiq-signup-email` (try/catch).

## appOrigin dependency (lead action)
signin.js reads OPTIONAL `appOrigin` from GET /api/signup/config and links "Continue to sign in" to `<appOrigin>/login`. The interface's config answer does not include it, so the backend's config answer needs `appOrigin: config.appOrigin (SITE_APP_ORIGIN)` added; until then the page shows "Sign-in is not available from this page right now". Signin needs JS (noscript note shown).

## Other notes
- Terms/privacy links point to `/terms/` and `/privacy/`, which do not exist yet (placeholders).
- No-JS path: errors from `?error=<invalid|rate|unavailable|origin>&fields=a,b` are shown by signup.js too, so they appear only when JS is on after a redirect; with JS fully off the banner is NOT rendered (a static page cannot read the query). Open gap: the backend could render it, or accept this.
- All server text goes through textContent.

## Commands run
`node --check` on the three JS files: see final contract. Pages checked by reading only.

## Not verified
Nothing served: `server/` did not exist when I finished, so no curl check. No browser run; Turnstile path untested; tag matching read by eye, no script run.
