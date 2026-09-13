// What a node asks for when the user chose files while recording: the files
// themselves, supplied at run time.
//
// A recording cannot hold an upload. The recorder never reads a file's
// content, and the one thing a file input reports -- its `value`, Chrome's
// `C:\fakepath\<name>` -- is the user's local file name, which must not travel
// either. Until this module existed a file choice was mapped to text entry and
// replayed that name into a control that holds no text.
//
// So the node carries a *request* for the files, the same way a withheld
// password does (`secret-binding.ts`): Core's parameter state binding,
// `{ $state: { path } }`, at `upload`. The run answers it with a
// `WebAutomationUploadRequest` (`{ files: [...] }`), and Core resolves a binding
// to any JSON value, nested records included. **No binding here has a
// `fallback`**: an unsupplied upload fails the node and Core names the path,
// where a fallback would upload nothing and let the next step report success.
//
// It has its own namespace rather than `web.secret.`. The redaction attestation
// and the runner's declared-secret supplier both key on that prefix, and a file
// is not a declared secret. The key is the one rule
// `recorded-element-key.ts` applies to every run-time request.

import type { JsonObject } from "fluxiq/core";
import { objectValue, stringValue } from "./targets";

/** The state namespace a recorded file choice's files are requested from. */
export const WEB_AUTOMATION_UPLOAD_STATE_PREFIX = "web.upload.";

/** The run-input path a control's chosen files are supplied under. */
export function webAutomationUploadStatePath(key: string): string {
  return `${WEB_AUTOMATION_UPLOAD_STATE_PREFIX}${key}`;
}

/** The request itself, with no `fallback`: see the module note. */
export function webAutomationUploadBinding(key: string): JsonObject {
  return { $state: { path: webAutomationUploadStatePath(key) } };
}

/**
 * The path a value asks for, when the value is an upload request. A literal, a
 * secret request, or a binding on any other namespace is not one, so neither
 * kind of request can be read as the other.
 */
export function webAutomationUploadBindingPath(value: unknown): string | undefined {
  const path = stringValue(objectValue(objectValue(value)?.$state)?.path);
  return path?.startsWith(WEB_AUTOMATION_UPLOAD_STATE_PREFIX) ? path : undefined;
}
