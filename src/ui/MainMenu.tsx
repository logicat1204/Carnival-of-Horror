import { useState } from 'react'
import type { PlayerRole } from '../shared/net/contracts'
import {
  KILLER_STUB,
  SURVIVORS,
  getSurvivor,
  type SurvivorCharacter,
} from '../shared/characters'
import type { GameSettings } from '../shared/settings'
import { HelpDialog } from './HelpDialog'
import { SettingsPanel } from './SettingsPanel'
import { StatBars } from './StatBars'

interface MainMenuProps {
  settings: GameSettings
  initialRole: PlayerRole
  initialCharacterId: string
  onSettingsChange: (settings: GameSettings) => void
  onStart: (role: PlayerRole, characterId: string) => void
  onOpenOnline: () => void
}

type MenuModal = 'settings' | 'help' | null

export function MainMenu({
  settings,
  initialRole,
  initialCharacterId,
  onSettingsChange,
  onStart,
  onOpenOnline,
}: MainMenuProps) {
  const [role, setRole] = useState<PlayerRole>(initialRole)
  const [characterId, setCharacterId] = useState(initialCharacterId)
  const [modal, setModal] = useState<MenuModal>(null)
  const selected = getSurvivor(characterId)

  return (
    <div className="menu">
      <MenuAtmosphere />
      <header className="menu__topbar">
        <div className="brand-lockup" aria-label="Carnival of">
          <span className="brand-lockup__mark">C</span>
          <span>
            <strong>Carnival</strong>
            <em>of…</em>
          </span>
        </div>
        <span className="phase-pill">FASE 3 · OBJETIVOS AUTORITATIVOS</span>
        <nav className="menu__nav" aria-label="Menú principal">
          <button className="nav-link" onClick={() => setModal('help')}>
            Cómo se juega
          </button>
          <button className="nav-link" onClick={() => setModal('settings')}>
            Ajustes
          </button>
          <button className="nav-link" onClick={onOpenOnline}>
            Salas <span className="mini-tag">Online</span>
          </button>
        </nav>
      </header>

      <main className="menu__grid">
        <section className="hero">
          <div className="hero__eyebrow">
            <span className="rule" />
            <span>Una función en cuatro actos</span>
          </div>
          <h1 className="hero__title">
            <span>Carnival</span>
            <em>of…</em>
          </h1>
          <p className="hero__lede">
            Cuatro supervivientes buscan una salida. Un anfitrión los observa desde arriba.
            El carnaval no ha cerrado: solo está esperando público.
          </p>

          <dl className="hero__facts">
            <div>
              <dt>1 v 4</dt>
              <dd>Asesino contra supervivientes</dd>
            </div>
            <div>
              <dt>FPS / Aérea</dt>
              <dd>Dos perspectivas, un solo mundo 3D</dd>
            </div>
            <div>
              <dt>Fase 3</dt>
              <dd>Generadores, energía, salidas y fin de partida</dd>
            </div>
          </dl>

          <div className="hero__actions">
            <button className="btn-primary" onClick={() => onStart(role, characterId)}>
              <span>{role === 'survivor' ? 'Entrar al recinto' : 'Observar desde arriba'}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </button>
            <button
              className="btn-ghost"
              onClick={onOpenOnline}
              title="Crea una sala privada 1v4 o únete con un código."
            >
              Sala privada <span className="mini-tag">Online</span>
            </button>
          </div>

          <p className="hero__note">
            <span className="dot" /> Entrenamiento local con 4 bots de prueba, o salas privadas 1v4
            con servidor autoritativo. Repara generadores, abre una salida y escapa antes de que se
            agote el tiempo. Sin combate ni eliminación todavía.
          </p>

          <div className="ticket-stub" aria-hidden="true">
            <span>ADMISIÓN</span>
            <strong>UNA NOCHE</strong>
            <span>NO REEMBOLSABLE</span>
          </div>
        </section>

        <section className="casting" aria-label="Selección de rol y personaje">
          <div className="role-switch" role="tablist" aria-label="Elige tu papel">
            <button
              role="tab"
              aria-selected={role === 'survivor'}
              className={role === 'survivor' ? 'is-active' : ''}
              onClick={() => setRole('survivor')}
            >
              <SurvivorIcon />
              <span>
                <strong>Superviviente</strong>
                <small>Primera persona</small>
              </span>
            </button>
            <button
              role="tab"
              aria-selected={role === 'killer'}
              className={role === 'killer' ? 'is-active' : ''}
              onClick={() => setRole('killer')}
            >
              <KillerIcon />
              <span>
                <strong>Asesino</strong>
                <small>Cámara aérea</small>
              </span>
            </button>
          </div>

          {role === 'survivor' ? (
            <>
              <div className="casting__head">
                <div>
                  <p className="eyebrow">Reparto disponible</p>
                  <h2>Elige superviviente</h2>
                </div>
                <span className="count-tag">{SURVIVORS.length} perfiles</span>
              </div>
              <div className="character-grid">
                {SURVIVORS.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    selected={character.id === selected.id}
                    onSelect={() => setCharacterId(character.id)}
                  />
                ))}
              </div>
              <div className="selection-brief">
                <div>
                  <span className="selection-brief__name">
                    {selected.name} <em>{selected.surname}</em>
                  </span>
                  <span className="selection-brief__prof">{selected.profession}</span>
                </div>
                <p>{selected.playstyle}</p>
                <p className="selection-brief__bio">{selected.bio}</p>
              </div>
            </>
          ) : (
            <div className="killer-casting">
              <div className="casting__head">
                <div>
                  <p className="eyebrow">Prototipo de cámara</p>
                  <h2>El anfitrión</h2>
                </div>
                <span className="count-tag">Fase 4: arquetipos</span>
              </div>
              <div className="killer-card">
                <KillerPortrait />
                <div className="killer-card__copy">
                  <h3>{KILLER_STUB.name}</h3>
                  <p className="killer-card__title">{KILLER_STUB.title}</p>
                  <p>{KILLER_STUB.description}</p>
                </div>
              </div>
              <ul className="feature-list">
                <li><span>01</span>Cámara orbital con altura, ángulo y zoom configurables.</li>
                <li><span>02</span>Paneo de foco limitado a 15 m alrededor del asesino.</li>
                <li><span>03</span>Techos y toldos translúcidos solo al bloquear el foco.</li>
                <li><span>04</span>Anillos de ruido aproximado; nunca posiciones exactas.</li>
              </ul>
              <p className="honesty-note">
                Las habilidades del Acechador, Cazador y Trampero no están en esta fase. La cámara
                aérea y el cuerpo del asesino sí son jugables y colisionan con el escenario.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="menu__footer">
        <span>v0.3.0 · Fase 3 · Motor Three.js + simulación autoritativa a 60 Hz</span>
        <span className="footer-sep" />
        <span>WASD · Ratón · Shift · Ctrl · V · F2 · F3 · Esc</span>
        <span className="footer-sep" />
        <span>Documentación persistente en <code>docs/</code></span>
      </footer>

      {modal === 'settings' && (
        <SettingsPanel
          settings={settings}
          onChange={onSettingsChange}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'help' && <HelpDialog onClose={() => setModal(null)} />}
    </div>
  )
}

function CharacterCard({
  character,
  selected,
  onSelect,
}: {
  character: SurvivorCharacter
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`character-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${character.name} ${character.surname}, ${character.profession}`}
    >
      <CharacterPortrait character={character} />
      <span className="character-card__body">
        <span className="character-card__top">
          <span className="character-card__name">{character.name}</span>
          <span className="character-card__age">{character.age}</span>
        </span>
        <span className="character-card__prof">{character.profession}</span>
        <StatBars stats={character.stats} compact />
      </span>
      <span className="character-card__check" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" /></svg>
      </span>
    </button>
  )
}

function CharacterPortrait({ character }: { character: SurvivorCharacter }) {
  const { palette, build } = character
  const gradientId = `portrait-${character.id}`
  const shoulder = 44 + build.shoulders * 16

  return (
    <span className="portrait">
      <svg viewBox="0 0 120 150" aria-hidden="true">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#07060a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="120" height="150" fill={`url(#${gradientId})`} />
        <path
          d={`M${60 - shoulder} 150 C${60 - shoulder + 4} 112 ${60 - 24} 99 60 99 C${60 + 24} 99 ${60 + shoulder - 4} 112 ${60 + shoulder} 150 Z`}
          fill={palette.primary}
        />
        <path d="M42 108 L52 150 L60 128 L68 150 L78 108 L60 99 Z" fill={palette.secondary} opacity="0.85" />
        <path d="M50 106 L60 124 L70 106 L64 101 L56 101 Z" fill={palette.accent} />
        <rect x="53" y="86" width="14" height="17" rx="4" fill={palette.skin} />
        <ellipse cx="60" cy="69" rx="17" ry="21" fill={palette.skin} />
        <ellipse cx="54" cy="69" rx="1.6" ry="2" fill="#151012" />
        <ellipse cx="66" cy="69" rx="1.6" ry="2" fill="#151012" />
        <path d="M55 78 Q60 81 65 78" stroke="#5d372e" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {build.hairStyle === 'long' && (
          <>
            <path d="M41 67 Q40 40 60 39 Q80 40 79 67 L76 100 Q70 92 71 74 L49 74 Q50 92 44 100 Z" fill={palette.hair} />
            <path d="M44 58 Q48 43 60 43 Q72 43 76 58 Q70 50 60 50 Q50 50 44 58Z" fill={palette.hair} />
          </>
        )}
        {build.hairStyle === 'curly' && (
          <g fill={palette.hair}>
            {[44, 50, 56, 62, 68, 74, 78].map((cx, index) => (
              <circle key={cx} cx={cx} cy={47 + (index % 2) * 5} r={9} />
            ))}
            <circle cx="42" cy="60" r="7" />
            <circle cx="78" cy="60" r="7" />
          </g>
        )}
        {build.hairStyle === 'bun' && (
          <>
            <path d="M43 63 Q43 42 60 41 Q77 42 77 63 Q71 53 60 53 Q49 53 43 63Z" fill={palette.hair} />
            <circle cx="60" cy="37" r="9" fill={palette.hair} />
          </>
        )}
        {build.hairStyle === 'short' && (
          <path d="M43 64 Q43 42 60 41 Q77 42 77 64 Q71 50 60 50 Q49 50 43 64Z" fill={palette.hair} />
        )}
        {build.hairStyle === 'buzz' && (
          <path d="M44 60 Q46 43 60 42 Q74 43 76 60 Q70 50 60 50 Q50 50 44 60Z" fill={palette.hair} opacity="0.85" />
        )}
        {build.accessories.includes('glasses') && (
          <g fill="none" stroke="#17120f" strokeWidth="1.6">
            <rect x="47" y="65" width="10" height="7" rx="2" />
            <rect x="63" y="65" width="10" height="7" rx="2" />
            <path d="M57 68h6" />
          </g>
        )}
        {build.accessories.includes('headphones') && (
          <g>
            <path d="M43 65 Q44 44 60 44 Q76 44 77 65" fill="none" stroke="#2a2520" strokeWidth="3.2" />
            <rect x="38" y="61" width="8" height="13" rx="3" fill="#2a2520" />
            <rect x="74" y="61" width="8" height="13" rx="3" fill="#2a2520" />
          </g>
        )}
        {build.accessories.includes('bandana') && (
          <path d="M42 56 Q60 48 78 56 L77 63 Q60 56 43 63 Z" fill={palette.accent} />
        )}
        {build.accessories.includes('cap') && (
          <>
            <path d="M44 54 Q47 38 60 38 Q73 38 76 54 Z" fill={palette.accent} />
            <path d="M43 54 Q60 49 80 55 L78 61 Q60 55 43 60 Z" fill={palette.accent} />
          </>
        )}
        <path d="M48 104 Q60 110 72 104" stroke={palette.accent} strokeWidth="2" fill="none" opacity="0.7" />
        <rect x="0" y="0" width="120" height="150" fill="none" stroke="rgba(255,255,255,0.05)" />
      </svg>
    </span>
  )
}

function KillerPortrait() {
  return (
    <span className="portrait portrait--killer">
      <svg viewBox="0 0 120 150" aria-hidden="true">
        <rect width="120" height="150" fill="url(#killer-glow)" />
        <defs>
          <radialGradient id="killer-glow" cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#8c1c2b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#07060a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M22 150 C24 112 40 98 60 98 C80 98 96 112 98 150Z" fill="#20141b" />
        <path d="M48 99 L60 124 L72 99 L66 94 L54 94Z" fill="#3a1720" />
        <rect x="52" y="82" width="16" height="18" rx="4" fill="#d8c9b0" />
        <ellipse cx="60" cy="66" rx="18" ry="23" fill="#d8c9b0" />
        <path d="M48 63 Q53 58 57 63" stroke="#0d0b0e" strokeWidth="3" fill="none" />
        <path d="M63 63 Q67 58 72 63" stroke="#0d0b0e" strokeWidth="3" fill="none" />
        <path d="M52 77 Q60 73 68 77" stroke="#6b1a27" strokeWidth="2.5" fill="none" />
        <path d="M45 50 Q60 35 75 50 L74 55 Q60 47 46 55Z" fill="#0d0b0e" />
        <ellipse cx="60" cy="43" rx="26" ry="5" fill="#0d0b0e" />
        <path d="M49 42 Q60 20 71 42Z" fill="#0d0b0e" />
        <path d="M46 70 L52 72 M68 72 L74 70" stroke="#8f8272" strokeWidth="1" opacity="0.7" />
        <path d="M50 84 Q60 90 70 84" stroke="#e0b15c" strokeWidth="1.2" fill="none" opacity="0.5" />
      </svg>
    </span>
  )
}

function MenuAtmosphere() {
  return (
    <div className="menu__atmosphere" aria-hidden="true">
      <div className="menu__glow" />
      <svg className="menu__skyline" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <g className="skyline-ferris" transform="translate(1240 300)">
          <circle r="180" fill="none" stroke="#2a1c24" strokeWidth="2" />
          <circle r="150" fill="none" stroke="#241820" strokeWidth="1" />
          {Array.from({ length: 16 }).map((_, index) => {
            const angle = (index / 16) * Math.PI * 2
            return (
              <line
                key={index}
                x1="0"
                y1="0"
                x2={Math.cos(angle) * 180}
                y2={Math.sin(angle) * 180}
                stroke="#241820"
                strokeWidth="1"
              />
            )
          })}
          {Array.from({ length: 16 }).map((_, index) => {
            const angle = (index / 16) * Math.PI * 2
            return (
              <circle
                key={`b-${index}`}
                cx={Math.cos(angle) * 180}
                cy={Math.sin(angle) * 180}
                r={3}
                fill="#d8b15f"
                opacity="0.5"
              />
            )
          })}
          <circle r="12" fill="#2a1c24" />
          <path d="M-90 180 L0 0 L90 180" fill="none" stroke="#2a1c24" strokeWidth="4" />
        </g>
        <path d="M0 750 Q220 690 420 740 Q650 800 850 735 Q1080 670 1320 750 Q1460 795 1600 750 L1600 900 L0 900Z" fill="#09070c" />
        <g fill="#0d0a10">
          <path d="M140 760 L260 600 L380 760Z" />
          <path d="M1150 760 L1290 570 L1430 760Z" />
          <path d="M520 780 L620 660 L720 780Z" />
        </g>
        <g stroke="#3a2a1e" strokeWidth="1.5" fill="none" opacity="0.8">
          <path d="M0 120 Q200 210 400 130 Q600 60 800 145 Q1000 225 1200 120 Q1400 30 1600 130" />
          <path d="M0 210 Q200 300 400 220 Q600 150 800 235 Q1000 315 1200 210 Q1400 120 1600 220" />
        </g>
        {[80, 240, 400, 560, 720, 880, 1040, 1200, 1360, 1520].map((x, index) => (
          <circle key={x} cx={x} cy={index % 2 === 0 ? 145 : 210} r="3.5" fill="#ffd08a" opacity="0.6" />
        ))}
        <g fill="#120e15" opacity="0.8">
          <rect x="0" y="820" width="1600" height="80" />
        </g>
      </svg>
      <div className="menu__fog" />
      <div className="menu__grain" />
      <div className="menu__vignette" />
    </div>
  )
}

function SurvivorIcon() {
  return (
    <svg className="role-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="10" r="5" />
      <path d="M7 29c0-6 4-10 9-10s9 4 9 10" />
      <path d="M11 23l5-4 5 4" opacity="0.5" />
    </svg>
  )
}

function KillerIcon() {
  return (
    <svg className="role-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 13c0-5 3-8 8-8s8 3 8 8v5c0 4-3 7-8 7s-8-3-8-7z" />
      <path d="M9 6l3-3 4 2 4-2 3 3" />
      <circle cx="12.5" cy="13" r="1.4" fill="currentColor" />
      <circle cx="19.5" cy="13" r="1.4" fill="currentColor" />
      <path d="M13 19c2 1 4 1 6 0" />
    </svg>
  )
}
