.PHONY: help \
        deploy-help deploy-prereqs deploy-cert deploy-build deploy-up deploy-down deploy-logs deploy-ps deploy-restart deploy-curl-https

# ---------- Deploy defaults (override via env) ----------
DEPLOY_COMPOSE ?= deploy/docker-compose.nginx.yaml
# HOST_SAN is the comma-separated list of names/IPs to put into the
# self-signed certificate. Default is local-only; for a public host run:
#   make deploy-up HOST_SAN=203.0.113.10,localhost CERT_HOSTNAME=203.0.113.10
HOST_SAN        ?= localhost,127.0.0.1
CERT_HOSTNAME   ?= $(word 1,$(subst $(comma), ,$(HOST_SAN)))
CERT_SAN        ?= $(HOST_SAN)
CERT_DAYS       ?= 365
COMPOSE         ?= docker compose
IMAGE_TAG       ?= local

comma := ,

help:  ## show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------- Docker Compose deployment (HTTPS) ----------
deploy-help:  ## show deploy-specific help
	@echo "Deploy targets (defaults work for git clone -> docker compose up):"
	@echo "  make deploy-prereqs    # check docker / docker compose are available"
	@echo "  make deploy-cert       # (re)generate the self-signed TLS certificate"
	@echo "  make deploy-build      # build the backend image"
	@echo "  make deploy-up         # start backend + nginx + cert-init"
	@echo "  make deploy-down       # stop the stack"
	@echo "  make deploy-restart    # recreate nginx (e.g. after nginx.conf changes)"
	@echo "  make deploy-ps / deploy-logs"
	@echo "  make deploy-curl-https STREAM_SECS=2 [HOST=localhost | HOST=127.0.0.1]"
	@echo
	@echo "Override the certificate subject / SAN list with env vars:"
	@echo "  HOST_SAN=203.0.113.10,localhost CERT_HOSTNAME=203.0.113.10 \\"
	@echo "    make deploy-cert deploy-up"

deploy-prereqs:  ## verify that docker and docker compose are installed
	@command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "docker daemon is not reachable (are you in the docker group?)"; exit 1; }
	@$(COMPOSE) version >/dev/null 2>&1 || { echo "docker compose plugin is required"; exit 1; }
	@echo "docker + compose OK"

deploy-cert:  ## (re)generate deploy/certs/{fullchain,privkey}.pem via cert-init
	@rm -f deploy/certs/fullchain.pem deploy/certs/privkey.pem
	@HOST_SAN='$(HOST_SAN)' CERT_SAN='$(CERT_SAN)' CERT_HOSTNAME='$(CERT_HOSTNAME)' DAYS='$(CERT_DAYS)' \
	  $(COMPOSE) -f $(DEPLOY_COMPOSE) run --rm cert-init

deploy-build:  ## build the backend image used by the stack
	IMAGE_TAG='$(IMAGE_TAG)' $(COMPOSE) -f $(DEPLOY_COMPOSE) build --pull backend

deploy-up: deploy-prereqs deploy-cert  ## start the stack (HTTPS) and stream logs
	IMAGE_TAG='$(IMAGE_TAG)' $(COMPOSE) -f $(DEPLOY_COMPOSE) up -d --build

deploy-restart:  ## recreate just the nginx container (e.g. after editing nginx.conf)
	$(COMPOSE) -f $(DEPLOY_COMPOSE) up -d --force-recreate --no-deps nginx

deploy-down:  ## stop the stack
	$(COMPOSE) -f $(DEPLOY_COMPOSE) down --remove-orphans

deploy-ps:  ## show stack status
	$(COMPOSE) -f $(DEPLOY_COMPOSE) ps

deploy-logs:  ## tail logs from all services
	$(COMPOSE) -f $(DEPLOY_COMPOSE) logs -f --tail=200

# Quick HTTP streaming check. Streams a few seconds of ConnectRPC output
# against the public HTTPS endpoint and exits 0 on any frames received.
STREAM_SECS ?= 2
HOST        ?= localhost
deploy-curl-https:  ## curl the ConnectRPC stream via the HTTPS endpoint
	@curl -k --http1.1 --no-buffer --max-time $(STREAM_SECS) -X POST \
	  -H 'Content-Type: application/connect+json' \
	  -H 'Connect-Protocol-Version: 1' \
	  -d '{}' \
	  https://$(HOST)/app/streaming.v1.RandomStreamer/StreamRandom
	@echo
