package main

import (
	"flag"
	"log"
	"os"

	"github.com/maeshinshin/test/backend/gen/proto/streaming/v1/streamingv1connect"
	"github.com/maeshinshin/test/backend/handler"
	"github.com/maeshinshin/test/backend/server"
	"github.com/maeshinshin/test/backend/web"
)

var (
	port string
	addr string
)

func init() {
	flag.StringVar(&port, "p", "8080", "port")
	flag.StringVar(&addr, "a", "0.0.0.0", "addr")
	flag.Parse()
}

func main() {
	s := server.NewServer(
		server.WithAddr(addr),
		server.WithPort(port),
	)

	// gRPC-Web / Connect streaming RPC.
	randomStreamerPath, randomStreamerHandler := streamingv1connect.NewRandomStreamerHandler(
		handler.NewRandomStreamerHandler(),
	)
	s.RegisterHandler(randomStreamerPath, randomStreamerHandler)
	log.Printf("RandomStreamer registered at %s", randomStreamerPath)

	// Embedded SPA frontend. Catch-all under "/" so it acts as a SPA
	// fallback for unknown paths.
	s.RegisterHandler("/", web.Handler())
	log.Printf("Frontend SPA served from /")

	if err := s.Start(); err != nil {
		log.Printf("server stopped: %v", err)
		os.Exit(1)
	}
}
