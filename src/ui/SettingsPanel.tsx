import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type GameSettings,
  type QualityLevel,
} from '../shared/settings'
import { Modal } from './Modal'

interface SettingsPanelProps {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
  onClose: () => void
}

const QUALITY_OPTIONS: Array<{ value: QualityLevel; label: string; hint: string }> = [
  { value: 'low', label: 'Bajo', hint: 'Sin sombras · 1x píxel' },
  { value: 'medium', label: 'Medio', hint: 'Sombras 1K · 1.5x' },
  { value: 'high', label: 'Alto', hint: 'Sombras 2K · 2x' },
]

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const patch = (partial: Partial<GameSettings>) => onChange(normalizeSettings({ ...settings, ...partial }))

  return (
    <Modal eyebrow="Configuración local" title="Ajustes de la función" onClose={onClose} wide>
      <div className="settings-grid">
        <div className="setting">
          <div className="setting__head">
            <label htmlFor="sensitivity">Sensibilidad del ratón</label>
            <output>{settings.sensitivity.toFixed(2)}×</output>
          </div>
          <input
            id="sensitivity"
            type="range"
            min="0.2"
            max="2.5"
            step="0.05"
            value={settings.sensitivity}
            onChange={(event) => patch({ sensitivity: Number(event.target.value) })}
          />
          <p className="setting__hint">Se aplica a la vista en primera persona y a la cámara aérea.</p>
        </div>

        <div className="setting">
          <div className="setting__head">
            <label htmlFor="fov">Campo de visión (superviviente)</label>
            <output>{Math.round(settings.fov)}°</output>
          </div>
          <input
            id="fov"
            type="range"
            min="62"
            max="96"
            step="1"
            value={settings.fov}
            onChange={(event) => patch({ fov: Number(event.target.value) })}
          />
          <p className="setting__hint">La cámara del asesino mantiene su propio ángulo táctico.</p>
        </div>

        <div className="setting">
          <div className="setting__head">
            <label htmlFor="volume">Volumen general</label>
            <output>{Math.round(settings.masterVolume * 100)}%</output>
          </div>
          <input
            id="volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.masterVolume}
            onChange={(event) => patch({ masterVolume: Number(event.target.value) })}
          />
          <p className="setting__hint">Ambiente, pasos y campanas lejanas son procedurales.</p>
        </div>

        <div className="setting">
          <span className="setting__label">Calidad gráfica</span>
          <div className="segmented" role="group" aria-label="Calidad gráfica">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={settings.quality === option.value ? 'is-active' : ''}
                aria-pressed={settings.quality === option.value}
                onClick={() => patch({ quality: option.value })}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.invertY}
            onChange={(event) => patch({ invertY: event.target.checked })}
          />
          <span className="toggle__track" aria-hidden="true" />
          <span>
            <strong>Invertir eje vertical</strong>
            <small>Aplica a ambas cámaras.</small>
          </span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(event) => patch({ reduceMotion: event.target.checked })}
          />
          <span className="toggle__track" aria-hidden="true" />
          <span>
            <strong>Reducir movimiento</strong>
            <small>Desactiva balanceo de cámara y manos.</small>
          </span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showDebugOnStart}
            onChange={(event) => patch({ showDebugOnStart: event.target.checked })}
          />
          <span className="toggle__track" aria-hidden="true" />
          <span>
            <strong>Mostrar depuración al iniciar</strong>
            <small>También puedes alternarla con F3.</small>
          </span>
        </label>
      </div>

      <div className="settings-footer">
        <p>Los ajustes se guardan en este navegador. F2 muestra los colliders.</p>
        <button className="btn-ghost btn-ghost--small" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
          Restablecer
        </button>
      </div>
    </Modal>
  )
}
