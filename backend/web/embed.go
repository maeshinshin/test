// Package web embeds the built frontend assets so the backend can serve
// the single-page application from a single binary.
//
// The build artifact is produced by `pnpm build` in the frontend project
// and lands in backend/web/frontend_dist (see frontend/vite.config.ts).
package web

import "embed"

//go:embed all:frontend_dist
var assets embed.FS
