package server

import "net/http"

var corsHeaders = map[string]string{
	"Access-Control-Allow-Headers":  "Content-Type,Connect-Protocol,Connect-Timeout-Ms",
	"Access-Control-Allow-Methods":  "GET,POST,OPTIONS",
	"Access-Control-Allow-Origin":   "*",
	"Access-Control-Expose-Headers": "Grpc-Status,Grpc-Message,Grpc-Encoding,Grpc-Accept-Encoding",
}

type Server struct {
	mux        *http.ServeMux
	httpServer *http.Server
	port       string
	addr       string
}

type Option func(s *Server)

func WithPort(port string) Option {
	return func(s *Server) {
		s.port = port
	}
}

func WithAddr(addr string) Option {
	return func(s *Server) {
		s.addr = addr
	}
}

func NewServer(opts ...Option) *Server {
	s := &Server{
		addr: "127.0.0.1",
		port: "8080",
		mux:  http.NewServeMux(),
	}

	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *Server) RegisterHandler(path string, handler http.Handler) {
	s.mux.Handle(path, handler)
}

func (s *Server) Start() error {
	p := new(http.Protocols)
	p.SetHTTP1(true)
	// p.SetHTTP2(true)
	p.SetUnencryptedHTTP2(true)

	s.httpServer = &http.Server{
		Addr:      s.addr + ":" + s.port,
		Handler:   corsMiddleware(s.mux),
		Protocols: p,
	}

	return s.httpServer.ListenAndServe()
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for name, value := range corsHeaders {
			w.Header().Set(name, value)
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
