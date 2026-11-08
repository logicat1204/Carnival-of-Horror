import type { ExitGateConfig, MapPoint } from './maps/types'
import { clamp } from './math'

/**
 * Phase 3 objective rules shared by the authoritative server and the local
 * training sandbox. Keep this module free of DOM/Three.js imports: the server
 * must be able to import it without pulling browser code.
 */

export const GENERATOR_REPAIR_SECONDS = 22
export const GATE_OPEN_SECONDS = 12
export const GENERATOR_INTERACT_RADIUS = 2.9
export const GATE_INTERACT_RADIUS = 4.2
export const GATE_ESCAPE_RADIUS = 2.2
export const KILLER_INTERRUPT_RADIUS = 5.5
export const MATCH_TIME_LIMIT_MS = 5 * 60_000

export type InteractionKind = 'generator' | 'gate'

export interface GeneratorState {
  id: string
  x: number
  z: number
  label: string
  /** 0..1 */
  progress: number
  repaired: boolean
}

export interface GateState {
  id: string
  x: number
  z: number
  label: string
  /** 0..1 */
  progress: number
  open: boolean
}

export interface ObjectiveState {
  generators: GeneratorState[]
  gates: GateState[]
  repairedCount: number
  requiredGenerators: number
  powered: boolean
  timeRemainingMs: number
  timeLimitMs: number
}

export interface ObjectiveTarget {
  kind: InteractionKind
  id: string
  label: string
  /** 0..1 */
  progress: number
  distance: number
}

export interface MatchResult {
  winner: 'survivors' | 'killer'
  reason: 'escaped' | 'timeout'
  escapedSurvivors: number
  elapsedMs: number
}

export interface ObjectiveMapSource {
  generatorSlots: MapPoint[]
  exitGates: ExitGateConfig[]
}

export function createObjectiveState(
  source: ObjectiveMapSource,
  timeLimitMs = MATCH_TIME_LIMIT_MS,
): ObjectiveState {
  const generators: GeneratorState[] = source.generatorSlots.map((slot, index) => ({
    id: slot.id,
    x: slot.x,
    z: slot.z,
    label: `Generador ${index + 1}`,
    progress: 0,
    repaired: false,
  }))
  const gates: GateState[] = source.exitGates.map((gate) => ({
    id: gate.id,
    x: gate.x,
    z: gate.z,
    label: gate.label,
    progress: 0,
    open: false,
  }))
  const total = Math.max(1, generators.length)
  const requested = source.exitGates[0]?.requiredGenerators ?? Math.min(4, total)
  const requiredGenerators = clamp(Math.round(requested), 1, total)
  return {
    generators,
    gates,
    repairedCount: 0,
    requiredGenerators,
    powered: false,
    timeRemainingMs: Math.max(0, timeLimitMs),
    timeLimitMs: Math.max(1, timeLimitMs),
  }
}

/** Advances the match clock; returns true when the limit has been reached. */
export function advanceObjectiveTimer(state: ObjectiveState, seconds: number): boolean {
  if (!Number.isFinite(seconds) || seconds <= 0) return state.timeRemainingMs <= 0
  state.timeRemainingMs = Math.max(0, state.timeRemainingMs - seconds * 1000)
  return state.timeRemainingMs <= 0
}

/** Closest useful interaction for a survivor standing at (x, z). */
export function findObjectiveTarget(
  state: Pick<ObjectiveState, 'generators' | 'gates' | 'powered'>,
  x: number,
  z: number,
): ObjectiveTarget | null {
  let best: ObjectiveTarget | null = null

  for (const generator of state.generators) {
    if (generator.repaired) continue
    const distance = Math.hypot(x - generator.x, z - generator.z)
    if (distance > GENERATOR_INTERACT_RADIUS) continue
    if (best && distance >= best.distance) continue
    best = {
      kind: 'generator',
      id: generator.id,
      label: generator.label,
      progress: generator.progress,
      distance,
    }
  }

  if (state.powered) {
    for (const gate of state.gates) {
      if (gate.open) continue
      const distance = Math.hypot(x - gate.x, z - gate.z)
      if (distance > GATE_INTERACT_RADIUS) continue
      if (best && distance >= best.distance) continue
      best = {
        kind: 'gate',
        id: gate.id,
        label: gate.label,
        progress: gate.progress,
        distance,
      }
    }
  }

  return best
}

/** Adds repair progress. `rate` comes from dexterityMultiplier (x0.75..x1.25). */
export function applyGeneratorRepair(
  state: ObjectiveState,
  generatorId: string,
  seconds: number,
  rate = 1,
): boolean {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return false
  }
  const generator = state.generators.find((candidate) => candidate.id === generatorId)
  if (!generator || generator.repaired) return false
  generator.progress = clamp(generator.progress + (seconds * rate) / GENERATOR_REPAIR_SECONDS, 0, 1)
  if (generator.progress >= 1) {
    generator.progress = 1
    generator.repaired = true
  }
  refreshPower(state)
  return generator.repaired
}

export function applyGateOpen(
  state: ObjectiveState,
  gateId: string,
  seconds: number,
  rate = 1,
): boolean {
  if (!state.powered) return false
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return false
  }
  const gate = state.gates.find((candidate) => candidate.id === gateId)
  if (!gate || gate.open) return false
  gate.progress = clamp(gate.progress + (seconds * rate) / GATE_OPEN_SECONDS, 0, 1)
  if (gate.progress >= 1) {
    gate.progress = 1
    gate.open = true
  }
  return gate.open
}

export function isAtOpenGate(state: Pick<ObjectiveState, 'gates'>, x: number, z: number): boolean {
  return state.gates.some(
    (gate) => gate.open && Math.hypot(x - gate.x, z - gate.z) <= GATE_ESCAPE_RADIUS,
  )
}

/** The killer can body-block an interaction by staying close to a survivor. */
export function isInteractionSuppressed(
  killerX: number,
  killerZ: number,
  survivorX: number,
  survivorZ: number,
): boolean {
  return Math.hypot(killerX - survivorX, killerZ - survivorZ) < KILLER_INTERRUPT_RADIUS
}

export function createMatchResult(
  state: ObjectiveState,
  winner: MatchResult['winner'],
  reason: MatchResult['reason'],
  escapedSurvivors = 0,
): MatchResult {
  return {
    winner,
    reason,
    escapedSurvivors,
    elapsedMs: Math.max(0, state.timeLimitMs - state.timeRemainingMs),
  }
}

function refreshPower(state: ObjectiveState): void {
  state.repairedCount = state.generators.reduce(
    (count, generator) => count + (generator.repaired ? 1 : 0),
    0,
  )
  state.powered = state.repairedCount >= state.requiredGenerators
}
