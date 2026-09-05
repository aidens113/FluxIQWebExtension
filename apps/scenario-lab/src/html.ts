export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function page(title: string, body: string, script: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { font: 16px/1.5 system-ui, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; }
      label { display: block; margin: .75rem 0; }
      button, input, select { font: inherit; }
      [aria-live] { min-height: 1.5em; }
      li { display: flex; gap: .75rem; margin: .4rem 0; }
      nav { display: flex; gap: 1rem; }
    </style>
  </head>
  <body>${body}<script type="module">${script}</script></body>
</html>`;
}

export function fixtureClient(runToken: string, scenarioId: string): string {
  return `
const runToken = ${JSON.stringify(runToken)};
const scenarioId = ${JSON.stringify(scenarioId)};
async function mutate(operation, payload = {}) {
  const response = await fetch('/api/' + scenarioId + '/' + operation, {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + runToken, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Fixture mutation failed: ' + response.status);
  return response.json();
}`;
}
