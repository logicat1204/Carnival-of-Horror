import { describe, expect, it } from 'vitest'
import { CarnivalRoom } from '../server/room'
import { RoomManager } from '../server/roomManager'
import type { LobbyProfile } from '../src/shared/net/protocol'
import type { MapConfig } from '../src/shared/maps/types'
import carnivalConfig from '../src/maps/carnival/map.config.json'

const CONFIG = carnivalConfig as unknown as MapConfig

const killerProfile: LobbyProfile = {
  name: 'Host',
  role: 'killer',
  characterId: 'master_of_ceremonies',
}

function survivorProfile(index: number): LobbyProfile {
  return {
    name: `Survivor ${index}`,
    role: 'survivor',
    characterId: 'valeria',
  }
}

describe('authoritative room', () => {
  it('assigns the first player as host and enforces role slots', () => {
    const room = new CarnivalRoom('TEST', CONFIG)
    const killer = room.addPlayer('k1', 't1', 's1', killerProfile, 1)
    expect('code' in killer).toBe(false)
    expect(room.hostId).toBe('k1')

    for (let i = 1; i <= 4; i++) {
      const result = room.addPlayer(`s${i}`, `t${i + 1}`, `sock${i}`, survivorProfile(i), 1 + i)
      expect('code' in result).toBe(false)
    }
    const fifth = room.addPlayer('s5', 't6', 'sock5', survivorProfile(5), 10)
    expect('code' in fifth && fifth.code).toBe('survivors_full')

    const secondKiller = room.addPlayer('k2', 't7', 'sock6', killerProfile, 11)
    expect('code' in secondKiller && secondKiller.code).toBe('killer_taken')
  })

  it('requires exactly one killer, a survivor and universal readiness to start', () => {
    const room = new CarnivalRoom('TEST', CONFIG)
    room.addPlayer('k1', 't1', 's1', killerProfile, 1)
    room.addPlayer('s1', 't2', 's2', survivorProfile(1), 2)

    expect('code' in room.start('k1', 10)).toBe(true)
    room.setReady('k1', true)
    expect('code' in room.start('k1', 10)).toBe(true)
    room.setReady('s1', true)
    const match = room.start('k1', 10)
    expect('code' in match).toBe(false)
    if ('code' in match) return
    expect(match.players).toHaveLength(2)
    const spawn = CONFIG.spawns.killer
    const killerState = match.players.find((player) => player.id === 'k1')
    expect(killerState).toMatchObject({ x: spawn.x, z: spawn.z, yaw: spawn.yaw })
    expect(room.phase).toBe('playing')
  })

  it('advances movement deterministically from validated inputs', () => {
    const room = new CarnivalRoom('TEST', CONFIG)
    room.addPlayer('k1', 't1', 's1', killerProfile, 1)
    room.addPlayer('s1', 't2', 's2', survivorProfile(1), 2)
    room.setReady('k1', true)
    room.setReady('s1', true)
    const match = room.start('k1', 10)
    if ('code' in match) throw new Error('match did not start')
    const spawn = CONFIG.spawns.survivors[0]
    const before = room.getPlayer('s1')!.state
    expect(before.x).toBe(spawn.x)

    room.acceptInput(
      's1',
      { seq: 1, forward: 1, right: 0, sprint: false, crouch: false, interact: false, yaw: 0, pitch: 0 },
      100,
    )
    room.tickStep(100)
    const after = room.getPlayer('s1')!.state
    expect(after.z).toBeLessThan(before.z)
    expect(after.lastSeq).toBe(1)
    expect(after.speed).toBeGreaterThan(0)
  })

  it('ignores duplicate and reordered input sequences', () => {
    const room = new CarnivalRoom('TEST', CONFIG)
    room.addPlayer('k1', 't1', 's1', killerProfile, 1)
    room.addPlayer('s1', 't2', 's2', survivorProfile(1), 2)
    room.setReady('k1', true)
    room.setReady('s1', true)
    room.start('k1', 10)

    room.acceptInput(
      's1',
      { seq: 7, forward: 1, right: 0, sprint: false, crouch: false, interact: false, yaw: 0, pitch: 0 },
      100,
    )
    room.acceptInput(
      's1',
      { seq: 6, forward: -1, right: 0, sprint: false, crouch: false, interact: false, yaw: 0, pitch: 0 },
      101,
    )
    expect(room.getPlayer('s1')!.input.seq).toBe(7)
    expect(room.getPlayer('s1')!.input.forward).toBe(1)
  })

  it('keeps a disconnected player during the grace period and allows reattach', () => {
    const room = new CarnivalRoom('TEST', CONFIG)
    room.addPlayer('k1', 't1', 's1', killerProfile, 1)
    room.addPlayer('s1', 't2', 's2', survivorProfile(1), 2)
    room.setReady('k1', true)
    room.setReady('s1', true)
    room.start('k1', 10)

    room.disconnect('s1', 1000)
    expect(room.getPlayer('s1')!.connected).toBe(false)
    room.tickStep(1000)
    room.tickStep(1000)
    room.tickStep(1000)
    expect(room.maybeSnapshot()?.players.some((player) => player.id === 's1')).toBe(false)

    const resumed = room.reattach('s1', 's2-new', 2000)
    expect('code' in resumed).toBe(false)
    expect(room.getPlayer('s1')!.connected).toBe(true)

    room.disconnect('s1', 3000)
    room.tickStep(3000 + 25_001)
    expect(room.getPlayer('s1')).toBeNull()
  })

  it('moves host ownership to the next connected player', () => {
    const room = new CarnivalRoom('TEST', CONFIG)
    room.addPlayer('k1', 't1', 's1', killerProfile, 1)
    room.addPlayer('s1', 't2', 's2', survivorProfile(1), 2)
    room.disconnect('k1', 3)
    expect(room.hostId).toBe('s1')
    expect(room.roomView('s1').players.find((player) => player.id === 's1')?.host).toBe(true)
  })
})

describe('room manager', () => {
  it('creates private rooms and resumes a token during a match', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('token-1', 'socket-1', killerProfile, 1)
    if ('code' in created) throw new Error('room did not start')
    expect(created.room.code).toHaveLength(4)

    const second = manager.joinRoom(created.room.code, 'token-2', 'socket-2', survivorProfile(1), 2)
    if ('code' in second) throw new Error('join failed')
    created.room.setReady(created.player.id, true)
    created.room.setReady(second.player.id, true)
    const match = created.room.start(created.player.id, 3)
    expect('code' in match).toBe(false)

    manager.disconnect('token-2', second.player.id, 'socket-2')
    const resumed = manager.resume('token-2', 'socket-2b', 4)
    expect(resumed && 'player' in resumed && resumed.player.id).toBe(second.player.id)

    // The old socket can close after the reconnect without kicking the new one.
    expect(manager.disconnect('token-2', second.player.id, 'socket-2')).toBeNull()
    expect(manager.roomByCode(created.room.code)?.getPlayer(second.player.id)?.connected).toBe(true)
  })

  it('keeps a lobby alive when one player leaves and transfers host', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('token-1', 'socket-1', killerProfile, 1)
    if ('code' in created) throw new Error('room did not start')
    const second = manager.joinRoom(created.room.code, 'token-2', 'socket-2', survivorProfile(1), 2)
    if ('code' in second) throw new Error('join failed')

    const leaving = manager.leave('token-1', created.player.id, 'socket-1')
    expect(leaving).toBe(created.room)
    expect(manager.roomByCode(created.room.code)).toBe(created.room)
    expect(created.room.getPlayer(created.player.id)).toBeNull()
    expect(created.room.hostId).toBe(second.player.id)
    expect(created.room.playerCount).toBe(1)
  })

  it('ignores late disconnect messages from a replaced socket', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('token-1', 'socket-1', killerProfile, 1)
    if ('code' in created) throw new Error('room did not start')
    const second = manager.joinRoom(created.room.code, 'token-2', 'socket-2', survivorProfile(1), 2)
    if ('code' in second) throw new Error('join failed')

    expect(manager.disconnect('token-1', created.player.id, 'stale-socket')).toBeNull()
    expect(created.room.getPlayer(created.player.id)?.connected).toBe(true)
    expect(created.room.hostId).toBe(created.player.id)
  })

  it('rejects unknown codes and leaves rooms empty', () => {
    const manager = new RoomManager()
    expect(manager.joinRoom('ZZZZ', 't', 's', survivorProfile(1))).toMatchObject({
      code: 'room_not_found',
    })
  })
})
