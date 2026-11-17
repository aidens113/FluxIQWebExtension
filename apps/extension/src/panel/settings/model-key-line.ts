// The model key's state, in a sentence, from the safe status the setup screens
// share (`panel/getting-started`). Never a key's value.

import { modelKeyUnavailableLine, type ModelKeyReading } from "../getting-started";

/** What to say about the model key, connected or not. */
export function modelKeyLine(reading: ModelKeyReading, connected: boolean): string {
  if (!connected) return "Connect to FluxIQ to check your model key.";
  switch (reading) {
    case "ready": return "Your model key is configured.";
    case "missing": return "No supported model key is configured. Add one in FluxIQ to use AI.";
    case "unknown": return "Couldn't check your model key just now.";
    default: return modelKeyUnavailableLine(reading);
  }
}
