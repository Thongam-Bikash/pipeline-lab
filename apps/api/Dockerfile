# Build with the same Node version the repo targets.
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app

# Copy the manifests first so installs stay cached until dependencies change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
RUN npm ci

COPY . .
RUN npm run build -w @pipeline-lab/api
# Reinstall this workspace alone: `npm prune` keeps every workspace's dependencies,
# which would ship the web app's React and Monaco inside the API image.
RUN rm -rf node_modules && npm ci --omit=dev -w @pipeline-lab/api --include-workspace-root

FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
# pg_dump and psql for the backup and its restore drill; the client's major version must match the server's.
RUN apk add --no-cache postgresql18-client
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/package.json apps/api/
COPY apps/api/drizzle apps/api/drizzle

# The base image already has this unprivileged user.
USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
