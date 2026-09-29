# Built from the repository root: web renders the shared UI in packages/app.
FROM node:22-alpine AS build
WORKDIR /src
# Every workspace manifest, because npm ci checks the lockfile against all of them.
COPY package.json package-lock.json ./
COPY packages/app/package.json ./packages/app/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
RUN npm ci --workspace bacthang-app --workspace bacthang-web

COPY tsconfig.base.json ./
COPY packages/app ./packages/app
COPY packages/web ./packages/web

ARG VITE_API_BASE=/api
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_BOARD_NAME
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID \
    VITE_BOARD_NAME=$VITE_BOARD_NAME
RUN npm run --workspace bacthang-web build

FROM nginx:alpine
COPY --from=build /src/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
