"use strict";
(() => {
  // src/shared/dialog-channel.ts
  var DIALOG_ARM_ATTRIBUTE = "data-fluxiq-dialog-arm";
  var DIALOG_OBSERVED_ATTRIBUTE = "data-fluxiq-dialog-observed";
  var DIALOG_ARM_EVENT = "fluxiq:dialog-arm";
  var DIALOG_TEXT_MAX_LENGTH = 1024;
  function decodeDialogArm(raw) {
    const value = parseObject(raw);
    if (!value) return void 0;
    const response = dialogResponse(value["response"]);
    if (!response) return void 0;
    const promptText = value["promptText"];
    return typeof promptText === "string" ? { response, promptText } : { response };
  }
  function encodeDialogObserved(observed) {
    return JSON.stringify({
      kind: observed.kind,
      message: boundText(observed.message),
      response: observed.response,
      at: observed.at,
      ...observed.promptText === void 0 ? {} : { promptText: boundText(observed.promptText) }
    });
  }
  function boundText(value) {
    return value.length <= DIALOG_TEXT_MAX_LENGTH ? value : value.slice(0, DIALOG_TEXT_MAX_LENGTH);
  }
  function parseObject(raw) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : void 0;
    } catch {
      return void 0;
    }
  }
  function dialogResponse(value) {
    return value === "accept" || value === "dismiss" ? value : void 0;
  }

  // src/page-world/dialog-override.ts
  function installDialogOverride() {
    if (inExtensionWorld()) return false;
    const host = window;
    if (host.__fluxiqDialogOverrideInstalled === true) return true;
    host.__fluxiqDialogOverrideInstalled = true;
    let armed;
    document.addEventListener(DIALOG_ARM_EVENT, () => {
      const root = document.documentElement;
      const raw = root?.getAttribute(DIALOG_ARM_ATTRIBUTE);
      if (!root || raw === null || raw === void 0) return;
      root.removeAttribute(DIALOG_ARM_ATTRIBUTE);
      armed = decodeDialogArm(raw);
    });
    const takeArmed = () => {
      const next = armed;
      armed = void 0;
      return next;
    };
    const record = (kind, message, response, promptText) => {
      const root = document.documentElement;
      if (!root) return;
      try {
        root.setAttribute(DIALOG_OBSERVED_ATTRIBUTE, encodeDialogObserved({
          kind,
          message,
          response,
          at: Date.now(),
          ...promptText === void 0 ? {} : { promptText }
        }));
      } catch {
      }
    };
    const nativeAlert = window.alert;
    const nativeConfirm = window.confirm;
    const nativePrompt = window.prompt;
    window.alert = (message) => {
      const text = asText(message);
      const arm = takeArmed();
      if (!arm) nativeAlert.call(window, text);
      record("alert", text, arm?.response ?? "accept");
    };
    window.confirm = (message) => {
      const text = asText(message);
      const arm = takeArmed();
      const accepted = arm ? arm.response === "accept" : nativeConfirm.call(window, text);
      record("confirm", text, accepted ? "accept" : "dismiss");
      return accepted;
    };
    window.prompt = (message, defaultValue) => {
      const text = asText(message);
      const fallback = defaultValue === void 0 ? void 0 : asText(defaultValue);
      const arm = takeArmed();
      if (!arm) {
        const answer2 = nativePrompt.call(window, text, fallback);
        record("prompt", text, answer2 === null ? "dismiss" : "accept", answer2 ?? void 0);
        return answer2;
      }
      if (arm.response === "dismiss") {
        record("prompt", text, "dismiss");
        return null;
      }
      const answer = arm.promptText ?? fallback ?? "";
      record("prompt", text, "accept", answer);
      return answer;
    };
    return true;
  }
  function inExtensionWorld() {
    const runtime = globalThis.chrome?.runtime;
    return typeof runtime?.id === "string";
  }
  function asText(value) {
    return value === void 0 ? "" : String(value);
  }

  // src/page-world/index.ts
  installDialogOverride();
})();
//# sourceMappingURL=index.js.map
