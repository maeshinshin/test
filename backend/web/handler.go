package web

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// Handler returns an http.Handler that serves the embedded frontend assets.
// Unknown paths fall back to index.html so client-side routing works.
func Handler() http.Handler {
	sub, err := fs.Sub(assets, "frontend_dist")
	if err != nil {
		// embed.FS is built from the local filesystem at compile time;
		// a missing sub-dir here is a build error, so panic loudly.
		panic("web: failed to sub frontend_dist: " + err.Error())
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only handle GET/HEAD for SPA assets. RPC routes are mounted
		// separately on the mux, so anything reaching here is meant to
		// be served as a static asset.
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		upath := r.URL.Path
		// Reject obvious path-traversal attempts up front.
		if strings.Contains(upath, "..") {
			http.NotFound(w, r)
			return
		}

		// Serve a real file if it exists; otherwise fall back to index.html
		// (SPA client-side routing).
		clean := strings.TrimPrefix(path.Clean(upath), "/")
		if clean == "" {
			serveIndex(w, r, sub)
			return
		}
		if _, err := fs.Stat(sub, clean); err != nil {
			serveIndex(w, r, sub)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, sub fs.FS) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFileFS(w, r, sub, "index.html")
}
