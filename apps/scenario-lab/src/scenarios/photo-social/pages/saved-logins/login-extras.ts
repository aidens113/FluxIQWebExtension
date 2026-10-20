import { escapeHtml } from "../../../../html.js";
import { mountId } from "../../look/index.js";
import type { PageContext } from "../context.js";
import { SAVED_LOGINS_VALUES as V } from "./values.js";

/**
 * What the login form gains on a device that remembers its accounts, after
 * its own error line: help for someone who has forgotten the password.
 *
 * - "Password hint": a `data-sensitive` textarea holding the hint, inside a
 *   label that also names a "Show" control beside it by reference.
 * - "Security question": a `data-sensitive` select whose one option is the
 *   saved answer.
 * - "Stay logged in": an ordinary select, so the rule is seen to be targeted.
 *
 * None of it has a handler: the form is read, never posted.
 */
export function savedLoginFormExtras(ctx: PageContext): string {
  const { cls } = ctx.look;
  const hint = mountId(ctx.seed, "password-hint");
  return `<div style="display:flex;gap:8px;align-items:end"><label id="${hint}" style="flex:1">Password hint <textarea class="${cls.input}" name="passwordHint" data-sensitive="true" rows="1" readonly>${escapeHtml(V.passwordHint)}</textarea></label><div role="button" tabindex="0" class="${cls.secondary}" aria-labelledby="${hint}">Show</div></div>
<label>Security question <select class="${cls.input}" name="securityAnswer" data-sensitive="true"><option value="${V.securityAnswer.value}">${escapeHtml(V.securityAnswer.label)}</option></select></label>
<label>Stay logged in <select class="${cls.input}" name="stayLoggedIn"><option value="30-days">For 30 days</option></select></label>`;
}
