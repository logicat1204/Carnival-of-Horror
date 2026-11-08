import type { GameHudSnapshot } from '../game/Game'
import type { GameSettings } from '../shared/settings'

interface HudProps {
  hud: GameHudSnapshot
  settings: GameSettings
}

const HEALTH_LABEL: Record<GameHudSnapshot['health'], string> = {
  healthy: 'Sano',
  injured: 'Herido',
  incapacitated: 'Incapacitado',
  eliminated: 'Eliminado',
}

export function Hud({ hud, settings }: HudProps) {
  const isSurvivor = hud.mode === 'survivor'

  return (
    <div className="hud" aria-live="polite">
      <div className="hud__vignette" aria-hidden="true" />
      <div className="hud__grain" aria-hidden="true" />

      <header className="hud__top">
        <div className="hud-id">
          <span className={`hud-id__role ${isSurvivor ? 'is-survivor' : 'is-killer'}`}>
            {isSurvivor ? 'Superviviente' : 'Asesino'}
          </span>
          <div className="hud-id__name">
            <strong>{isSurvivor ? hud.characterName : hud.killerName}</strong>
            <span>{isSurvivor ? hud.profession : 'Cámara táctica · prototipo Fase 3'}</span>
          </div>
        </div>

        <div className="hud__center">
          <span className="hud-map">{hud.mapName}</span>
          <span className="hud-phase">
            {hud.online ? `SALA ${hud.roomCode} · EN LÍNEA` : 'ENTRENAMIENTO LOCAL · FASE 3'}
          </span>
        </div>

        <div className="hud__status">
          {isSurvivor ? (
            <span className={`health-chip health-${hud.health}`}>
              <span className="health-chip__dot" />
              {HEALTH_LABEL[hud.health]}
            </span>
          ) : (
            <span className="health-chip health-killer">
              <span className="health-chip__dot" />
              {hud.cameraMode === 'aerial' ? 'En el aire' : 'En tierra'}
            </span>
          )}
          <span className="hud__esc">ESC pausa</span>
        </div>
      </header>

      {isSurvivor ? (
        <>
          <div className="crosshair" aria-hidden="true">
            <span className="crosshair__dot" />
            <span className="crosshair__ring" />
          </div>
          <div className="survivor-objective">
            <div className="objective-head">
              <p className="eyebrow">Objetivo de fase</p>
              <span className={`objective-energy ${hud.objective.powered ? 'is-powered' : ''}`}>
                {hud.objective.powered ? 'ENERGÍA ACTIVA' : 'SIN ENERGÍA'}
              </span>
            </div>
            <div className="objective-line">
              <span>Generadores</span>
              <strong>
                {hud.objective.repairedCount}/{hud.objective.requiredGenerators}
              </strong>
            </div>
            <div className="generator-pips" aria-label="Estado de los generadores">
              {hud.objective.generators.map((generator) => (
                <span
                  key={generator.id}
                  className={[
                    'generator-pip',
                    generator.repaired ? 'is-repaired' : '',
                    !generator.repaired && generator.progress > 0 ? 'is-progress' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={`${generator.label}: ${Math.round(generator.progress * 100)}%`}
                >
                  <i style={{ width: `${generator.progress * 100}%` }} />
                </span>
              ))}
            </div>
            <div className="objective-line objective-line--meta">
              <span>{formatDuration(hud.objective.timeRemainingMs)} restantes</span>
              <span>
                {hud.objective.gates.some((gate) => gate.open)
                  ? 'Salida abierta'
                  : hud.objective.powered
                    ? 'Busca una salida'
                    : `Repara ${Math.max(0, hud.objective.requiredGenerators - hud.objective.repairedCount)} más`}
              </span>
            </div>

            {hud.interactionTarget && (
              <div className={`interaction-prompt ${hud.interactionActive ? 'is-active' : ''}`}>
                <kbd>E</kbd>
                <div>
                  <strong>
                    {hud.interactionTarget.kind === 'generator' ? 'Reparar' : 'Abrir'}{' '}
                    {hud.interactionTarget.label}
                  </strong>
                  <span>
                    {hud.interactionActive
                      ? `${Math.round(hud.interactionTarget.progress * 100)}%`
                      : 'Mantén E para interactuar'}
                  </span>
                  <div className="interaction-prompt__bar">
                    <i style={{ width: `${hud.interactionTarget.progress * 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            <div className="survivor-objective__stats">
              <span>{hud.speed.toFixed(1)} m/s</span>
              <span>{hud.crouching ? 'Agachado' : hud.sprinting ? 'Corriendo' : 'Caminando'}</span>
              <span>{hud.online ? `${hud.latencyMs} ms` : `${Math.round(hud.cameraFov)}° FOV`}</span>
            </div>
          </div>
        </>
      ) : (
        <aside className="tactical-panel">
          <div className="tactical-panel__head">
            <span className="eyebrow">Vista táctica</span>
            <span className="bearing">{hud.aerialBearing}</span>
          </div>
          <div className="tactical-grid">
            <div>
              <span>Altitud</span>
              <strong>{hud.cameraHeight.toFixed(0)} m</strong>
            </div>
            <div>
              <span>Ángulo</span>
              <strong>{hud.aerialElevation.toFixed(0)}°</strong>
            </div>
            <div>
              <span>Foco</span>
              <strong>{hud.focusX.toFixed(0)}, {hud.focusZ.toFixed(0)}</strong>
            </div>
            <div>
              <span>Paneo</span>
              <strong>{hud.panDistance.toFixed(1)} / 15 m</strong>
            </div>
          </div>
          <div className={`noise-meter ${hud.noisePings > 0 ? 'is-live' : ''}`}>
            <span className="noise-meter__pulse" />
            <span>
              <strong>{hud.noisePings > 0 ? 'Ruido detectado' : 'Sin señales de ruido'}</strong>
              <small>
                {hud.noisePings > 0
                  ? `${hud.noisePings} pulso(s) aproximado(s) — no es la posición exacta`
                  : 'Correr y fallar reparaciones delatará posiciones aproximadas'}
              </small>
            </span>
          </div>
          <div className="tactical-objective">
            <div>
              <span className="eyebrow">Presión de objetivos</span>
              <strong>
                {hud.objective.repairedCount}/{hud.objective.requiredGenerators} generadores
              </strong>
            </div>
            <div className="generator-pips" aria-label="Estado de los generadores">
              {hud.objective.generators.map((generator) => (
                <span
                  key={generator.id}
                  className={[
                    'generator-pip',
                    generator.repaired ? 'is-repaired' : '',
                    !generator.repaired && generator.progress > 0 ? 'is-progress' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <i style={{ width: `${generator.progress * 100}%` }} />
                </span>
              ))}
            </div>
            <small>
              {hud.objective.powered ? 'Salidas con energía' : 'Sin energía en las salidas'} ·{' '}
              {formatDuration(hud.objective.timeRemainingMs)} restantes
            </small>
          </div>
          <p className="tactical-panel__hint">
            Los techos se aclaran solo al bloquear el foco. Los supervivientes tras muros no se
            revelan.
          </p>
          <p className="tactical-panel__bots">
            {hud.online
              ? `${hud.networkPlayers} jugador(es) reales · ${hud.latencyMs} ms · sala ${hud.roomCode}`
              : `${hud.bots} bots de prueba · sin red`}
          </p>
        </aside>
      )}

      {hud.debugVisible && <DebugPanel hud={hud} settings={settings} />}

      {hud.collidersVisible && <div className="debug-flag">F2 · COLLIDERS VISIBLES</div>}

      <footer className="hud__bottom">
        <div className="controls-hint">
          {isSurvivor ? (
            <>
              <span><kbd>WASD</kbd> mover</span>
              <span><kbd>Shift</kbd> correr</span>
              <span><kbd>Ctrl</kbd> agacharse</span>
              <span><kbd>E</kbd> interactuar</span>
            </>
          ) : (
            <>
              <span><kbd>WASD</kbd> mover</span>
              <span><kbd>Rueda</kbd> zoom</span>
              <span><kbd>Alt</kbd> + ratón · foco</span>
              <span><kbd>R</kbd> recentrar</span>
            </>
          )}
          {!hud.online && <span><kbd>V</kbd> cambiar rol</span>}
          <span><kbd>F3</kbd> debug</span>
        </div>
        <div className="session-clock">
          <span className="rec-dot" /> {hud.online ? `SALA ${hud.roomCode}` : 'SESIÓN'} {formatTime(hud.elapsed)}
        </div>
      </footer>
    </div>
  )
}

function DebugPanel({ hud, settings }: { hud: GameHudSnapshot; settings: GameSettings }) {
  return (
    <aside className="debug-panel" aria-label="Panel de depuración">
      <div className="debug-panel__head">
        <span>DEBUG · F3</span>
        <span className="debug-panel__live">EN VIVO</span>
      </div>
      <dl>
        <div><dt>FPS</dt><dd>{hud.fps.toFixed(0)}</dd></div>
        <div><dt>Frame</dt><dd>{hud.frameMs.toFixed(2)} ms</dd></div>
        <div><dt>Tick</dt><dd>{hud.tick}</dd></div>
        <div><dt>Rol</dt><dd>{hud.mode}</dd></div>
        <div><dt>Posición</dt><dd>{hud.x.toFixed(1)}, {hud.z.toFixed(1)}</dd></div>
        <div><dt>Velocidad</dt><dd>{hud.speed.toFixed(2)} m/s</dd></div>
        <div><dt>Cámara</dt><dd>{hud.cameraMode}</dd></div>
        <div><dt>Altura</dt><dd>{hud.cameraHeight.toFixed(1)} m</dd></div>
        <div><dt>Colliders</dt><dd>{hud.colliderCount}</dd></div>
        <div><dt>Draw calls</dt><dd>{hud.drawCalls}</dd></div>
        <div><dt>Triángulos</dt><dd>{formatNumber(hud.triangles)}</dd></div>
        <div><dt>Calidad</dt><dd>{settings.quality}</dd></div>
        <div><dt>Bots</dt><dd>{hud.bots}</dd></div>
        <div><dt>Ruido</dt><dd>{hud.noisePings}</dd></div>
        {hud.online && (
          <>
            <div><dt>Red</dt><dd>{hud.networkStatus}</dd></div>
            <div><dt>Jugadores</dt><dd>{hud.networkPlayers}</dd></div>
            <div><dt>Latencia</dt><dd>{hud.latencyMs} ms</dd></div>
            <div><dt>Servidor</dt><dd>tick {hud.serverTick}</dd></div>
          </>
        )}
        <div><dt>F2</dt><dd>{hud.collidersVisible ? 'ON' : 'OFF'}</dd></div>
        <div><dt>Puntero</dt><dd>{hud.pointerLocked ? 'capturado' : 'libre'}</dd></div>
      </dl>
      <p>Simulación fija 60 Hz · Render interpolado</p>
    </aside>
  )
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`
}

function formatDuration(milliseconds: number): string {
  return formatTime(milliseconds / 1000)
}

function formatNumber(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
}
