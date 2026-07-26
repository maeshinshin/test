.PHONY: help build frontend backend run curl-stream curl-stream-grpc clean

ADDR ?= 127.0.0.1
PORT ?= 8080
PROTO_SCHEMA ?= ./proto/streaming/v1/streaming.proto
TIMEOUT ?= 3s

help:  ## show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: frontend backend  ## build frontend (pnpm) + backend (go) into a single binary

frontend:  ## build the frontend SPA into backend/web/frontend_dist
	cd frontend && pnpm build

backend: frontend  ## build the Go backend, embedding the frontend
	cd backend && go build -o ../bin/streaming-server ./cmd

run: build  ## build and run the single-binary server
	./bin/streaming-server -p $(PORT) -a $(ADDR)

curl-stream:  ## buf curl the streaming RPC (Connect protocol, h2c). Override TIMEOUT for longer runs.
	buf curl \
	  --schema $(PROTO_SCHEMA) \
	  --reflect=false \
	  --http2-prior-knowledge \
	  --timeout $(TIMEOUT) \
	  http://$(ADDR):$(PORT)/streaming.v1.RandomStreamer/StreamRandom

curl-stream-grpc:  ## buf curl the streaming RPC via gRPC protocol (h2c).
	buf curl \
	  --schema $(PROTO_SCHEMA) \
	  --reflect=false \
	  --protocol grpc \
	  --http2-prior-knowledge \
	  --timeout $(TIMEOUT) \
	  http://$(ADDR):$(PORT)/streaming.v1.RandomStreamer/StreamRandom

clean:  ## remove build artifacts
	rm -rf bin backend/web/frontend_dist
