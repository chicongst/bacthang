# Build từ thư mục gốc ranking/ vì web dùng chung giao diện trong app/
FROM node:22-alpine AS build
WORKDIR /src
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY app ./app
COPY web ./web

ARG VITE_API_BASE=/api
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_BOARD_NAME
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID \
    VITE_BOARD_NAME=$VITE_BOARD_NAME
RUN cd web && npm run build

FROM nginx:alpine
COPY --from=build /src/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
