import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { RenderContext } from "../../types.js";
import { authGateDemoCredentials, authGatePaths, authGateProtectedAccount } from "./constants.js";
import type { AuthGateState } from "./state.js";

/**
 * The start page: a sign-in form that states the demo credentials. Opened
 * with `?expired=1`, it says the session expired. A successful sign-in opens
 * the account page, as real sign-in pages redirect to their destination.
 */
export function renderSignInPage(state: AuthGateState, context: RenderContext): string {
  const body = `<main>
    <h1 id="sign-in-heading">Sign in to your account</h1>
    <p role="alert" data-testid="session-expired" hidden>Your session expired. Sign in again to continue.</p>
    <form data-testid="sign-in-form" aria-labelledby="sign-in-heading">
      <label for="username">Username <input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required data-testid="username"></label>
      <label for="password">Password <input id="password" name="password" type="password" autocomplete="current-password" required data-testid="password"></label>
      <button type="submit" data-testid="sign-in">Sign in</button>
    </form>
    <p role="status" aria-live="polite" data-testid="sign-in-status"></p>
    <aside aria-labelledby="demo-credentials-heading" data-testid="demo-credentials">
      <h2 id="demo-credentials-heading">Demo credentials</h2>
      <p>This is a test fixture. These fixture-only demo credentials work nowhere else; never enter a real password here.</p>
      <dl>
        <dt>Username</dt><dd data-testid="demo-username">${escapeHtml(authGateDemoCredentials.username)}</dd>
        <dt>Password</dt><dd data-testid="demo-password">${escapeHtml(authGateDemoCredentials.password)}</dd>
      </dl>
    </aside>
    <footer><code data-testid="seed-marker">${escapeHtml(state.seedMarker)}</code></footer>
  </main>`;
  const script = `${fixtureClient(context.runToken, "auth-gate")}
const form = document.querySelector('[data-testid="sign-in-form"]');
const submit = document.querySelector('[data-testid="sign-in"]');
const statusLine = document.querySelector('[data-testid="sign-in-status"]');
if (new URLSearchParams(location.search).get('expired') === '1') document.querySelector('[data-testid="session-expired"]').hidden = false;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  statusLine.textContent = 'Signing in';
  const snapshot = await mutate('sign-in', { username: form.elements.username.value, password: form.elements.password.value });
  form.elements.password.value = '';
  if (snapshot.state.lastOperation === 'signed-in') {
    statusLine.textContent = 'Signed in. Opening your account.';
    location.assign(${JSON.stringify(authGatePaths.account)});
    return;
  }
  submit.disabled = false;
  statusLine.textContent = 'The username or password is incorrect.';
});`;
  return page("Sign in", body, script);
}

/** The protected account page; the account route serves it only while the session is valid. */
export function renderAccountPage(state: AuthGateState, context: RenderContext): string {
  const body = `<header>
    <nav aria-label="Account">
      <p>Signed in as <strong data-testid="signed-in-user">${escapeHtml(state.session?.username ?? "")}</strong></p>
      <button type="button" data-testid="sign-out">Sign out</button>
    </nav>
  </header>
  <main>
    <h1 data-testid="account-heading">Your account</h1>
    <section aria-labelledby="account-summary-heading" data-testid="account-summary">
      <h2 id="account-summary-heading">Account summary</h2>
      <dl>
        <dt>Account holder</dt><dd data-testid="account-holder">${escapeHtml(authGateProtectedAccount.holder)}</dd>
        <dt>Plan</dt><dd data-testid="account-plan">${escapeHtml(authGateProtectedAccount.plan)}</dd>
        <dt>Balance due</dt><dd data-testid="account-balance">${escapeHtml(authGateProtectedAccount.balance)}</dd>
      </dl>
    </section>
    <footer><code data-testid="seed-marker">${escapeHtml(state.seedMarker)}</code></footer>
  </main>`;
  const script = `${fixtureClient(context.runToken, "auth-gate")}
document.querySelector('[data-testid="sign-out"]').addEventListener('click', async () => {
  await mutate('sign-out', {});
  location.assign(${JSON.stringify(authGatePaths.start)});
});`;
  return page("Your account", body, script);
}
