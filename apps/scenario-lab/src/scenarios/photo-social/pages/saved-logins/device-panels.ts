import { escapeHtml } from "../../../../html.js";
import { mountId } from "../../look/index.js";
import type { PageContext } from "../context.js";
import { SAVED_LOGINS_VALUES as V } from "./values.js";

/**
 * What the login page shows below its form on a device that remembers its
 * accounts, in three sections each named by its heading:
 *
 * - "Accounts on this device": a list of rows of one template, each the
 *   account's handle, when it was last used, and a password field served with
 *   the remembered password and marked by its type alone. The rows carry the
 *   site's test ids, as the consent dialog's buttons do.
 * - "Backup codes": a list whose every row is nothing but a password field
 *   served with one code.
 * - "Two-step verification": the recent login codes in a `data-sensitive`
 *   list box, and a recovery note in a `data-sensitive` editable region that
 *   holds a contact's phone number in a `<data>` value.
 *
 * Nothing here has a handler: the panel is read, typed into and left.
 */
export function savedLoginPanels(ctx: PageContext): string {
  const { cls } = ctx.look;
  const id = (name: string) => mountId(ctx.seed, `saved-logins-${name}`);
  const accounts = V.accounts.map((account) => `<li data-testid="saved-login" style="display:flex;gap:12px;align-items:center"><span data-testid="saved-login-handle">${escapeHtml(account.handle)}</span><span data-testid="saved-login-last-used" class="${cls.meta}">${escapeHtml(account.lastUsed)}</span><input type="password" data-testid="saved-login-password" name="password-${escapeHtml(account.handle)}" value="${escapeHtml(account.password)}"></li>`).join("");
  const codes = V.backupCodes.map((code, index) => `<li data-testid="backup-code"><input type="password" data-testid="backup-code-value" name="backup-code-${index + 1}" value="${escapeHtml(code)}"></li>`).join("");
  const loginCodes = V.loginCodes.map((code) => `<option>${escapeHtml(code)}</option>`).join("");
  const note = V.recoveryNote;
  return `<section aria-labelledby="${id("accounts")}" style="max-width:320px;margin-top:24px"><h2 id="${id("accounts")}" style="font-size:16px">Accounts on this device</h2><p class="${cls.meta}">Log in with one tap. Remove an account to forget its password on this device.</p><ul data-testid="saved-logins" style="display:grid;gap:8px">${accounts}</ul></section>
<section aria-labelledby="${id("backup")}" style="max-width:320px;margin-top:24px"><h2 id="${id("backup")}" style="font-size:16px">Backup codes</h2><p class="${cls.meta}">Each code works once, when you can't get a login code.</p><ul data-testid="backup-codes" style="display:grid;gap:8px">${codes}</ul></section>
<section aria-labelledby="${id("two-step")}" style="max-width:320px;margin-top:24px;display:grid;gap:8px"><h2 id="${id("two-step")}" style="font-size:16px">Two-step verification</h2><label>Recent login codes <select class="${cls.input}" name="loginCodes" data-sensitive="true" size="2">${loginCodes}</select></label><div class="${cls.input}" contenteditable="true" data-sensitive="true" aria-label="Recovery note">${escapeHtml(note.words)} <data value="${escapeHtml(note.phone)}">${escapeHtml(note.contact)}</data></div></section>`;
}
