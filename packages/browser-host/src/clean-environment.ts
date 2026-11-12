/** Names that carry a credential: a model provider's key, a cloud key, a token or a secret. */
const CREDENTIAL_NAME = /(?:API_?KEY|ACCESS_?KEY|SECRET|TOKEN|PASSWORD)(?:_ID)?$/iu;

/**
 * The environment a browser or the reaper inherits: the engine's, without any
 * variable whose name says it holds a credential, so a page or an extension can
 * never read the engine's provider keys from the process it runs in.
 */
export function cleanEnvironment(environment: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return Object.fromEntries(Object.entries(environment).filter((entry): entry is [string, string] => entry[1] !== undefined && !CREDENTIAL_NAME.test(entry[0])));
}
