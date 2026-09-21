import { escapeHtml } from "../../../html.js";
import { CONTACT_OPTIONS, QUOTE_SERVICES } from "../data/index.js";
import { generatedId, type SiteClasses } from "../styles.js";
import type { SiteMode } from "../types.js";

/** The drawer's script hooks: generated ids, new on every seed, so nothing names what a control does. */
export type QuoteDrawerIds = {
  root: string; title: string; form: string; steps: [string, string, string]; dots: [string, string, string];
  back: string; next: string; send: string; draft: string; headerSend: string; close: string;
  select: string; list: string; verify: string; fields: Record<string, string>; errors: Record<string, string>;
};

export function quoteDrawerIds(seed: number): QuoteDrawerIds {
  const id = (name: string) => generatedId(seed, `quote:${name}`);
  const names = ["fullName", "email", "phone", "postcode", "companyWebsite", "details", "marketing", "privacy", "serviceLabel"];
  return {
    root: id("root"), title: id("title"), form: id("form"),
    steps: [id("step1"), id("step2"), id("step3")], dots: [id("dot1"), id("dot2"), id("dot3")],
    back: id("back"), next: id("next"), send: id("send"), draft: id("draft"), headerSend: id("header-send"), close: id("close"),
    select: id("select"), list: id("list"), verify: id("verify"),
    fields: Object.fromEntries(names.map((name) => [name, id(`field:${name}`)])),
    errors: Object.fromEntries(["fullName", "email", "phone", "postcode", "service", "privacy"].map((name) => [name, id(`error:${name}`)])),
  };
}

/**
 * The quote drawer the home page ships closed: three steps, a honeypot a
 * person never sees, a service list built from `div`s, a contact preference
 * that starts on Phone, a marketing box that starts ticked, and a footer
 * whose right-hand button sits exactly where the chat widget's greeting card
 * opens.
 *
 * `redesigned-quote-submit` rebuilds the last step: the footer's right-hand
 * button becomes "Save and finish later", which files a draft and sends
 * nothing, and the real submit moves to the step's header as "Get my free
 * quote", without the analytics test id the old button carried.
 */
export function quoteDrawer(c: SiteClasses, ids: QuoteDrawerIds, mode: SiteMode): string {
  const redesigned = mode === "redesigned-quote-submit";
  const f = ids.fields;
  const e = ids.errors;
  const input = (name: string, label: string, type: string, autocomplete: string) => `<label class="${c.field}" for="${f[name]}"><span class="${c.fieldLabel}">${label}</span>
      <input class="${c.input}" id="${f[name]}" name="${name}" type="${type}" autocomplete="${autocomplete}">
      <span class="${c.fieldError}" id="${e[name]}"></span></label>`;
  const options = QUOTE_SERVICES.map((service) => `<div class="${c.fauxOption}" data-value="${escapeHtml(service)}">${escapeHtml(service)}</div>`).join("");
  const radios = CONTACT_OPTIONS.map((option, index) => `<label class="${c.radioRow}"><input type="radio" name="contactBy" value="${option}"${index === 0 ? " checked" : ""}> ${option}</label>`).join("");
  const headerSend = redesigned ? `<button type="button" class="${c.buttonPrimary} ${c.stepHeaderAction}" id="${ids.headerSend}">Get my free quote</button>` : "";
  const rightHand = redesigned
    ? `<button type="button" class="${c.button}" id="${ids.draft}" hidden>Save and finish later</button>`
    : `<button type="button" class="${c.buttonPrimary}" id="${ids.send}" data-testid="quote-submit" hidden>Send request</button>`;
  return `<div id="${ids.root}" data-quote-drawer hidden>
  <div class="${c.drawerScrim}"></div>
  <section class="${c.drawer}" role="dialog" aria-modal="true" aria-labelledby="${ids.title}">
    <div class="${c.drawerHead}"><h2 id="${ids.title}" style="margin:0">Get a free quote</h2><div class="${c.modalClose}" id="${ids.close}">&times;</div></div>
    <form class="${c.drawerBody}" id="${ids.form}" novalidate>
      <div class="${c.stepper}"><span class="${c.stepDot} ${c.stepActive}" id="${ids.dots[0]}"></span><span class="${c.stepDot}" id="${ids.dots[1]}"></span><span class="${c.stepDot}" id="${ids.dots[2]}"></span></div>
      <fieldset id="${ids.steps[0]}" style="border:0;padding:0;margin:0">
        <legend><strong>About you</strong></legend>
        <p class="${c.muted}">Step 1 of 3. We only use these details to reply to you.</p>
        ${input("fullName", "Full name", "text", "name")}
        ${input("email", "Email address", "email", "email")}
        ${input("phone", "Phone number", "tel", "tel")}
        ${input("postcode", "Postcode of the property", "text", "postal-code")}
        <div class="${c.offscreen}" aria-hidden="true"><label for="${f.companyWebsite}">Company website</label><input id="${f.companyWebsite}" name="companyWebsite" type="text" tabindex="-1" autocomplete="off"></div>
      </fieldset>
      <fieldset id="${ids.steps[1]}" style="border:0;padding:0;margin:0" hidden>
        <legend><strong>Your job</strong></legend>
        <p class="${c.muted}">Step 2 of 3.</p>
        <div class="${c.field}"><span class="${c.fieldLabel}" id="${f.serviceLabel}">What do you need?</span>
          <div class="${c.fauxSelect}" id="${ids.select}" tabindex="0">Choose a service</div>
          <div class="${c.fauxSelectList}" id="${ids.list}" hidden>${options}</div>
          <input type="hidden" name="service" value="">
          <span class="${c.fieldError}" id="${e.service}"></span></div>
        <label class="${c.field}" for="${f.details}"><span class="${c.fieldLabel}">Tell us about the job (optional)</span>
          <textarea class="${c.textarea}" id="${f.details}" name="details" placeholder="Make and age of your boiler, what is wrong, access notes"></textarea></label>
        <div class="${c.field}" role="radiogroup" aria-label="How should we get back to you?"><span class="${c.fieldLabel}">How should we get back to you?</span>${radios}</div>
      </fieldset>
      <fieldset id="${ids.steps[2]}" style="border:0;padding:0;margin:0" hidden>
        <legend><strong>Almost done</strong></legend>
        ${headerSend}
        <p class="${c.muted}">Step 3 of 3. We reply within one working day.</p>
        <label class="${c.checkRow}" for="${f.marketing}"><input type="checkbox" id="${f.marketing}" name="marketing" checked> <span>Yes, send me Kestrel Lane offers and seasonal reminders by email</span></label>
        <label class="${c.checkRow}" for="${f.privacy}"><input type="checkbox" id="${f.privacy}" name="privacy"> <span>I agree to Kestrel Lane contacting me about this request, as set out in the privacy notice</span></label>
        <span class="${c.fieldError}" id="${e.privacy}"></span>
      </fieldset>
      <div class="${c.verifyBox}" id="${ids.verify}" hidden></div>
    </form>
    <div class="${c.drawerFoot}">
      <button type="button" class="${c.button}" id="${ids.back}" disabled>Back</button>
      <button type="button" class="${c.buttonPrimary}" id="${ids.next}">Continue</button>
      ${rightHand}
    </div>
  </section>
</div>`;
}
