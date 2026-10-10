// Matrix row 7: two situation blocks, each with its own handler for the same
// thing on the page, and only one of them active.
//
// The `store` block is for a run asked to change the pickup store first (the
// Router takes it when `inputs.task` is `change-store`); the steps outside every
// block are what runs otherwise, and this run sets no such input. Both register
// a `before` handler for bigbox's consent dialog, which opens over every page
// until it is answered: a dialog named by its own title, "Your privacy
// choices", so the fact needs no evidence handle. The fallback block's handler
// must run and answer the dialog; the `store` block's handler matches the same
// page and must never run, because its block is not the one the run is in.
//
// Targets are bigbox's markup for the canonical seed (239): the consent
// dialog's first button, the email offer's decline link after its form, the
// header search, and the store picker inside `vr-fulfillment-picker`'s shadow
// root (Millbrook Crossing's card is the third).
export const SOAP_SEARCH_TWO_BLOCKS = String.raw`flow: Search the store for dish soap, changing the pickup store first when asked to
subflow store: the run was asked to change the pickup store first
  when: inputs.task is change-store
  on before: the privacy choices cover the page
    when: dialog dialog "Your privacy choices"
    step: accept the privacy choices
      node: web.dom.click
      selector: [role="dialog"][aria-modal="true"] button:first-of-type
      consequences: none
    then: carry on
  end
  step: open the store picker
    node: web.dom.click
    selector: button:first-of-type
    element.context.shadowHosts: ["vr-fulfillment-picker"]
    consequences: none
  step: set Millbrook Crossing Supercenter as my store
    node: web.dom.click
    selector: li:nth-child(3) button
    element.context.shadowHosts: ["vr-fulfillment-picker"]
    consequences: modify_existing
  step: search for dish soap
    node: web.dom.type
    selector: input[type="search"]
    element.tagName: input
    element.attributes: {"type": "search", "name": "q"}
    text: dish soap
    submit: true
    consequences: none
end
on before: the privacy choices cover the page
  when: dialog dialog "Your privacy choices"
  step: accept the privacy choices
    node: web.dom.click
    selector: [role="dialog"][aria-modal="true"] button:first-of-type
    consequences: none
  then: carry on
end
step: decline the email offer if it shows
  node: web.dom.click
  selector: form + a[href="#"]
  timeoutMs: 8000
  consequences: none
  optional: yes
step: search for dish soap
  node: web.dom.type
  selector: input[type="search"]
  element.tagName: input
  element.attributes: {"type": "search", "name": "q"}
  text: dish soap
  submit: true
  consequences: none`;
