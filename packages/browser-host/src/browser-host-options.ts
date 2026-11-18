import type { BrowserContext } from "playwright-core";

export type BrowserHostOptions = {
  /** The built extension directory (`apps/extension/dist/chrome`). */
  extensionPath: string;
  /** Overrides the engine's `--headless` choice; the default is the request's, which is visible unless asked. */
  headless?: boolean | undefined;
  browserArgs?: readonly string[] | undefined;
  executablePath?: string | undefined;
  /** Called with the context before any page of ours is opened. */
  onContext?: ((context: BrowserContext) => Promise<void>) | undefined;
  /** How long one connect attempt may take to settle. Default 30 000 ms. */
  connectTimeoutMs?: number | undefined;
};
