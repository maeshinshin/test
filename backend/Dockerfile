# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the RandomStream backend.
#
# Stage 1: build the embedded SPA (pnpm) and the Go binary.
# Stage 2: ship the Go binary in a minimal Alpine image (small, has wget
#          for the healthcheck, runs as non-root).

ARG GO_VERSION=1.26
ARG NODE_VERSION=22

# ---------- frontend ----------
FROM node:${NODE_VERSION}-bookworm-slim AS frontend
WORKDIR /src/frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# ---------- backend ----------
FROM golang:${GO_VERSION}-bookworm AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# Drop the freshly-built frontend assets into the embed directory.
COPY --from=frontend /src/backend/web/frontend_dist ./web/frontend_dist
# Build a fully static binary.
RUN CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w" \
      -o /out/streaming-server ./cmd

# ---------- runtime ----------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget \
    && addgroup -S app && adduser -S app -G app
COPY --from=backend /out/streaming-server /usr/local/bin/streaming-server
USER app
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/streaming-server"]
