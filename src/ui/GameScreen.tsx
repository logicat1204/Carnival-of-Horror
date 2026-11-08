import { useEffect, useRef, useState } from 'react'
import { Game, type GameHudSnapshot, type GameNetworkSession } from '../game/Game'
import type { PlayerRole } from '../shared/net/contracts'
import type { GameSettings } from '../shared/settings'
import { Hud } from './Hud'
import { PauseMenu } from './PauseMenu'
import { SettingsPanel } from './SettingsPanel'

interface GameScreenProps {
  role: PlayerRole
  characterId: string
  settings: GameSettings
  network?: GameNetworkSession
  onSettingsChange: (settings: GameSettings) => void
  onExit: () => void
}

export function GameScreen({
  role,
  characterId,
  settings,
  network,
  onSettingsChange,
  onExit,
}: GameScreenProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const initialSettings = useRef(settings).current

  const [hud, setHud] = useState<GameHudSnapshot | null>(null)
  const [paused, setPaused] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let frame = 0
    frame = requestAnimationFrame(() => {
      if (cancelled || !mountRef.current) return
      try {
        const game = new Game({
          container: mountRef.current,
          role,
          characterId,
          settings: initialSettings,
          mapId: 'carnival',
          network,
          onHud: setHud,
          onPauseChange: setPaused,
          onPointerLockChange: setLocked,
          onReady: () => {
            setLoading(false)
            gameRef.current?.updateSettings(settingsRef.current)
          },
          onError: (message) => setToast(message),
        })
        gameRef.current = game
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason)
        setError(message)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      gameRef.current?.destroy()
      gameRef.current = null
    }
  }, [role, characterId, initialSettings, network])

  useEffect(() => {
    gameRef.current?.updateSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const capturePointer = async () => {
    const game = gameRef.current
    if (!game) return
    setToast(null)
    try {
      await game.requestPointerLock()
    } catch {
      setToast('El navegador bloqueó la captura del ratón. Vuelve a hacer clic para intentarlo.')
    }
    void game.startAudio().catch(() => {
      setToast('El audio no pudo iniciarse. El juego continúa sin sonido.')
    })
  }

  const resume = () => {
    const game = gameRef.current
    if (!game) return
    game.resume()
    void game.startAudio().catch(() => {
      setToast('El audio no pudo reanudarse. El juego continúa sin sonido.')
    })
  }

  const exit = () => {
    gameRef.current?.pause()
    onExit()
  }

  return (
    <div className="game-shell">
      <div className="game-canvas-host" ref={mountRef} />

      {!loading && !error && hud && <Hud hud={hud} settings={settings} />}

      {loading && !error && (
        <div className="loading-layer">
          <div className="loading-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">Montando el recinto</p>
          <h1>Carnival <em>of…</em></h1>
          <p>Geometría low-poly · colliders · niebla · iluminación</p>
          <div className="loading-bar"><span /></div>
          <small>La primera carga compila la escena procedural. No se descargan modelos externos.</small>
        </div>
      )}

      {error && (
        <div className="error-layer">
          <p className="eyebrow">El recinto no pudo abrirse</p>
          <h1>Error de arranque</h1>
          <pre>{error}</pre>
          <p>
            Comprueba que el navegador soporta WebGL 2 y que estás ejecutando el proyecto con
            <code> npm run dev</code>.
          </p>
          <button className="btn-primary" onClick={onExit}>Volver al menú</button>
        </div>
      )}

      {!loading && !error && !paused && !locked && !hud?.matchResult && (
        <div className="capture-layer">
          <div className="capture-card">
            <p className="eyebrow">
              {hud?.online ? `Sala ${hud.roomCode} · red autoritativa` : 'Modo entrenamiento local'}
            </p>
            <h2>{hud?.online ? 'La función ha comenzado' : 'El recinto está abierto'}</h2>
            <p>
              {hud?.online
                ? 'Pulsa para capturar el ratón y activar el audio. Tu movimiento se predice aquí y el servidor valida posición, colisiones y velocidad.'
                : 'Pulsa para capturar el ratón y activar el audio. La simulación ya está corriendo detrás de esta capa.'}
            </p>
            <div className="capture-controls">
              <span><kbd>WASD</kbd> mover</span>
              <span><kbd>Ratón</kbd> mirar / orbitar</span>
              <span><kbd>E</kbd> interactuar</span>
              {!hud?.online && <span><kbd>V</kbd> cambiar rol</span>}
              <span><kbd>Esc</kbd> pausa</span>
            </div>
            <button className="btn-primary" onClick={capturePointer}>
              Capturar ratón y entrar
            </button>
            <small>
              {hud?.online
                ? `Servidor 60 Hz · snapshots 20 Hz · ${hud.networkPlayers} jugador(es) conectado(s).`
                : 'El navegador exige un clic para el puntero y el audio.'}
            </small>
          </div>
        </div>
      )}

      {!loading && !error && hud?.online && hud.networkStatus !== 'connected' && (
        <div className={`network-layer network-layer--${hud.networkStatus}`} role="status">
          <div>
            <span className="net-dot" />
            <strong>
              {hud.networkStatus === 'reconnecting' ? 'Reconectando con la sala…' : 'Conexión perdida'}
            </strong>
            <p>
              {hud.networkStatus === 'reconnecting'
                ? 'El servidor conserva tu plaza durante 25 segundos. La partida sigue en el servidor.'
                : 'No se pudo recuperar la sesión. Vuelve al menú para crear otra sala.'}
            </p>
          </div>
          {hud.networkStatus === 'closed' && (
            <button className="btn-ghost" onClick={exit}>Volver al menú</button>
          )}
        </div>
      )}

      {!loading && !error && hud?.matchResult && (
        <MatchEndOverlay hud={hud} onExit={exit} />
      )}

      {!loading && !error && paused && hud && !settingsOpen && !hud.matchResult && (
        <PauseMenu
          hud={hud}
          onResume={resume}
          onOpenSettings={() => setSettingsOpen(true)}
          onSwitchRole={hud.online ? undefined : () => gameRef.current?.switchMode()}
          onExit={exit}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={onSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Cerrar aviso" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  )
}

function MatchEndOverlay({
  hud,
  onExit,
}: {
  hud: GameHudSnapshot
  onExit: () => void
}) {
  const result = hud.matchResult
  if (!result) return null
  const survivorsWon = result.winner === 'survivors'
  const roleWon =
    (hud.mode === 'survivor' && survivorsWon) || (hud.mode === 'killer' && !survivorsWon)
  const elapsedSeconds = Math.max(0, Math.round(result.elapsedMs / 1000))

  return (
    <div className="match-end-layer" role="dialog" aria-modal="true" aria-label="Fin de la partida">
      <div className={`match-end-card ${roleWon ? 'is-win' : 'is-loss'}`}>
        <p className="eyebrow">Partida finalizada</p>
        <h1>{survivorsWon ? 'La salida se abrió' : 'El recinto se cerró'}</h1>
        <p className="match-end-card__lede">
          {result.reason === 'escaped'
            ? `${result.escapedSurvivors} superviviente(s) cruzaron la salida antes de que el asesino pudiera detenerlos.`
            : 'El tiempo se agotó y ningún superviviente logró cruzar una salida.'}
        </p>
        <div className="match-end-card__stats">
          <div>
            <span>Resultado</span>
            <strong>{roleWon ? 'Victoria' : 'Derrota'}</strong>
          </div>
          <div>
            <span>Generadores</span>
            <strong>
              {hud.objective.repairedCount}/{hud.objective.requiredGenerators}
            </strong>
          </div>
          <div>
            <span>Duración</span>
            <strong>
              {Math.floor(elapsedSeconds / 60)
                .toString()
                .padStart(2, '0')}
              :
              {(elapsedSeconds % 60).toString().padStart(2, '0')}
            </strong>
          </div>
        </div>
        <button className="btn-primary" onClick={onExit}>
          Volver al menú
        </button>
      </div>
    </div>
  )
}
