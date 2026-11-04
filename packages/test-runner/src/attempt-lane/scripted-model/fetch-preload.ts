// Loaded with `NODE_OPTIONS=--import` into a scripted run's Core child, before any of
// Core's modules, so its fixed model endpoint reaches the Lab's scripted server and no
// setting is added to Core for it (`./route-model-call.ts`). A child started without the
// server's address refuses to go on, since the wrapper is all that keeps it provider-free.
import { routedFetch, SCRIPTED_MODEL_ORIGIN_ENV } from "./route-model-call.js";

const origin = process.env[SCRIPTED_MODEL_ORIGIN_ENV];
if (!origin) throw new Error(`The scripted-model preload needs ${SCRIPTED_MODEL_ORIGIN_ENV}`);
globalThis.fetch = routedFetch(globalThis.fetch, origin);
