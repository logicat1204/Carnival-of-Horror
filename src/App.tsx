import { useEffect, useState } from 'react'
import type { GameNetworkSession } from './game/Game'
import { NetworkClient } from './net/NetworkClient'
import type { PlayerRole } from './shared/net/contracts'
import type { MatchStart } from './shared/net/protocol'
import { loadSettings, saveSettings, type GameSettings } from './shared/settings'
import { GameScreen } from './ui/GameScreen'
import { LobbyScreen } from './ui/LobbyScreen'
import { MainMenu } from './ui/MainMenu'

interface Selection {
  role: PlayerRole
  characterId: string
}

type Screen = 'menu' | 'lobby' | 'game'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
  const [selection, setSelection] = useState<Selection>({ role: 'survivor', characterId: 'valeria' })
  const [network] = useState(() => new NetworkClient())
  const [onlineSession, setOnlineSession] = useState<GameNetworkSession | null>(null)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion)
    return () => document.documentElement.classList.remove('reduce-motion')
  }, [settings.reduceMotion])

  useEffect(() => {
    return () => network.disconnect()
  }, [network])

  const startOnline = (match: MatchStart) => {
    const self = match.players.find((player) => player.id === network.clientId)
    if (!self) return
    setSelection({ role: self.role, characterId: self.characterId })
    setOnlineSession({ client: network, selfId: self.id, match })
    setScreen('game')
  }

  const exitGame = () => {
    if (onlineSession) {
      network.leaveRoom()
      network.disconnect()
    }
    setOnlineSession(null)
    setScreen('menu')
  }

  if (screen === 'game') {
    return (
      <GameScreen
        key={
          onlineSession
            ? `online:${onlineSession.match.roomCode}:${onlineSession.selfId}:${onlineSession.match.serverTick}`
            : `local:${selection.role}:${selection.characterId}`
        }
        role={selection.role}
        characterId={selection.characterId}
        settings={settings}
        network={onlineSession ?? undefined}
        onSettingsChange={setSettings}
        onExit={exitGame}
      />
    )
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen
        network={network}
        initialRole={selection.role}
        initialCharacterId={selection.characterId}
        onBack={() => {
          network.disconnect()
          setScreen('menu')
        }}
        onStart={startOnline}
      />
    )
  }

  return (
    <MainMenu
      settings={settings}
      initialRole={selection.role}
      initialCharacterId={selection.characterId}
      onSettingsChange={setSettings}
      onStart={(role, characterId) => {
        setSelection({ role, characterId })
        setOnlineSession(null)
        setScreen('game')
      }}
      onOpenOnline={() => setScreen('lobby')}
    />
  )
}
