// How one switch shows under the recording-capture policy the status carries:
// disabled with a short reason where Core forbids it, otherwise its usual hint.
// With no policy in the status (an older background, or none read yet), Core's
// default applies, which is exactly how `SETTING_FIELDS` lists the switch.

import type { ExtensionCaptureAllowed } from "../../shared/protocol";
import type { SettingField, ToggleKey } from "./form-fields";

export type ToggleView = { readonly disabled: boolean; readonly hint: string };

export function toggleView(field: SettingField<ToggleKey>, allowed: ExtensionCaptureAllowed | undefined): ToggleView {
  const policyKey = field.policy;
  if (policyKey === undefined || allowed === undefined || typeof allowed[policyKey] !== "boolean") return { disabled: field.disabled === true, hint: field.hint };
  return allowed[policyKey]
    ? { disabled: false, hint: field.allowedHint ?? field.hint }
    : { disabled: true, hint: field.forbiddenHint ?? field.hint };
}
