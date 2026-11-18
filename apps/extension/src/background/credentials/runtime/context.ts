import type { HostedCredentialBinding } from "../binding";
import type { CredentialDatabase } from "../storage";

export type CredentialContext = { binding: HostedCredentialBinding; key: string; database: CredentialDatabase; now(): number; mint(): string };
