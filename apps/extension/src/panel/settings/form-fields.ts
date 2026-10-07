// The connection settings, their labels and their one-line hints, verbatim
// from the UI audit, section 4 ("Connection tab copy"). The labels are the
// accessible names the Lab fills (`packages/test-runner/src/demo-workspace/
// browser-session.ts`), so a change here is a change to that journey.
//
// The ids are the old settings drawer's, kept so nothing that found a field by
// id has to change with the words.

import type { FluxIQSettings } from "../../shared/protocol";

/** A setting typed as an address. */
export type AddressKey = "gatewayUrl" | "coreApiUrl";
/** A setting that is on or off. */
export type ToggleKey = "autoReconnect" | "captureMutations" | "captureInputValues" | "captureSnapshots" | "requestsEnabled";

/** How one setting is shown. */
export type SettingField<K extends keyof FluxIQSettings> = { readonly key: K; readonly id: string; readonly label: string; readonly disabled?: boolean; readonly hint: string };

/** The connection settings, in display order: the two addresses, then the four switches. */
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
    { key: "captureMutations", id: "captureMutations", label: "Record page changes", hint: "Notice when the page updates by itself." },
    { key: "captureInputValues", id: "captureInputValues", label: "Record what I type", hint: "Needed to replay typing. Passwords are never recorded." },
    { key: "captureSnapshots", id: "captureSnapshots", label: "Record page snapshots", hint: "Lets FluxIQ see the page as it was at each step." },
    { key: "requestsEnabled", id: "requestsEnabled", label: "Allow direct requests", hint: "Unavailable in this version.", disabled: true }
  ]
};
