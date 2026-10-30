// Starts the stand-in from the environment. Prints `site: http://localhost:<port>`.
import { fileURLToPath } from "node:url";
import { createSiteServer } from "./serve.mjs";
import { readSignupConfig } from "./signup/index.mjs";

const config = readSignupConfig(process.env);
const server = createSiteServer({
  config,
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  log: (line) => console.log(line)
});
server.listen(config.port, config.host, () => {
  const port = server.address().port;
  // The same-origin rule needs the origin the browser uses.
  if (!config.siteOrigin) config.siteOrigin = `http://localhost:${port}`;
  console.log(`site: http://localhost:${port}`);
});
