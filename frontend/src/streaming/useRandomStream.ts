import { useCallback, useEffect, useRef, useState } from 'react'
import { create } from '@bufbuild/protobuf'
import type { RandomChar } from '@gen/proto/streaming/v1/streaming_pb'
import { StartRequestSchema } from '@gen/proto/streaming/v1/streaming_pb'
import { randomStreamerClient } from './client'

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'finished'
  | 'error'
  | 'aborted'

export interface ReceivedChar {
  seq: number
  ch: string
  emittedAt: string
}

export interface UseRandomStreamResult {
  status: StreamStatus
  chars: ReceivedChar[]
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

const MAX_BUFFER = 50_000

export function useRandomStream(): UseRandomStreamResult {
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [chars, setChars] = useState<ReceivedChar[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setChars([])
    setError(null)
    setStatus('idle')
  }, [])

  const start = useCallback(() => {
    // If a stream is already in progress, ignore.
    if (abortRef.current) return

    setChars([])
    setError(null)
    setStatus('connecting')

    const controller = new AbortController()
    abortRef.current = controller

    const req = create(StartRequestSchema)

    void (async () => {
      try {
        const responses = randomStreamerClient.streamRandom(req, {
          signal: controller.signal,
        })
        setStatus('streaming')
        for await (const res of responses) {
          if (controller.signal.aborted) break
          appendChar(setChars, res as RandomChar)
        }
        if (controller.signal.aborted) {
          setStatus('aborted')
        } else {
          setStatus('finished')
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus('aborted')
        } else {
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
          setStatus('error')
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    })()
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  return { status, chars, error, start, stop, reset }
}

function appendChar(
  setChars: React.Dispatch<React.SetStateAction<ReceivedChar[]>>,
  msg: RandomChar,
) {
  setChars((prev) => {
    const next: ReceivedChar = {
      seq: typeof msg.seq === 'bigint' ? Number(msg.seq) : Number(msg.seq),
      ch: msg.ch,
      emittedAt: msg.emittedAt,
    }
    const updated = prev.length >= MAX_BUFFER ? prev.slice(1) : prev
    return [...updated, next]
  })
}
