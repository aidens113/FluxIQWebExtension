import { createScenarioManifest } from "../../types.js";

/**
 * Corpus rows W02 (the primary workflow) and W03 (`combobox`). No variants:
 * this fixture is the evidence for decision D5, trusted-input emulation.
 * Every outcome is read from a status line the server state drives.
 */
export const keyboardFormsManifest = createScenarioManifest({
  id: "keyboard-forms",
  title: "Keyboard forms",
  tags: ["forms", "keyboard", "combobox", "trusted-input"],
  seed: 123,
  startPath: "/scenarios/keyboard-forms/",
  capabilities: ["forms"],
  recordingScript: [
    { id: "enter-display-name", operation: "type", target: "testid:display-name", value: "Ada Lovelace" },
    { id: "submit-with-enter", operation: "press", target: "testid:display-name", value: "Enter" },
    { id: "enable-email-updates", operation: "check", target: "testid:email-updates", value: true },
    { id: "choose-text-message", operation: "check", target: "testid:contact-sms", value: true },
    { id: "preferences-set", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [{ id: "settings-form-visible", subject: "settings-form", predicate: "visible", value: true }],
    recordingEvents: [
      { type: "web.element.input_changed" },
      { type: "web.keyboard.pressed", count: 1 },
      { type: "web.form.submitted", count: 1 },
      { type: "web.element.changed" },
    ],
    actions: [
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.keypress", outcome: "succeeded" },
      { action: "web.dom.check", outcome: "succeeded" },
    ],
    finalState: [
      { id: "profile-saved", subject: "profile-status", predicate: "text", value: "Saved: Ada Lovelace" },
      { id: "email-updates-on", subject: "email-updates-status", predicate: "text", value: "Email updates: on" },
      { id: "contact-by-text-message", subject: "contact-method-status", predicate: "text", value: "Contact method: Text message" },
    ],
    allowedConsoleErrors: [],
  },
  workflows: [{
    id: "combobox",
    description: "Type characters into the country combobox, open and move through the filtered listbox with ArrowDown, and choose Netherlands with Enter without submitting the enclosing form.",
    recordingScript: [
      { id: "type-country-prefix", operation: "type", target: "testid:country", value: "Ne" },
      { id: "highlight-first-match", operation: "press", target: "testid:country", value: "ArrowDown" },
      { id: "listbox-open", operation: "waitForState", target: "testid:country-listbox", timeoutMs: 1000 },
      { id: "highlight-second-match", operation: "press", target: "testid:country", value: "ArrowDown" },
      { id: "choose-highlighted", operation: "press", target: "testid:country", value: "Enter" },
      { id: "country-chosen", operation: "checkpoint" },
    ],
    expected: {
      pageFacts: [{ id: "country-combobox-visible", subject: "country", predicate: "visible", value: true }],
      recordingEvents: [
        { type: "web.element.input_changed" },
        { type: "web.keyboard.pressed", count: 3 },
        { type: "web.form.submitted", count: 0 },
      ],
      actions: [
        { action: "web.dom.type", outcome: "succeeded" },
        { action: "web.dom.keypress", outcome: "succeeded" },
      ],
      finalState: [
        { id: "country-netherlands", subject: "country-status", predicate: "text", value: "Country: Netherlands" },
        { id: "profile-not-submitted", subject: "profile-status", predicate: "text", value: "Not saved" },
      ],
      allowedConsoleErrors: [],
    },
  }],
});
