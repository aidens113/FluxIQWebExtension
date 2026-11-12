/** Text with anything shaped like an enrolment ticket (`fxet_` and its body) replaced, for messages that may echo a failure. */
export function redactTicket(text: string): string {
  return text.replace(/fxet_[A-Za-z0-9_-]+/gu, "[ticket]");
}
