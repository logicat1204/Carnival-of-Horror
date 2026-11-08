import { describe, expect, it } from 'vitest'
import { CarnivalRoom } from '../server/room'
import type { MapConfig } from '../src/shared/maps/types'
import {
  GENERATOR_REPAIR_SECONDS,
  GATE_OPEN_SECONDS,
  applyGateOpen,
  applyGeneratorRepair,
  createObjectiveState,
  findObjectiveTarget,
  isAtOpenGate,
  isInteractionSuppressed,
  advanceObjectiveTimer,
} from '../src/shared/objectives'
import type { LobbyProfile, NetInput } from '../src/shared/net/protocol'
import carnivalConfig from '../src/maps/carnival/map.config.json'

const CONFIG = carnivalConfig as unknown as MapConfig
const FIXED_STEP = 1 / 60

const killerProfile: LobbyProfile = {
  name: 'Host',
  role: 'killer',
  characterId: 'master_of_ceremonies',
}

const survivorProfile: LobbyProfile = {
  name: 'Survivor',
  role: 'survivor',
  characterId: 'valeria',
}

function input(seq: number, interact = false): NetInput {
  return {
    seq,
    forward: 0,
    right: 0,
    sprint: false,
    crouch: false,
    interact,
    yaw: 0,
    pitch: 0,
  }
}

function startRoom(): CarnivalRoom {
  const room = new CarnivalRoom('TEST', CONFIG)
  room.addPlayer('k1', 't1', 's1', killerProfile, 1)
  room.addPlayer('s1', 't2', 's2', survivorProfile, 2)
  room.setReady('k1', true)
  room.setReady('s1', true)
  const match = room.start('k1', 10)
  if ('code' in match) throw new Error(match.message)
  return room
}

function tick(room: CarnivalRoom, steps: number, now = 100): void {
  for (let step = 0; step < steps; step++) {
    room.tickStep(now)
    room.maybeSnapshot()
  }
}

describe('shared objective rules', () => {
  it('repairs generators, powers exits and opens a gate only after power', () => {
    const state = createObjectiveState(CONFIG)
    const generator = state.generators[0]
    const gate = state.gates[0]

    expect(findObjectiveTarget(state, gate.x, gate.z)).toBeNull()
    expect(findObjectiveTarget(state, generator.x, generator.z)).toMatchObject({
      kind: 'generator',
      id: generator.id,
    })

    for (const target of state.generators.slice(0, state.requiredGenerators)) {
      expect(applyGeneratorRepair(state, target.id, GENERATOR_REPAIR_SECONDS, 1)).toBe(true)
    }
    expect(state.powered).toBe(true)
    expect(state.repairedCount).toBe(state.requiredGenerators)
    expect(findObjectiveTarget(state, gate.x, gate.z)).toMatchObject({
      kind: 'gate',
      id: gate.id,
    })

    expect(applyGateOpen(state, gate.id, GATE_OPEN_SECONDS / 2, 1)).toBe(false)
    expect(gate.progress).toBeCloseTo(0.5)
    expect(applyGateOpen(state, gate.id, GATE_OPEN_SECONDS / 2, 1)).toBe(true)
    expect(gate.open).toBe(true)
    expect(isAtOpenGate(state, gate.x, gate.z)).toBe(true)
    expect(isAtOpenGate(state, gate.x + 3, gate.z)).toBe(false)
  })

  it('uses a finite clock and detects killer proximity', () => {
    const state = createObjectiveState(CONFIG, 10_000)
    expect(advanceObjectiveTimer(state, 4)).toBe(false)
    expect(state.timeRemainingMs).toBe(6_000)
    expect(advanceObjectiveTimer(state, 6)).toBe(true)
    expect(state.timeRemainingMs).toBe(0)

    expect(isInteractionSuppressed(0, 0, 1, 0)).toBe(true)
    expect(isInteractionSuppressed(0, 0, 6, 0)).toBe(false)
  })
})

describe('authoritative objectives', () => {
  it('repairs, powers and escapes through a gate', () => {
    const room = startRoom()
    const survivor = room.getPlayer('s1')!
    const killer = room.getPlayer('k1')!
    killer.state.x = 40
    killer.state.z = 40

    let seq = 1
    for (let index = 0; index < room.getObjectives().requiredGenerators; index++) {
      const generator = CONFIG.generatorSlots[index]
      // Stand just outside the solid footprint. Teleporting into the center
      // would make the collision resolver eject the player with momentum.
      survivor.state.x = generator.x + 2.1
      survivor.state.z = generator.z
      survivor.state.velocityX = 0
      survivor.state.velocityZ = 0
      room.acceptInput('s1', input(seq++, true), 100)
      tick(room, Math.ceil(GENERATOR_REPAIR_SECONDS * 60) + 4)
    }

    expect(room.getObjectives().powered).toBe(true)
    expect(room.phase).toBe('playing')

    const gate = CONFIG.exitGates[1]
    survivor.state.x = gate.x - 3
    survivor.state.z = gate.z
    room.acceptInput('s1', input(seq++, true), 100)
    tick(room, Math.ceil(GATE_OPEN_SECONDS * 60) + 4)
    expect(room.getObjectives().gates[1].open).toBe(true)
    expect(room.phase).toBe('playing')

    survivor.state.x = gate.x
    tick(room, 1)
    const finalSnapshot = room.getLatestSnapshot()
    expect(room.phase).toBe('ended')
    expect(finalSnapshot?.result).toMatchObject({
      winner: 'survivors',
      reason: 'escaped',
      escapedSurvivors: 1,
    })
  })

  it('blocks repair while the killer is close and resumes when they move away', () => {
    const room = startRoom()
    const survivor = room.getPlayer('s1')!
    const killer = room.getPlayer('k1')!
    const generator = CONFIG.generatorSlots[0]
    survivor.state.x = generator.x + 2.1
    survivor.state.z = generator.z
    survivor.state.velocityX = 0
    survivor.state.velocityZ = 0
    killer.state.x = generator.x + 4.1
    killer.state.z = generator.z

    room.acceptInput('s1', input(1, true), 100)
    tick(room, 120)
    expect(room.getObjectives().generators[0].progress).toBe(0)
    expect(survivor.state.action).toBeNull()

    killer.state.x = 40
    killer.state.z = 40
    tick(room, 120)
    expect(room.getObjectives().generators[0].progress).toBeGreaterThan(0)
    expect(survivor.state.action).toBe('generator')
  })

  it('awards the killer when the match clock reaches zero', () => {
    const room = startRoom()
    room.getPlayer('k1')!.state.x = 40
    room.getPlayer('k1')!.state.z = 40
    // The server consumes one fixed step per tick; run the full five minutes.
    tick(room, Math.ceil((5 * 60_000) / 1000 / FIXED_STEP) + 2)
    const snapshot = room.getLatestSnapshot()
    expect(room.phase).toBe('ended')
    expect(snapshot?.result).toMatchObject({ winner: 'killer', reason: 'timeout' })
  })
})
