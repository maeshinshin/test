# Production reverse proxy

The Go binary (`bin/streaming-server`) listens on `127.0.0.1:8080` over
HTTP/1.1 and h2c (unencrypted HTTP/2). It serves both the embedded SPA
and the Connect server-streaming RPC
`/streaming.v1.RandomStreamer/StreamRandom`.

This directory contains two sample reverse-proxy configurations that
terminate TLS and forward traffic to the backend.

## nginx (`nginx.conf`)

- Listens on `:80` (HTTP→HTTPS redirect + ACME passthrough) and `:443`
  (TLS 1.2/1.3, HSTS, etc.).
- Forwards all traffic to upstream `streaming_backend` (127.0.0.1:8080).
- Uses `proxy_http_version 1.1` + `Connection: ""` so the Go server can
  negotiate an h2c upgrade, keeping server-streaming end-to-end.
- `proxy_buffering off` and `proxy_read_timeout 120s` ensure streamed
  characters reach the browser immediately and the 1-minute stream is
  not cut off.

Usage:

```bash
# 1. Issue a cert (or use an existing one).
sudo certbot certonly --webroot -w /var/www/acme -d example.com

# 2. Drop the config in.
sudo cp deploy/nginx.conf /etc/nginx/sites-available/streaming
sudo ln -s /etc/nginx/sites-available/streaming /etc/nginx/sites-enabled/streaming
sudo nginx -t && sudo systemctl reload nginx
```

## Envoy (`envoy.yaml`)

- Listeners on `:80` (redirect) and `:443` (TLS via SDS).
- Forwards `/streaming.v1.RandomStreamer/*` and `/` (SPA) to
  `streaming_backend` (127.0.0.1:8080).
- Speaks HTTP/2 to the upstream via `explicit_http_protocol_options`
  (matches the Go server's `SetUnencryptedHTTP2(true)`).
- `stream_idle_timeout: 120s` and per-route `max_stream_duration: 120s`
  cover the full 1-minute stream plus headroom.
- Includes an example gzip compressor on the response path.

The SDS reference `/etc/envoy/certs/server.yaml` should look like:

```yaml
resources:
  - "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.Secret
    name: server_cert
    tls_certificate:
      certificate_chain:
        filename: /etc/envoy/certs/fullchain.pem
      private_key:
        filename: /etc/envoy/certs/privkey.pem
```

Run with:

```bash
envoy --config-path deploy/envoy.yaml
```

## Backend CORS

The Go server sets `Access-Control-Allow-Origin: *` on RPC responses so
the SPA can live on a different origin (e.g. `https://app.example.com`
calling `https://api.example.com`). For production, narrow this to your
frontend origin in `backend/server/server.go`.

## Docker Compose

Two ready-to-run stacks are provided; both ship the Go backend (with the
embedded SPA) plus a reverse proxy.

### Prerequisite: place your cert

Both stacks read the certificate from `deploy/certs/`:

```bash
mkdir -p deploy/certs
cp /etc/letsencrypt/live/example.com/fullchain.pem deploy/certs/
cp /etc/letsencrypt/live/example.com/privkey.pem   deploy/certs/
# For Envoy, also enable SDS:
cp deploy/certs/server.yaml.example deploy/certs/server.yaml
```

(For local testing, drop in a self-signed cert or use `mkcert` to create
`fullchain.pem` / `privkey.pem` in `deploy/certs/`.)

### nginx stack

```bash
docker compose -f deploy/docker-compose.nginx.yaml up -d
```

- Listens on `:80` and `:443` (override with `HTTP_PORT` / `HTTPS_PORT`).
- Uses `deploy/nginx.conf` mounted as `/etc/nginx/conf.d/default.conf`.

### Envoy stack

```bash
docker compose -f deploy/docker-compose.envoy.yaml up -d
```

- Listens on `:80` and `:443` plus admin on `:9901` (override with
  `HTTP_PORT` / `HTTPS_PORT` / `ADMIN_PORT`).
- Uses `deploy/envoy.yaml` plus SDS resources from `deploy/certs/`.
- Backend is reachable on the internal `internal` Docker network only.

### Image

Both stacks pull the same image from GHCR:

```
ghcr.io/maeshinshin/test:${IMAGE_TAG:-dev}
```

`IMAGE_TAG` defaults to `dev`; pin a date or commit tag for reproducible
deploys, e.g. `IMAGE_TAG=v0.0.0-2026.07.27`. `pull_policy: always`
ensures `docker compose up` always fetches the latest matching tag from
the registry.

If the repository is private, log in once before `up`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
```

The image itself is a multi-stage build (see `backend/Dockerfile`):

- Stage 1 (`node:22-bookworm-slim`): runs `pnpm install` + `pnpm build`,
  producing `backend/web/frontend_dist/`.
- Stage 2 (`golang:1.26-bookworm`): copies those assets in and compiles
  a static Go binary.
- Final stage (`alpine:3.20`): ships the binary with `wget` for the
  healthcheck. Runs as a non-root `app` user.

Multi-platform builds (`linux/amd64`, `linux/arm64`) are produced via
`docker buildx` and pushed by `ghr` as OCI tarballs attached to GitHub
Releases.

## Self-signed certificate (`cert-init`)

Both stacks include a `cert-init` service that generates a self-signed
certificate on first start. The cert's SAN entries are taken from
environment variables so it works for your hostname and/or public IP:

| Variable      | Default                          | Description                                     |
| ------------- | -------------------------------- | ----------------------------------------------- |
| `SERVER_NAME` | `localhost,example.com`          | Comma-separated DNS names (CN = first entry).   |
| `SERVER_IP`   | `127.0.0.1`                      | Comma-separated IPs to embed as `IP:...` SAN.   |
| `DAYS`        | `365`                            | Validity in days.                               |
| `HTTP_PORT`   | `80`                             | External HTTP port on the host.                 |
| `HTTPS_PORT`  | `443`                            | External HTTPS port on the host.                |
| `ADMIN_PORT`  | `9901` (Envoy only)              | Envoy admin port on the host.                   |

Example for a server reachable at `203.0.113.10` and `stream.example.com`:

```bash
SERVER_NAME="stream.example.com,api.stream.example.com" \
SERVER_IP="203.0.113.10" \
  docker compose -f deploy/docker-compose.nginx.yaml up -d
```

Re-running `cert-init` is a no-op once `fullchain.pem` and `privkey.pem`
exist in `deploy/certs/`. To regenerate, delete those two files (or the
whole `certs/` directory) and `docker compose up` again.
