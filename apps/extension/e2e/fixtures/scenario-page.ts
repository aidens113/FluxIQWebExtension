import { createServer, type Server } from "node:http";

export type ScenarioPage = {
  origin: string;
  close(): Promise<void>;
};

const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Extension smoke scenario</title></head>
  <body>
    <main>
      <h1>Extension smoke scenario</h1>
      <label for="name">Name</label>
      <input id="name" data-testid="name" autocomplete="off">
      <button id="submit" data-testid="submit" type="button">Submit</button>
      <output id="result" data-testid="result">Waiting</output>
    </main>
    <script>
      document.querySelector('#submit').addEventListener('click', () => {
        document.querySelector('#result').textContent = document.querySelector('#name').value || 'empty';
      });
    </script>
  </body>
</html>`;

export async function startScenarioPage(): Promise<ScenarioPage> {
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end('{"ok":true}');
      return;
    }
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'self' 'unsafe-inline'"
    });
    response.end(html);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("fixture.invalid: scenario server did not receive a TCP address");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server)
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    // Chromium may retain a keep-alive connection after the page assertion has
    // completed. Those test-owned sockets must not turn fixture cleanup into a
    // test timeout.
    server.closeAllConnections();
  });
}
