# Docker Compose deployment (HTTPS)

The `deploy/` directory ships a Docker-based nginx + Go backend stack
that is driven by the `deploy-*` targets in the top-level `Makefile`.
After `git clone`, the entire flow is:

```bash
# 1. (optional) tell the self-signed cert which public name/IP to claim.
#    Default is localhost / 127.0.0.1; for a public host run:
export HOST_SAN=203.0.113.10,localhost
export CERT_HOSTNAME=203.0.113.10

# 2. One command does everything: prereq check, cert generation,
#    image build, stack up.
make deploy-up

# 3. Inspect / use the stack.
make deploy-ps
make deploy-curl-https HOST=127.0.0.1 STREAM_SECS=2   # or HOST=localhost
make deploy-logs
```

If you manually replaced the certificate files in `deploy/certs/`, use the
following target. It does not run `deploy-cert`, so the existing certificate
and private key are preserved:

```bash
make deploy-up-existing-cert
```

`make deploy-up` runs, in order:

1. `deploy-prereqs` — verifies `docker` + `docker compose` are usable.
2. `deploy-cert` — runs the `cert-init` service, which writes
   `deploy/certs/fullchain.pem` and `deploy/certs/privkey.pem` with a
   self-signed certificate whose `subjectAltName` is built from
   `HOST_SAN`. The defaults are `localhost,127.0.0.1`. Override with:
   ```bash
   make deploy-cert HOST_SAN=203.0.113.10,localhost CERT_HOSTNAME=203.0.113.10
   ```
3. `docker compose up -d --build` — starts `cert-init` (one-shot; it skips
   generation when certificate files already exist), `backend` (Go server,
   local image), and `nginx` (TLS terminator +
   reverse proxy). nginx exposes `:80` (HTTP→HTTPS) and `:443`
   (HTTPS). Override with `HTTP_PORT=8080 HTTPS_PORT=8443`.

The backend `Dockerfile` runs `buf generate` during build, so a fresh
clone only needs the tools the Makefile itself depends on (docker +
compose). `pnpm` and `go` are pulled in via the multi-stage image
build, not on the host.

## Available Make targets (deploy namespace)

| Target                | Purpose                                                    |
|-----------------------|------------------------------------------------------------|
| `make deploy-help`    | Show this list of deploy targets.                          |
| `make deploy-prereqs` | Verify docker / docker compose.                            |
| `make deploy-cert`    | (Re)generate the self-signed cert.                        |
| `make deploy-build`   | Build the backend image only.                             |
| `make deploy-up`      | `prereqs` → `cert` → `up -d --build`.                      |
| `make deploy-up-existing-cert` | Start with the existing certificate files; do not regenerate them. |
| `make deploy-restart` | Recreate the nginx container (e.g. after editing config).  |
| `make deploy-down`    | Stop the stack.                                            |
| `make deploy-ps`      | Show container status.                                     |
| `make deploy-logs`    | Tail logs.                                                 |
| `make deploy-curl-https HOST=… STREAM_SECS=…` | Quick ConnectRPC stream check.       |

## Environment variables

| Variable        | Default                  | Effect                                                 |
|-----------------|--------------------------|--------------------------------------------------------|
| `HOST_SAN`      | `localhost,127.0.0.1`    | Comma-separated names/IPs to embed in the cert SAN.    |
| `CERT_HOSTNAME` | First entry of `HOST_SAN`| Certificate `CN`.                                      |
| `CERT_SAN`      | `HOST_SAN`               | SAN list passed to `cert-init` (defaults from HOST_SAN).|
| `CERT_DAYS`     | `365`                    | Validity period in days.                               |
| `HTTP_PORT`     | `80`                     | Host port for the HTTP listener.                       |
| `HTTPS_PORT`    | `443`                    | Host port for the HTTPS listener.                      |
| `IMAGE_TAG`     | `local`                  | Tag applied to the locally built backend image.        |
| `DEPLOY_COMPOSE`| `deploy/docker-compose.nginx.yaml` | Compose file to use.                      |

`HOST_SAN` accepts comma-separated DNS names and IP addresses. The
certificate generator emits DNS names as `DNS:...` and IPv4 addresses as
`IP:...` in the certificate SAN. Entries may also be supplied explicitly
with an OpenSSL prefix, such as `DNS:example.com` or `IP:127.0.0.1`.

## Using a real certificate

Drop your own `fullchain.pem` and `privkey.pem` into `deploy/certs/`
(overwriting the self-signed files), then start or reload nginx without
regenerating the certificate:

```bash
make deploy-up-existing-cert
make deploy-restart
```

`deploy-up-existing-cert` verifies that both files exist and starts the
stack without running `deploy-cert`. `deploy-restart` only recreates nginx,
which is useful when the stack is already running.

The nginx configuration contains an ACME HTTP-01 challenge location, but
this Compose setup does not mount an ACME webroot or run certbot. Additional
volume and renewal configuration is required before using ACME renewal.

## Verifying the stack

```bash
# Is nginx healthy?
make deploy-ps

# Quick ConnectRPC stream check from the host:
make deploy-curl-https HOST=127.0.0.1 STREAM_SECS=2

# From any browser, open https://127.0.0.1/app/ and start the stream.
```

The browser uses `Content-Type: application/connect+json` (set by the
`@connectrpc/connect-web` client) and a `Connect-Protocol-Version: 1`
header, so the 415 you would see with a raw `curl -d '{}'` /
`Content-Type: application/json` does not apply.
