import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { RandomStreamer } from '@gen/proto/streaming/v1/streaming_pb'

/**
 * Resolve the base URL for the ConnectRPC backend.
 *
 * Priority:
 *  1. VITE_API_BASE_URL (set at build time, e.g. "https://api.example.com")
 *  2. window.location.origin (works with the Vite dev proxy and same-origin prod)
 */
function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv && fromEnv.trim() !== '') {
    return fromEnv.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

const transport = createConnectTransport({
  baseUrl: resolveBaseUrl(),
  // Use JSON for browser/dev friendliness; switch to 'binary' for production wire size.
  useBinaryFormat: false,
})

export const randomStreamerClient = createClient(RandomStreamer, transport)
