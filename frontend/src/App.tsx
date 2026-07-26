import { RandomStreamViewer } from '@/components/RandomStreamViewer'
import { useRandomStream } from '@/streaming/useRandomStream'
import './App.css'

function App() {
  const { status, chars, error, start, stop, reset } = useRandomStream()

  return (
    <div className="app">
      <div className="app__bg" aria-hidden="true" />
      <main className="app__main">
        <header className="app__header">
          <div className="app__brand">
            <span className="app__logo" aria-hidden="true">
              ⟴
            </span>
            <span className="app__brand-text">
              <strong>Random</strong>Stream
            </span>
          </div>
          <a
            className="app__link"
            href="https://connectrpc.com/"
            target="_blank"
            rel="noreferrer"
          >
            Powered by ConnectRPC
          </a>
        </header>

        <RandomStreamViewer
          status={status}
          chars={chars}
          error={error}
          onStart={start}
          onStop={stop}
          onReset={reset}
        />

        <footer className="app__footer">
          <span>
            Endpoint:{' '}
            <code>streaming.v1.RandomStreamer / StreamRandom</code>
          </span>
        </footer>
      </main>
    </div>
  )
}

export default App
