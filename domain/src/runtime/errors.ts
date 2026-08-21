export class WebAutomationRuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WebAutomationRuntimeError";
    this.code = code;
  }
}
