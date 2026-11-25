const SECRET_LABEL = /pass(word|code)|secret|token|\bpin\b|cvv|card number|api.?key/iu;
const SECRET_SHAPES: readonly RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gu,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/gu,
  /\b(?:sk|pk|ghp|xox[a-z])-?[A-Za-z0-9_-]{20,}/gu,
  /\b(?:authorization|cookie|set-cookie|x-api-key|api[_-]?key|token|secret|password)\s*[:=]\s*\S+/giu,
  /\b[A-Fa-f0-9]{32,}\b/gu,
  // A long mixed-case token with a digit: a lowercase address slug is not one.
  /\b(?=[A-Za-z0-9+_-]*[A-Z])(?=[A-Za-z0-9+_-]*[a-z])(?=[A-Za-z0-9+_-]*\d)[A-Za-z0-9+_-]{40,}={0,2}/gu,
];

/** True when a control's words say that what goes into it is a secret. */
export function isSecretLabel(label: string | undefined): boolean {
  return label !== undefined && SECRET_LABEL.test(label);
}

/** Text for the picture: anything shaped like a token, cookie, auth header or key is replaced; the rest is run evidence and stays. */
export function redactChartText(text: string): string {
  return SECRET_SHAPES.reduce((kept, shape) => kept.replace(shape, "[hidden]"), text);
}
