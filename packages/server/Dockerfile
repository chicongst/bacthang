# Built from the repository root: the lockfile is one file for the whole workspace.
FROM node:22-alpine AS build
WORKDIR /src
# Every workspace manifest, because npm ci checks the lockfile against all of them.
COPY package.json package-lock.json ./
COPY packages/app/package.json ./packages/app/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
RUN npm ci --workspace bacthang-server

COPY tsconfig.base.json ./
COPY packages/server ./packages/server
RUN npm run --workspace bacthang-server build \
  && npm prune --omit=dev \
  && rm -rf packages/server/src packages/server/test packages/server/scripts \
            packages/server/tsconfig*.json tsconfig.base.json

FROM node:22-alpine
ENV NODE_ENV=production
# The whole tree, so node resolves the hoisted modules at /src/node_modules the way it did at build.
COPY --from=build /src /src
WORKDIR /src/packages/server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/index.js"]
