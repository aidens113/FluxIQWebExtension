// The model key's state, in a sentence, from the four-word reading the setup screens
// share (`panel/getting-started`). Never a key's value.

import type { ModelKeyReading } from "../getting-started";

/** What to say about the model key, connected or not. */
export function modelKeyLine(reading: ModelKeyReading, connected: boolean): string {
  if (!connected) return "Connect to FluxIQ to check your model key.";
  switch (reading) {
    case "ready": return "Your model key is ready.";
    case "missing": return "FluxIQ has no model key yet. Add one in FluxIQ.";
    case "locked": return "Your model key is saved, but this browser can't open it yet. Unlock it in FluxIQ.";
    case "unknown": return "Couldn't check your model key just now.";
  }
}
