import { useEffect, useMemo, useState } from 'react'
import { SURVIVORS } from '../shared/characters'
import type { PlayerRole } from '../shared/net/contracts'
import type { MatchStart, RoomPlayer, RoomView } from '../shared/net/protocol'
import type { NetworkClient, NetworkStatus } from '../net/NetworkClient'

interface LobbyScreenProps {
  network: NetworkClient
  initialRole: PlayerRole
  initialCharacterId: string
  onBack: () => void
  onStart: (match: MatchStart) => void
}

const NAME_KEY = 'carnival.player.name'

export function LobbyScreen({
  network,
  initialRole,
  initialCharacterId,
  onBack,
  onStart,
}: LobbyScreenProps) {
  const [name, setName] = useState(() => readName())
  const [role, setRole] = useState<PlayerRole>(initialRole)
  const [characterId, setCharacterId] = useState(initialCharacterId)
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<RoomView | null>(network.room)
  const [status, setStatus] = useState<NetworkStatus>(network.status)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    network.onRoom = (next) => {
      setRoom(next)
      setBusy(false)
    }
    network.onStatus = (next) => {
      setStatus(next)
      if (next === 'connected') setBusy(false)
    }
    network.onNotice = (next) => {
      setNotice(next.message)
      setBusy(false)
      if (next.kind === 'error') {
        // The server rejected an optimistic role/character change; restore the
        // role that the room actually has for this player.
        const current = network.room?.players.find((player) => player.id === network.room?.you)
        if (current) {
          setRole(current.role)
          setCharacterId(current.characterId)
        }
      }
    }
    network.onMatchStart = (match) => onStart(match)
    setRoom(network.room)
    setStatus(network.status)
    if (network.status === 'idle' || network.status === 'closed') {
      void network.connect().catch((reason) => {
        setBusy(false)
        setNotice(reason instanceof Error ? reason.message : String(reason))
      })
    }
    return () => {
      network.onRoom = null
      network.onStatus = null
      network.onNotice = null
      network.onMatchStart = null
    }
  }, [network, onStart])

  useEffect(() => {
    if (room?.phase === 'playing' && network.lastMatch) onStart(network.lastMatch)
  }, [room?.phase, network, onStart])

  const self = useMemo(
    () => room?.players.find((player) => player.id === room.you) ?? null,
    [room],
  )

  useEffect(() => {
    if (!self) return
    setRole(self.role)
    setCharacterId(self.characterId)
  }, [self?.id, self?.role, self?.characterId])

  const isHost = self?.host ?? false
  const survivors = room?.players.filter((player) => player.role === 'survivor') ?? []
  const killers = room?.players.filter((player) => player.role === 'killer') ?? []
  const allReady = Boolean(room?.players.length) && room!.players.every((player) => player.ready)
  const canStart = Boolean(isHost && room && allReady && killers.length === 1 && survivors.length >= 1)
  const connected = status === 'connected'
  const canSubmit = connected && name.trim().length >= 2 && !busy

  const profile = useMemo(
    () => ({
      name: name.trim() || 'Invitado',
      role,
      characterId: role === 'killer' ? 'master_of_ceremonies' : characterId,
    }),
    [name, role, characterId],
  )

  const create = () => {
    if (!canSubmit) return
    saveName(profile.name)
    setBusy(true)
    setNotice(null)
    network.createRoom(profile)
  }

  const join = () => {
    if (!canSubmit) return
    if (!/^[A-HJ-NP-Z2-9]{4}$/i.test(code.trim())) {
      setNotice('El código de sala tiene 4 caracteres (sin O, I, 0 ni 1).')
      return
    }
    saveName(profile.name)
    setBusy(true)
    setNotice(null)
    network.joinRoom(code.trim().toUpperCase(), profile)
  }

  const leave = () => {
    network.leaveRoom()
    network.disconnect()
    onBack()
  }

  const changeRole = (nextRole: PlayerRole) => {
    setRole(nextRole)
    if (!room) return
    network.updateProfile({
      name: name.trim() || 'Invitado',
      role: nextRole,
      characterId: nextRole === 'killer' ? 'master_of_ceremonies' : characterId,
    })
  }

  const changeCharacter = (nextId: string) => {
    setCharacterId(nextId)
    if (!room) return
    network.updateProfile({
      name: name.trim() || 'Invitado',
      role,
      characterId: nextId,
    })
  }

  const copyCode = async () => {
    if (!room) return
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setNotice(`Código de sala: ${room.code}`)
    }
  }

  return (
    <div className="lobby">
      <header className="lobby__topbar">
        <div className="brand-lockup" aria-label="Carnival of">
          <span className="brand-lockup__mark">C</span>
          <span>
            <strong>Carnival</strong>
            <em>of…</em>
          </span>
        </div>
        <span className="phase-pill">FASE 3 · OBJETIVOS AUTORITATIVOS</span>
        <div className="lobby__top-actions">
          <span className={`net-badge net-badge--${status}`}>
            <span className="net-dot" />
            {statusLabel(status)}
          </span>
          <button className="nav-link" onClick={leave}>Volver</button>
        </div>
      </header>

      <main className="lobby__main">
        <section className="lobby__intro">
          <p className="eyebrow">Función privada · 1 asesino · hasta 4 supervivientes</p>
          <h1>Salas <em>en línea</em></h1>
          <p>
            El servidor es la autoridad: valida movimiento, colisiones, reparaciones, energía y
            salidas. Cuatro generadores alimentan las puertas; el asesino puede interrumpir una
            interacción acercándose. Combate y eliminación siguen reservados para la siguiente fase.
          </p>
          <dl className="lobby__facts">
            <div><dt>60 Hz</dt><dd>simulación del servidor</dd></div>
            <div><dt>20 Hz</dt><dd>snapshots interpolados</dd></div>
            <div><dt>1 v 4</dt><dd>sala privada por código</dd></div>
          </dl>
        </section>

        {notice && (
          <div className="lobby__notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button>
          </div>
        )}

        {!room && (
          <section className="lobby__entry">
            <div className="lobby-card">
              <p className="eyebrow">Tu entrada</p>
              <label className="field">
                <span>Nombre</span>
                <input
                  value={name}
                  maxLength={18}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Invitado"
                />
              </label>
              <label className="field">
                <span>Papel</span>
                <select value={role} onChange={(event) => setRole(event.target.value as PlayerRole)}>
                  <option value="survivor">Superviviente</option>
                  <option value="killer">Asesino</option>
                </select>
              </label>
              {role === 'survivor' && (
                <label className="field">
                  <span>Personaje</span>
                  <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
                    {SURVIVORS.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} {character.surname} · {character.profession}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button className="btn-primary" disabled={!canSubmit} onClick={create}>
                Crear sala privada
              </button>
              <small>
                Se abrirá una sala nueva con un código de 4 caracteres. Compártelo con tus amigos.
              </small>
            </div>

            <div className="lobby-card lobby-card--join">
              <p className="eyebrow">Ya tienes código</p>
              <label className="field">
                <span>Código de sala</span>
                <input
                  className="room-code-input"
                  value={code}
                  maxLength={4}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="ABCD"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button className="btn-primary" disabled={!canSubmit || code.trim().length !== 4} onClick={join}>
                Unirse a la función
              </button>
              <small>El servidor rechazará salas llenas, partidas ya iniciadas o roles ocupados.</small>
            </div>
          </section>
        )}

        {room && (
          <section className="lobby__room">
            <div className="room-head">
              <div>
                <p className="eyebrow">Sala privada</p>
                <button className="room-code" onClick={copyCode} title="Copiar código">
                  {room.code}
                  <span>{copied ? 'copiado' : 'copiar'}</span>
                </button>
              </div>
              <div className="room-head__meta">
                <span>{room.players.length}/5 jugadores</span>
                <span>{network.latencyMs} ms</span>
                <span>{room.phase === 'playing' ? 'En partida' : 'Lobby'}</span>
              </div>
            </div>

            <div className="room-grid">
              <div className="room-roster">
                <p className="eyebrow">Reparto</p>
                <div className="roster-list">
                  {room.players.map((player) => (
                    <PlayerRow key={player.id} player={player} self={player.id === room.you} />
                  ))}
                  {!killers.length && (
                    <div className="roster-slot roster-slot--empty">Falta el asesino</div>
                  )}
                  {Array.from({ length: Math.max(0, 4 - survivors.length) }).map((_, index) => (
                    <div className="roster-slot roster-slot--empty" key={`survivor-empty-${index}`}>
                      Superviviente libre
                    </div>
                  ))}
                </div>
              </div>

              <div className="room-side">
                {self && (
                  <>
                    <p className="eyebrow">Tu papel</p>
                    <div className="room-self">
                      <strong>{roleLabel(self.role)}</strong>
                      <span>{self.characterId === 'master_of_ceremonies' ? 'El Anfitrión' : characterName(self.characterId)}</span>
                    </div>
                    <label className="field">
                      <span>Cambiar papel</span>
                      <select value={role} onChange={(event) => changeRole(event.target.value as PlayerRole)}>
                        <option value="survivor">Superviviente</option>
                        <option value="killer">Asesino</option>
                      </select>
                    </label>
                    {role === 'survivor' && (
                      <label className="field">
                        <span>Cambiar personaje</span>
                        <select value={characterId} onChange={(event) => changeCharacter(event.target.value)}>
                          {SURVIVORS.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.name} {character.surname}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="room-actions">
                      <button
                        className={self.ready ? 'btn-ghost' : 'btn-primary'}
                        onClick={() => network.setReady(!self.ready)}
                      >
                        {self.ready ? 'Cancelar preparado' : 'Estoy preparado'}
                      </button>
                      {isHost && (
                        <button className="btn-primary" disabled={!canStart} onClick={() => network.startMatch()}>
                          Iniciar función
                        </button>
                      )}
                    </div>
                    {isHost && !canStart && (
                      <small className="room-hint">
                        Para iniciar: exactamente 1 asesino, al menos 1 superviviente y todos preparados.
                      </small>
                    )}
                  </>
                )}
                <button className="btn-ghost room-leave" onClick={leave}>Salir de la sala</button>
              </div>
            </div>
          </section>
        )}

        {(status === 'connecting' || status === 'reconnecting') && (
          <div className="lobby__connecting">
            <span className="loading-mark" aria-hidden="true"><span /><span /><span /></span>
            <p>{status === 'connecting' ? 'Conectando con el servidor autoritativo…' : 'Reconectando…'}</p>
          </div>
        )}
      </main>
    </div>
  )
}

function PlayerRow({ player, self }: { player: RoomPlayer; self: boolean }) {
  return (
    <div className={`roster-row ${!player.connected ? 'is-offline' : ''}`}>
      <span className={`roster-avatar roster-avatar--${player.role}`}>
        {player.role === 'killer' ? 'A' : player.name.slice(0, 1).toUpperCase()}
      </span>
      <div>
        <strong>
          {player.name}
          {self && <em> · tú</em>}
          {player.host && <span className="mini-tag">Anfitrión</span>}
        </strong>
        <small>
          {roleLabel(player.role)} · {player.characterId === 'master_of_ceremonies' ? 'El Anfitrión' : characterName(player.characterId)}
          {!player.connected && ' · desconectado'}
        </small>
      </div>
      <span className={`ready-state ${player.ready ? 'is-ready' : ''}`}>
        {player.ready ? 'Listo' : 'Espera'}
      </span>
    </div>
  )
}

function characterName(id: string): string {
  const character = SURVIVORS.find((candidate) => candidate.id === id)
  return character ? `${character.name} ${character.surname}` : id
}

function roleLabel(role: PlayerRole): string {
  return role === 'killer' ? 'Asesino' : 'Superviviente'
}

function statusLabel(status: NetworkStatus): string {
  switch (status) {
    case 'connected':
      return 'Conectado'
    case 'connecting':
      return 'Conectando'
    case 'reconnecting':
      return 'Reconectando'
    case 'closed':
      return 'Sin conexión'
    default:
      return 'Inactivo'
  }
}

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name)
  } catch {
    // Storage is optional.
  }
}
