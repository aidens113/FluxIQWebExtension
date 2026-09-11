import { escapeHtml, page } from "../../html.js";
import type { RenderContext } from "../../types.js";
import { keyboardFormsClientScript } from "./client-script.js";
import { keyboardFormsOptions } from "./options.js";
import type { KeyboardFormsState } from "./state.js";

// `[hidden]` must win over the shared `li { display: flex }` rule.
const styles = `<style>
  [hidden] { display: none !important; }
  fieldset { margin: .75rem 0; }
  fieldset label { display: flex; gap: .5rem; margin: .25rem 0; }
  .combobox { max-width: 20rem; }
  .combobox input { width: 100%; box-sizing: border-box; }
  [role="listbox"] { list-style: none; margin: .25rem 0 0; padding: 0; border: 1px solid #6b7280; }
  [role="option"] { margin: 0; padding: .25rem .5rem; cursor: pointer; }
  [role="option"][aria-selected="true"] { background: #1d4ed8; color: #fff; }
</style>`;

/**
 * Account settings: one form holding a display-name field with a submit
 * button, a labelled checkbox, a labelled radio group, and an ARIA combobox.
 * Enter in either text field is native implicit submission of that form.
 */
export function renderKeyboardForms(state: KeyboardFormsState, context: RenderContext): string {
  const { preferences, profile, status } = state;
  const radios = keyboardFormsOptions.contactMethods.map(method =>
    `<label><input type="radio" name="contactMethod" value="${method.value}" data-testid="contact-${method.value}"${method.value === preferences.contactMethod ? " checked" : ""}> ${method.label}</label>`,
  ).join("\n        ");
  const countryOptions = keyboardFormsOptions.countries.map(country => {
    const id = `country-option-${country.code.toLowerCase()}`;
    return `<li id="${id}" role="option" aria-selected="false" data-value="${country.code}" data-testid="${id}">${country.name}</li>`;
  }).join("\n          ");
  const chosenCountry = keyboardFormsOptions.countries.find(country => country.code === preferences.country)?.name ?? "";
  const body = `${styles}<main>
    <h1>Account settings</h1>
    <form data-testid="settings-form" aria-labelledby="settings-heading">
      <h2 id="settings-heading">Profile and preferences</h2>
      <label for="display-name">Display name</label>
      <input id="display-name" name="displayName" type="text" autocomplete="off" data-testid="display-name" value="${escapeHtml(profile.displayName)}">
      <button type="submit" data-testid="save-profile">Save profile</button>
      <p role="status" data-testid="profile-status">${escapeHtml(status.profile)}</p>
      <label><input type="checkbox" name="emailUpdates" data-testid="email-updates"${preferences.emailUpdates ? " checked" : ""}> Email me product updates</label>
      <p role="status" data-testid="email-updates-status">${escapeHtml(status.emailUpdates)}</p>
      <fieldset data-testid="contact-method">
        <legend>Preferred contact method</legend>
        ${radios}
      </fieldset>
      <p role="status" data-testid="contact-method-status">${escapeHtml(status.contactMethod)}</p>
      <div class="combobox">
        <label id="country-label" for="country">Country</label>
        <input id="country" name="country" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="country-listbox" autocomplete="off" data-testid="country" value="${escapeHtml(chosenCountry)}">
        <ul id="country-listbox" role="listbox" aria-labelledby="country-label" data-testid="country-listbox" hidden>
          ${countryOptions}
        </ul>
      </div>
      <p role="status" data-testid="country-status">${escapeHtml(status.country)}</p>
    </form>
  </main>`;
  return page("Account settings", body, keyboardFormsClientScript(context.runToken));
}
