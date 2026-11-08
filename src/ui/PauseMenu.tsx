import type { GameHudSnapshot } from '../game/Game'

interface PauseMenuProps {
  hud: GameHudSnapshot
  onResume: () => void
  onOpenSettings: () => void
  onSwitchRole?: () => void
  onExit: () => void
}

export function PauseMenu({ hud, onResume, onOpenSettings, onSwitchRole, onExit }: PauseMenuProps) {
  const isSurvivor = hud.mode === 'survivor'

  return (
    <div className="pause-layer">
      <section className="pause-panel" role="dialog" aria-modal="true" aria-label="Pausa">
        <p className="eyebrow">Función suspendida</p>
        <h2>El carnaval espera</h2>
        <p className="pause-panel__lede">
          {isSurvivor
            ? `${hud.characterName} está inmóvil en el recinto. Nada avanza mientras la función está en pausa.`
            : 'La cámara permanece fija sobre el recinto. Los demás jugadores siguen en el servidor.'}
        </p>

        <div className="pause-actions">
          <button className="btn-primary" onClick={onResume} autoFocus>
            Reanudar <span className="key-hint">Esc</span>
          </button>
          <button className="btn-panel" onClick={onOpenSettings}>
            Ajustes
          </button>
          {onSwitchRole && (
            <button className="btn-panel" onClick={onSwitchRole}>
              Cambiar a {isSurvivor ? 'cámara aérea (asesino)' : 'primera persona (superviviente)'}
              <span className="key-hint">V</span>
            </button>
          )}
          <button className="btn-panel btn-panel--quiet" onClick={onExit}>
            {hud.online ? 'Salir de la sala' : 'Volver al menú principal'}
          </button>
        </div>

        <div className="pause-controls">
          <div>
            <h3>Superviviente</h3>
            <ul>
              <li><kbd>WASD</kbd> moverse</li>
              <li><kbd>Ratón</kbd> mirar</li>
              <li><kbd>Shift</kbd> correr</li>
              <li><kbd>Ctrl</kbd> / <kbd>C</kbd> agacharse</li>
            </ul>
          </div>
          <div>
            <h3>Asesino</h3>
            <ul>
              <li><kbd>Ratón</kbd> orbitar</li>
              <li><kbd>Rueda</kbd> zoom</li>
              <li><kbd>Alt</kbd> + ratón · foco</li>
              <li><kbd>R</kbd> recentrar</li>
            </ul>
          </div>
          <div>
            <h3>Depuración</h3>
            <ul>
              {!hud.online && <li><kbd>V</kbd> cambiar rol</li>}
              <li><kbd>F2</kbd> colliders</li>
              <li><kbd>F3</kbd> estadísticas</li>
              <li><kbd>Esc</kbd> pausa</li>
            </ul>
          </div>
        </div>

        <p className="pause-panel__foot">
          {hud.online
            ? `Sala ${hud.roomCode} · ${hud.networkPlayers} conectado(s) · ${hud.latencyMs} ms · servidor 60 Hz. Objetivos autoritativos; sin combate ni objetos todavía.`
            : 'Fase 3 · Entrenamiento local o salas privadas con generadores, energía y salidas. Sin combate ni objetos todavía.'}
          {' '}El estado real está en <code>docs/ESTADO_ACTUAL.md</code>.
        </p>
      </section>
    </div>
  )
}
