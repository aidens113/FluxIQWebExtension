# The runner image of a FluxIQ dedicated browser: Chromium, the built FluxIQ
# extension and the browser host's runner (`fluxiq-runner`). FluxIQ Core's
# docker driver starts one container from it per dedicated browser, and
# `fluxiq-cloud up` (Core's packages/cloud) builds it from this checkout:
#
#   pnpm --filter @fluxiq-web-extension/extension build
#   pnpm --filter @fluxiq-web-extension/browser-host build
#   docker build -f deploy/runner/Dockerfile -t fluxiq-cloud/runner:<version> .
#
# The context is this repository's root; Dockerfile.dockerignore beside this
# file sends only the two built folders. The container runs as `node`, with a
# read-only root filesystem, no capabilities and no published port; its one
# writable place that lasts is /profile (the environment's volume). It reaches
# its tenant's gateway through the deployment's public origin, and takes its
# enrolment ticket only from `fluxiq-runner enrol` on a `docker exec`'s
# standard input, never from its environment or arguments.

ARG NODE_IMAGE=node:22-trixie-slim
FROM ${NODE_IMAGE}

# chromium: the browser (Debian's, unbranded, so it loads an unpacked
# extension); libnss3-tools: certutil, to trust a rehearsal's local root;
# procps: ps, which the browser host's reaper lists processes with.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends chromium libnss3-tools procps ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/fluxiq/browser-host
# The runner's one runtime dependency, at the version the browser host pins.
COPY packages/browser-host/package.json /tmp/browser-host.package.json
RUN node -e "const p=require('/tmp/browser-host.package.json');require('fs').writeFileSync('package.json',JSON.stringify({name:'fluxiq-runner',private:true,type:'module',dependencies:{'playwright-core':p.dependencies['playwright-core']}}))" \
  && npm install --omit=dev --no-audit --no-fund \
  && npm cache clean --force \
  && rm /tmp/browser-host.package.json
COPY packages/browser-host/dist ./dist
COPY apps/extension/dist/chrome /opt/fluxiq/extension

RUN printf '#!/bin/sh\nexec node /opt/fluxiq/browser-host/dist/runner/main.js "$@"\n' > /usr/local/bin/fluxiq-runner \
  && chmod 0755 /usr/local/bin/fluxiq-runner \
  && mkdir -p /profile /run/fluxiq \
  && chown node:node /profile /run/fluxiq

ENV NODE_ENV=production \
    HOME=/tmp/home \
    FLUXIQ_BROWSER_EXTENSION_PATH=/opt/fluxiq/extension \
    FLUXIQ_RUNNER_BROWSER=/usr/bin/chromium \
    FLUXIQ_RUNNER_SOCKET=/run/fluxiq/enrol.sock

USER node
ENTRYPOINT ["fluxiq-runner"]
CMD ["serve"]
