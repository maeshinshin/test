import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { RandomStreamer } from '@gen/proto/streaming/v1/streaming_pb'

/**
 * Resolve the base URL for the ConnectRPC backend.
 *
 * Priority:
 *  1. VITE_API_BASE_URL (set at build time, e.g. "https://api.example.com")
 *  2. window.location.pathname-aware origin (works for /app/ same-origin prod
 *     and for the Vite dev server, both of which serve the SPA under /app/).
 */
function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv && fromEnv.trim() !== '') {
    return fromEnv.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Strip everything after the SPA's mount point so the connect-web
    // transport can append its own `/<package>.<Service>/<Method>` path.
    const path = window.location.pathname
    const mount = path.replace(/\/+$/, '').endsWith('/app')
      ? '/app'
      : path.match(/^(.*?\/app)(\/|$)/)?.[1] ?? ''
    return window.location.origin + mount
  }
  return ''
}

const transport = createConnectTransport({
  baseUrl: resolveBaseUrl(),
  // Use JSON for browser/dev friendliness; switch to 'binary' for production wire size.
  useBinaryFormat: false,
})

export const randomStreamerClient = createClient(RandomStreamer, transport)
