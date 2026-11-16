// Where the project the person chose is kept: `chrome.storage.local`, one entry
// per server address, so a browser paired to two FluxIQ servers keeps a choice
// for each. A stored value of the wrong shape reads as no choice.

import { STORAGE_KEYS } from "../../shared/constants";

/** The project a person chose, with its name when it was known. */
export type ProjectChoice = { readonly projectId: string; readonly name?: string | undefined };

export type ProjectChoiceStorage = {
  read(serverAddress: string): Promise<ProjectChoice | undefined>;
  /** null clears the choice for that address. */
  write(serverAddress: string, choice: ProjectChoice | null): Promise<void>;
};

type Stored = Record<string, { projectId: string; name?: string }>;

function addressKey(serverAddress: string): string {
  return serverAddress.trim().replace(/\/+$/, "").toLowerCase();
}

function readStored(value: unknown): Stored {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const stored: Stored = {};
  for (const [address, entry] of Object.entries(value as Record<string, unknown>)) {
    const projectId = (entry as { projectId?: unknown } | null)?.projectId;
    if (typeof projectId !== "string" || !projectId.trim()) continue;
    const name = (entry as { name?: unknown }).name;
    stored[address] = typeof name === "string" && name ? { projectId, name } : { projectId };
  }
  return stored;
}

/** The storage over any `get`/`set` pair shaped like `chrome.storage.local`. */
export function projectChoiceStorage(area: {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}): ProjectChoiceStorage {
  const load = async (): Promise<Stored> => readStored((await area.get(STORAGE_KEYS.projectChoice))[STORAGE_KEYS.projectChoice]);
  return {
    async read(serverAddress) {
      return (await load())[addressKey(serverAddress)];
    },
    async write(serverAddress, choice) {
      const stored = await load();
      const key = addressKey(serverAddress);
      if (choice) stored[key] = choice.name ? { projectId: choice.projectId, name: choice.name } : { projectId: choice.projectId };
      else delete stored[key];
      await area.set({ [STORAGE_KEYS.projectChoice]: stored });
    }
  };
}

/** The worker's own: `chrome.storage.local`. */
export function chromeProjectChoiceStorage(): ProjectChoiceStorage {
  // `chrome.storage.local` is reached per call, never at construction.
  return projectChoiceStorage({
    get: (key) => chrome.storage.local.get(key),
    set: (items) => chrome.storage.local.set(items)
  });
}
