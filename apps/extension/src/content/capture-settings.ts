// What the recorder is allowed to capture. The background worker replaces
// these with every `recording` message, and both the recorder and the element
// description path read them, so they sit in a leaf module that imports
// nothing.

export const captureSettings = {
  mutations: true,
  inputValues: true,
  snapshots: true
};
