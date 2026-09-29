// The one piece of state the two placeholder views share: the settings form's
// unsent values. The form lives in the placeholder Advanced view; Connect lives
// in the placeholder simple view and sends the form's values with it, as the
// single-file popup did. Workstream C replaces this with a Save button.

import type { FluxIQSettings } from "../../../shared/protocol";

/** The link between the settings form and Connect. */
export type SettingsDraft = {
  /** The form's values, or undefined before the form is mounted. */
  read(): FluxIQSettings | undefined;
  /** Connect answered: the form may be refilled from status again. */
  markSaved(): void;
  /** Called once by the view that owns the form. */
  attach(form: { read(): FluxIQSettings; markSaved(): void }): void;
};

/** A draft with no form attached yet. */
export function createSettingsDraft(): SettingsDraft {
  let form: { read(): FluxIQSettings; markSaved(): void } | undefined;
  return {
    read: () => form?.read(),
    markSaved: () => form?.markSaved(),
    attach(next) {
      form = next;
    }
  };
}
