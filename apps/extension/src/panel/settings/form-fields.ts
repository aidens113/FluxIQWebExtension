// The connection settings, their labels and their one-line hints, verbatim
// from the UI audit, section 4 ("Connection tab copy"). The labels are the
// accessible names the Lab fills (`packages/test-runner/src/demo-workspace/
// browser-session.ts`), so a change here is a change to that journey.
//
// The ids are the old settings drawer's, kept so nothing that found a field by
// id has to change with the words.

import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY as POLICY } from "fluxiq/automation-studio/nodes";
import type { ExtensionCaptureAllowed, FluxIQSettings } from "../../shared/protocol";

/** The `disabled` mark for a switch the policy does not allow; nothing for one it does. */
function forbidden(allowed: boolean): { readonly disabled?: true } {
  return allowed ? {} : { disabled: true };
}

/** A setting typed as an address. */
export type AddressKey = "gatewayUrl" | "coreApiUrl";
/** A setting that is on or off. */
export type ToggleKey = "autoReconnect" | "captureMutations" | "captureInputValues" | "captureSnapshots" | "requestsEnabled";

/**
 * How one setting is shown. `disabled` and `hint` are how it shows under Core's
 * default policy. A switch Core's policy governs names its part (`policy`), the
 * hint it shows when allowed (`allowedHint`) and the short reason it shows when
 * forbidden (`forbiddenHint`); `toggleView` picks between them for the policy
 * the status carries.
 */
export type SettingField<K extends keyof FluxIQSettings> = {
  readonly key: K;
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly hint: string;
  readonly policy?: keyof ExtensionCaptureAllowed;
  readonly allowedHint?: string;
  readonly forbiddenHint?: string;
};

const POLICY_OFF = "Turned off by FluxIQ's recording policy.";

/** A switch Core's policy governs: shown under Core's default unless the status says otherwise. */
function governed<K extends ToggleKey>(field: { key: K; id: string; label: string }, policy: keyof ExtensionCaptureAllowed, allowedHint: string, forbiddenHint: string): SettingField<K> {
  const allowed = POLICY[policy].allowed === true;
  return { ...field, policy, allowedHint, forbiddenHint, hint: allowed ? allowedHint : forbiddenHint, ...forbidden(allowed) };
}

/**
 * The connection settings, in display order: the two addresses, then the
 * switches. A switch Core's recording-capture policy forbids is shown disabled
 * (and saved off by `address-form.ts`). As listed here the policy is Core's
 * default, which forbids direct requests and allows every capture switch; the
 * form follows the policy the status carries (`toggle-view.ts`).
 */
export const SETTING_FIELDS: {
  readonly addresses: readonly SettingField<AddressKey>[];
  readonly toggles: readonly SettingField<ToggleKey>[];
} = {
  addresses: [
    { key: "gatewayUrl", id: "gatewayUrl", label: "FluxIQ connection address", hint: "Where this browser connects to FluxIQ. Usually ws://127.0.0.1:4777/client." },
    { key: "coreApiUrl", id: "coreApiUrl", label: "FluxIQ web address", hint: "The address you open FluxIQ at." }
  ],
  toggles: [
    { key: "autoReconnect", id: "autoReconnect", label: "Reconnect automatically", hint: "Reconnect after the connection drops." },
    governed({ key: "captureMutations", id: "captureMutations", label: "Record page changes" }, "captureMutations", "Notice when the page updates by itself.", POLICY_OFF),
    governed({ key: "captureInputValues", id: "captureInputValues", label: "Record what I type" }, "captureInputValues", "Needed to replay typing. Passwords are never recorded.", POLICY_OFF),
    governed({ key: "captureSnapshots", id: "captureSnapshots", label: "Record page snapshots" }, "captureSnapshots", "Lets FluxIQ see the page as it was at each step.", POLICY_OFF),
    governed({ key: "requestsEnabled", id: "requestsEnabled", label: "Allow direct requests" }, "directRequests", "Lets a Flow call a site's addresses directly.", "Unavailable in this version.")
  ]
};
