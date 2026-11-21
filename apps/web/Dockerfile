# Build with the same Node version the repo targets.
FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /app

# Copy the manifests first so installs stay cached until dependencies change.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/engine/package.json packages/engine/
RUN npm ci

COPY . .
# Scoped, because the root build script now covers every workspace.
RUN npm run build -w @pipeline-lab/web

# Serve the built files. No Node, no source code, and no dependencies ship in this image.
FROM nginx:stable-alpine@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
