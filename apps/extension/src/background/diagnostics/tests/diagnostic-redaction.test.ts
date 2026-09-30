import assert from "node:assert/strict";
import test from "node:test";

import { DIAGNOSTIC_WITHHELD, diagnosticOrigin, MAXIMUM_DIAGNOSTIC_TEXT_LENGTH, redactDiagnosticText } from "../diagnostic-redaction";

test("a named literal is withheld wherever it appears", () => {
  assert.equal(redactDiagnosticText("refused token tok-secret-123 twice: tok-secret-123", ["tok-secret-123"]), `refused token ${DIAGNOSTIC_WITHHELD} twice: ${DIAGNOSTIC_WITHHELD}`);
});

test("a URL keeps its origin and loses its path, query and credentials", () => {
  const text = redactDiagnosticText("GET https://user:pw@shop.example:8443/account/orders?session=abc#x failed");
  assert.equal(text, "GET https://shop.example:8443 failed");
});

test("bearer credentials and secret assignments are withheld", () => {
  assert.equal(redactDiagnosticText("sent Bearer abc.def.ghi"), `sent Bearer ${DIAGNOSTIC_WITHHELD}`);
  assert.ok(!redactDiagnosticText("Authorization: Bearer abc.def.ghi").includes("abc"));
  assert.equal(redactDiagnosticText("password=hunter2 and api_key: k-1 and sessionId=s1"), `password=${DIAGNOSTIC_WITHHELD} and api_key: ${DIAGNOSTIC_WITHHELD} and sessionId=${DIAGNOSTIC_WITHHELD}`);
});

test("quoted values, e-mail addresses and long numbers are withheld; apostrophes are not quotes", () => {
  assert.equal(redactDiagnosticText(`Could not type "hunter2" into #password`), `Could not type "${DIAGNOSTIC_WITHHELD}" into #password`);
  assert.equal(redactDiagnosticText("Can't find 'Jane Doe' in FluxIQ's list"), `Can't find "${DIAGNOSTIC_WITHHELD}" in FluxIQ's list`);
  assert.equal(redactDiagnosticText("mail jane@example.com card 4111 1111 1111 1111"), `mail ${DIAGNOSTIC_WITHHELD} card ${DIAGNOSTIC_WITHHELD}`);
  assert.equal(redactDiagnosticText("attempt 3 of 5 after 1200 ms"), "attempt 3 of 5 after 1200 ms");
});

test("long text is cut to the limit", () => {
  const text = redactDiagnosticText("x ".repeat(500));
  assert.equal(text.length, MAXIMUM_DIAGNOSTIC_TEXT_LENGTH);
});

test("an origin is scheme, host and port, and a non-address is withheld", () => {
  assert.equal(diagnosticOrigin("ws://127.0.0.1:4777/client?token=abc"), "ws://127.0.0.1:4777");
  assert.equal(diagnosticOrigin("not an address"), DIAGNOSTIC_WITHHELD);
});
