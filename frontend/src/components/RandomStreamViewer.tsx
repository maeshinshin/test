import { useEffect, useMemo, useRef } from 'react'
import type { StreamStatus, ReceivedChar } from '@/streaming/useRandomStream'

interface Props {
  status: StreamStatus
  chars: ReceivedChar[]
  error: string | null
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

const statusLabel: Record<StreamStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  streaming: 'Streaming',
  finished: 'Finished',
  error: 'Error',
  aborted: 'Stopped',
}

const statusClass: Record<StreamStatus, string> = {
  idle: 'status status--idle',
  connecting: 'status status--connecting',
  streaming: 'status status--streaming',
  finished: 'status status--finished',
  error: 'status status--error',
  aborted: 'status status--aborted',
}

export function RandomStreamViewer({
  status,
  chars,
  error,
  onStart,
  onStop,
  onReset,
}: Props) {
  const streamBoxRef = useRef<HTMLDivElement>(null)
  const tailRef = useRef<HTMLSpanElement>(null)

  // Auto-scroll the stream box to the tail while streaming.
  useEffect(() => {
    if (status !== 'streaming') return
    const el = streamBoxRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [chars, status])

  const { joined, lastSeq, lastAt, count } = useMemo(() => {
    const last = chars[chars.length - 1]
    return {
      joined: chars.map((c) => c.ch).join(''),
      lastSeq: last ? last.seq : null,
      lastAt: last ? last.emittedAt : null,
      count: chars.length,
    }
  }, [chars])

  const isActive = status === 'connecting' || status === 'streaming'

  return (
    <section className="viewer">
      <header className="viewer__header">
        <div className="viewer__title">
          <h2>Random Character Stream</h2>
          <p>
            Server streams a random character every ~200ms for up to one
            minute.
          </p>
        </div>
        <span className={statusClass[status]} data-testid="status">
          <span className="status__dot" aria-hidden="true" />
          {statusLabel[status]}
        </span>
      </header>

      <div className="viewer__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onStart}
          disabled={isActive}
        >
          ▶ Start stream
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onStop}
          disabled={!isActive}
        >
          ■ Stop
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onReset}
          disabled={isActive || (chars.length === 0 && !error)}
        >
          ↺ Reset
        </button>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="viewer__stats">
        <div className="stat">
          <span className="stat__label">Received</span>
          <span className="stat__value">{count.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Last seq</span>
          <span className="stat__value">
            {lastSeq !== null ? `#${lastSeq}` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Last emitted</span>
          <span className="stat__value stat__value--mono">
            {lastAt ?? '—'}
          </span>
        </div>
      </div>

      <div className="stream-box" ref={streamBoxRef} aria-live="polite">
        {chars.length === 0 ? (
          <div className="stream-box__empty">
            Press <kbd>Start stream</kbd> to begin receiving characters.
          </div>
        ) : (
          <span className="stream-box__content">
            {joined}
            <span ref={tailRef} className="stream-box__caret" aria-hidden="true">
              ▍
            </span>
          </span>
        )}
      </div>
    </section>
  )
}
