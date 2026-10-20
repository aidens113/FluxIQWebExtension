import { escapeHtml } from "../../../../html.js";
import type { RenderContext } from "../../../../types.js";
import { elementId } from "../../theme/index.js";
import type { BigboxClasses } from "../../theme/index.js";
import { ACCOUNT_RECOVERY_VALUES as V } from "./values.js";

const hidden = (text: string) => `<span data-sensitive="true">${escapeHtml(text)}</span>`;

/**
 * The "Forgot your password?" panel the `account-recovery` rendering opens
 * beside the sign-in wall. It is one unnamed form in a section named by its
 * heading, in four parts:
 *
 * - "Your security details": a group the site marks `data-sensitive` as a
 *   whole, holding a text field, a select and a box that starts ticked; not
 *   one of the three is marked itself.
 * - "Contact preferences": the same three kinds of control, ordinary, in a
 *   fieldset, so the two groups never read as one repeating run.
 * - "Confirm it's you": a password hint (a marked textarea) and a one-time
 *   code select, each inside a label that also names a button beside it by
 *   reference, an ordinary select named the same way, and a reset-link button
 *   whose own text holds the hidden address.
 * - "Saved cards": a section named by a heading, and holding a column header,
 *   a fieldset legend, a `<label for>` and the text beside an unlabelled
 *   field, each with a masked card detail marked hidden inside it.
 *
 * Nothing here has a handler: the panel is read, typed into and ticked, and
 * none of it posts or reloads.
 */
export function accountRecoveryPanel(context: RenderContext, c: BigboxClasses): string {
  const id = (name: string) => elementId(context.seed, `recovery-${name}`);
  const answers = V.securityAnswers.map((answer) => `<option value="${answer.value}">${escapeHtml(answer.label)}</option>`).join("");
  return `<section class="${c.recoveryCard}" aria-labelledby="${id("title")}"><h2 id="${id("title")}">Forgot your password?</h2>
<p>Confirm a few details so we know it's you, then choose a new password. Saved answers and card details stay hidden.</p>
<form>
<div class="${c.recoveryGroup}" data-sensitive="true"><b>Your security details</b>
<label class="${c.label}">Recovery phrase <input class="${c.input}" type="text" name="recoveryPhrase" autocomplete="off"></label>
<label class="${c.label}">Security answer <select class="${c.input}" name="securityAnswer">${answers}</select></label>
<label><input type="checkbox" name="rememberDevice" checked> Remember this device</label>
</div>
<fieldset class="${c.recoveryGroup}"><legend>Contact preferences</legend>
<label class="${c.label}">Preferred name <input class="${c.input}" type="text" name="preferredName" autocomplete="nickname"></label>
<label class="${c.label}">Best time to call <select class="${c.input}" name="callTime"><option value="mornings">Mornings</option><option value="evenings">Evenings</option></select></label>
<label><input type="checkbox" name="accountEmails" checked> Email me about my account</label>
</fieldset>
<div class="${c.recoveryGroup}" role="group" aria-label="Confirm it's you">
<div class="${c.recoveryRow}"><label id="${id("hint")}">Password hint <textarea name="passwordHint" data-sensitive="true" rows="1" readonly>${escapeHtml(V.passwordHint)}</textarea></label><button type="button" class="${c.btn} ${c.btnQuiet}" name="showHint" aria-labelledby="${id("hint")}">Show</button></div>
<div class="${c.recoveryRow}"><label id="${id("code")}">Verification code <select name="verificationCode" autocomplete="one-time-code"><option value="${V.oneTimeCode.value}">${escapeHtml(V.oneTimeCode.label)}</option></select></label><button type="button" class="${c.btn} ${c.btnQuiet}" name="useCode" aria-labelledby="${id("code")}">Use</button></div>
<div class="${c.recoveryRow}"><label id="${id("channel")}">Send codes by <select name="codeChannel"><option value="sms">Text message</option></select></label><button type="button" class="${c.btn} ${c.btnQuiet}" name="changeChannel" aria-labelledby="${id("channel")}">Change</button></div>
<button type="button" class="${c.btn} ${c.btnSecondary}" name="emailResetLink">Email a reset link to ${hidden(V.resetEmail)}</button>
</div>
<section class="${c.recoveryGroup}" aria-labelledby="${id("cards")}"><h3 id="${id("cards")}">Saved cards ${hidden(V.savedCardsHeading)}</h3>
<table class="${c.recoveryTable}"><thead><tr><th>Card ${hidden(V.cardColumn)}</th></tr></thead><tbody><tr><td><button type="button" class="${c.btnLink}" name="removeCard">Remove</button></td></tr></tbody></table>
<fieldset><legend>Billing address on file ${hidden(V.billingAddress)}</legend><label class="${c.label}">Street address <input class="${c.input}" type="text" name="billingStreet" autocomplete="billing street-address"></label></fieldset>
<label class="${c.label}" for="${id("nickname")}">Nickname for ${hidden(V.nicknameCard)}</label><input class="${c.input}" id="${id("nickname")}" type="text" name="cardNickname">
<div><span>Billing ZIP code</span>${hidden(V.billingZip)}<input class="${c.input}" type="text" name="billingZip" inputmode="numeric"></div>
<button type="button" class="${c.btn} ${c.btnPrimary}" name="saveCards">Save</button>
</section>
</form></section>`;
}
