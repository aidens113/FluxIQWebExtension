"use strict";
(() => {
  // src/content/index.ts
  var CONTENT_EVENT = "fluxiq.contentEvent";
  var CONTENT_READY = "fluxiq.contentReady";
  var recording = false;
  var sequence = 0;
  var captureMutations = true;
  var captureInputValues = true;
  var captureSnapshots = true;
  var scrollTimer;
  var mutationTimer;
  var pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  sendReady();
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const typed = message;
    if (typed.type === "fluxiq.ping") {
      sendResponse({ ok: true });
      return false;
    }
    if (typed.type === "recording") {
      recording = Boolean(typed.recording);
      captureMutations = typed.settings?.captureMutations ?? captureMutations;
      captureInputValues = typed.settings?.captureInputValues ?? captureInputValues;
      captureSnapshots = typed.settings?.captureSnapshots ?? captureSnapshots;
      sendResponse({ ok: true });
      return true;
    }
    if (typed.type === "captureSnapshot") {
      sendResponse(captureSnapshot());
      return true;
    }
    if (typed.type === "executeAction" && typed.action) {
      void executeAction(typed.action).then(sendResponse).catch((error) => sendResponse(actionFailure(typed.action, error)));
      return true;
    }
    return false;
  });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.click", compactObject({ element: target ? describeElement(target) : void 0, metadata: pointerMetadata(event) }));
  }, true);
  document.addEventListener("input", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.input", compactObject({
      element: target ? describeElement(target) : void 0,
      inputValue: captureInputValues ? readElementValue(target) : void 0
    }));
  }, true);
  document.addEventListener("change", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.change", compactObject({
      element: target ? describeElement(target) : void 0,
      inputValue: captureInputValues ? readElementValue(target) : void 0
    }));
  }, true);
  document.addEventListener("submit", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.submit", compactObject({ element: target ? describeElement(target) : void 0 }));
  }, true);
  document.addEventListener("focus", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.focus", compactObject({ element: target ? describeElement(target) : void 0 }));
  }, true);
  document.addEventListener("blur", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.blur", compactObject({ element: target ? describeElement(target) : void 0 }));
  }, true);
  document.addEventListener("keydown", (event) => {
    emit("dom.keydown", compactObject({
      key: event.key,
      element: event.target instanceof Element ? describeElement(event.target) : void 0,
      metadata: {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey
      }
    }));
  }, true);
  window.addEventListener("scroll", () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      emit("dom.scroll", { scroll: { x: window.scrollX, y: window.scrollY } });
    }, 150);
  }, true);
  var observer = new MutationObserver((mutations) => {
    if (!captureMutations || !recording) return;
    for (const mutation of mutations) {
      pendingMutation.added += mutation.addedNodes.length;
      pendingMutation.removed += mutation.removedNodes.length;
      if (mutation.type === "attributes") pendingMutation.attributes += 1;
      if (mutation.type === "characterData") pendingMutation.text += 1;
    }
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      emit("dom.mutation", { mutation: pendingMutation });
      pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
    }, 500);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
  function sendReady() {
    const payload = basePayload("content.ready", {
      snapshot: captureSnapshot(),
      metadata: { readyState: document.readyState }
    });
    void chrome.runtime.sendMessage({ type: CONTENT_READY, payload });
  }
  function emit(kind, details) {
    if (!recording && kind !== "content.ready") return;
    const payload = basePayload(kind, details);
    void chrome.runtime.sendMessage({ type: CONTENT_EVENT, payload });
  }
  function basePayload(kind, details) {
    const payload = {
      kind,
      sequence: ++sequence,
      url: location.href,
      title: document.title,
      eventTimestampMs: Date.now()
    };
    if (details.element) payload.element = details.element;
    if (details.snapshot && captureSnapshots) payload.snapshot = details.snapshot;
    if (details.inputValue !== void 0) payload.inputValue = details.inputValue;
    if (details.key !== void 0) payload.key = details.key;
    if (details.scroll) payload.scroll = details.scroll;
    if (details.mutation) payload.mutation = details.mutation;
    if (details.actionResult) payload.actionResult = details.actionResult;
    if (details.metadata) payload.metadata = details.metadata;
    return payload;
  }
  async function executeAction(action) {
    const startedAt = Date.now();
    try {
      if (action.actionType === "web.dom.capture_snapshot" || action.actionType === "dom.capture_snapshot") {
        return success(action, startedAt, "Snapshot captured.", void 0, captureSnapshot());
      }
      if (action.actionType === "web.dom.wait_for_selector" || action.actionType === "dom.wait_for_selector") {
        const element = await waitForElement(action.selector, action.timeoutMs);
        return success(action, startedAt, "Selector found.", describeElement(element));
      }
      if (action.actionType === "web.dom.wait_for_text" || action.actionType === "dom.wait_for_text") {
        await waitForText(action.text ?? action.value ?? "", action.timeoutMs);
        return success(action, startedAt, "Text found.");
      }
      if (action.actionType === "web.dom.extract" || action.actionType === "dom.extract") {
        const element = resolveTarget(action);
        const extracted = extractElement(element, action.options);
        return success(action, startedAt, "Value extracted.", describeElement(element), void 0, extracted);
      }
      if (action.actionType === "web.dom.click" || action.actionType === "dom.click") {
        const element = resolveTarget(action);
        scrollElementIntoView(element);
        element.click();
        return success(action, startedAt, "Element clicked.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.type" || action.actionType === "dom.type") {
        const element = resolveTarget(action);
        element.focus();
        setElementValue(element, action.text ?? action.value ?? "");
        dispatchInputEvents(element);
        return success(action, startedAt, "Text entered.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.clear" || action.actionType === "dom.clear") {
        const element = resolveTarget(action);
        element.focus();
        setElementValue(element, "");
        dispatchInputEvents(element);
        return success(action, startedAt, "Field cleared.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.select" || action.actionType === "dom.select") {
        const element = resolveTarget(action);
        element.focus();
        element.value = action.value ?? "";
        dispatchInputEvents(element);
        return success(action, startedAt, "Option selected.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.scroll" || action.actionType === "dom.scroll") {
        window.scrollTo({
          left: Number(action.options?.x ?? action.coordinates?.x ?? window.scrollX),
          top: Number(action.options?.y ?? action.coordinates?.y ?? window.scrollY),
          behavior: action.options?.smooth === true ? "smooth" : "instant"
        });
        return success(action, startedAt, "Page scrolled.", void 0, captureSnapshot());
      }
      if (action.actionType === "web.dom.keypress" || action.actionType === "dom.keypress") {
        const target = action.selector ? resolveTarget(action) : document.activeElement ?? document.body;
        const key = action.key ?? action.text ?? "";
        target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
        return success(action, startedAt, "Key event dispatched.", target instanceof Element ? describeElement(target) : void 0);
      }
      throw new Error(`Unsupported action type: ${action.actionType}`);
    } catch (error) {
      return actionFailure(action, error, startedAt);
    }
  }
  function resolveTarget(action) {
    if (action.selector) {
      const element = document.querySelector(action.selector);
      if (!element) throw new Error(`No element matches selector: ${action.selector}`);
      return element;
    }
    if (action.coordinates) {
      const element = document.elementFromPoint(action.coordinates.x, action.coordinates.y);
      if (!element) throw new Error("No element exists at the requested coordinates.");
      return element;
    }
    const active = document.activeElement;
    if (active) return active;
    throw new Error("No selector, coordinates, or active element was available.");
  }
  function success(action, startedAt, message, element, snapshot, extracted) {
    const result = {
      commandId: action.commandId,
      actionType: action.actionType,
      status: "succeeded",
      message,
      url: location.href,
      title: document.title,
      startedAt,
      finishedAt: Date.now()
    };
    if (element) result.element = element;
    if (snapshot) result.snapshot = snapshot;
    if (extracted !== void 0) result.extracted = extracted;
    return result;
  }
  function actionFailure(action, error, startedAt = Date.now()) {
    return {
      commandId: action.commandId,
      actionType: action.actionType,
      status: "failed",
      message: error instanceof Error ? error.message : "Action failed.",
      url: location.href,
      title: document.title,
      startedAt,
      finishedAt: Date.now()
    };
  }
  function captureSnapshot() {
    const snapshot = {
      url: location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      interactiveElements: [...document.querySelectorAll("a, button, input, textarea, select, [role=button], [contenteditable=true]")].slice(0, 200).map((element) => describeElement(element))
    };
    const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : void 0;
    if (focused) snapshot.focusedElement = focused;
    const selectedText = window.getSelection()?.toString();
    if (selectedText) snapshot.selectedText = selectedText.slice(0, 2e3);
    return snapshot;
  }
  function describeElement(element) {
    const rect = element.getBoundingClientRect();
    const descriptor = {
      tagName: element.tagName.toLowerCase(),
      selector: selectorFor(element),
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };
    const text = visibleText(element);
    if (text) descriptor.text = text;
    const value = readElementValue(element);
    if (value !== void 0 && captureInputValues) descriptor.value = value;
    const role = element.getAttribute("role");
    if (role) descriptor.role = role;
    const name = accessibleName(element);
    if (name) descriptor.name = name;
    if (element instanceof HTMLAnchorElement && element.href) descriptor.href = element.href;
    if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
    const attributes = {};
    for (const attribute of ["id", "class", "name", "type", "placeholder", "aria-label", "data-testid"]) {
      const value2 = element.getAttribute(attribute);
      if (value2) attributes[attribute] = value2.slice(0, 500);
    }
    if (Object.keys(attributes).length) descriptor.attributes = attributes;
    return descriptor;
  }
  function selectorFor(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${cssString(testId)}"]`;
    const name = element.getAttribute("name");
    if (name) return `${element.tagName.toLowerCase()}[name="${cssString(name)}"]`;
    const parts = [];
    let current = element;
    while (current && current !== document.documentElement && parts.length < 5) {
      const parent = current.parentElement;
      const tag = current.tagName.toLowerCase();
      const siblings = parent ? [...parent.children].filter((child) => child.tagName === current?.tagName) : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(" > ");
  }
  function visibleText(element) {
    const text = element.textContent?.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 500) : void 0;
  }
  function readElementValue(element) {
    if (!element) return void 0;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return element.value.slice(0, 2e3);
    }
    if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2e3);
    return void 0;
  }
  function accessibleName(element) {
    return element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.getAttribute("alt") ?? void 0;
  }
  function pointerMetadata(event) {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    };
  }
  function cssString(value) {
    return CSS.escape(value).replace(/"/g, '\\"');
  }
  function scrollElementIntoView(element) {
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  }
  function setElementValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, value);
  }
  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function waitForElement(selector, timeoutMs = 1e4) {
    if (!selector) return Promise.reject(new Error("Selector is required."));
    const existing = document.querySelector(selector);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waitObserver.disconnect();
        reject(new Error(`Timed out waiting for selector: ${selector}`));
      }, timeoutMs);
      const waitObserver = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (!element) return;
        clearTimeout(timeout);
        waitObserver.disconnect();
        resolve(element);
      });
      waitObserver.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
  function waitForText(text, timeoutMs = 1e4) {
    if (document.body.innerText.includes(text)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waitObserver.disconnect();
        reject(new Error(`Timed out waiting for text: ${text}`));
      }, timeoutMs);
      const waitObserver = new MutationObserver(() => {
        if (!document.body.innerText.includes(text)) return;
        clearTimeout(timeout);
        waitObserver.disconnect();
        resolve();
      });
      waitObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
  }
  function extractElement(element, options) {
    const mode = options?.mode;
    if (mode === "html") return element.innerHTML;
    if (mode === "attribute" && typeof options?.attribute === "string") return element.getAttribute(options.attribute) ?? "";
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
    return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
  function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
  }
})();
//# sourceMappingURL=index.js.map
