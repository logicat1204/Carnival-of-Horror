/**
 * Shared movement/tick constants.
 *
 * The client runs the exact same fixed-step simulation that the authoritative
 * server runs at 60 Hz. Keep these values in shared code so both sides cannot
 * drift apart.
 */

export const SIMULATION_TICK_RATE = 60
export const FIXED_DT = 1 / SIMULATION_TICK_RATE
export const MAX_CATCHUP_STEPS = 5
export const INTERPOLATION_DELAY_MS = 100

export const NETWORK_PROTOCOL_VERSION = 1
export const GAME_PROTOCOL_VERSION = 1

export const SURVIVOR = {
  radius: 0.34,
  height: 1.8,
  eyeHeight: 1.64,
  crouchHeight: 1.2,
  crouchEyeHeight: 1.06,
  walkSpeed: 3.2,
  sprintSpeed: 5.7,
  crouchSpeed: 1.65,
  acceleration: 14,
  crouchTransitionSpeed: 9,
} as const

export const KILLER = {
  radius: 0.46,
  height: 2.15,
  walkSpeed: 4.35,
  sprintSpeed: 4.35,
  acceleration: 10,
} as const

export const AERIAL_CAMERA = {
  // The minimum distance is deliberately high: zoom is a framing tool, not a
  // close-range scope. 28 m keeps the killer above the canopies (≈24 m).
  minDistance: 28,
  maxDistance: 52,
  defaultDistance: 34,
  minElevation: 0.68,
  maxElevation: 1.42,
  defaultElevation: 1.02,
  followLambda: 7,
  panRadius: 15,
  panSensitivity: 0.055,
  zoomStep: 2,
} as const

export const FPS_CAMERA = {
  defaultFov: 74,
  sprintFovBoost: 6,
  minPitch: -1.45,
  maxPitch: 1.45,
  mouseSensitivity: 0.0022,
} as const

export const WORLD = {
  defaultBoundsPadding: 1.2,
  groundY: 0,
} as const

export const HEALTH_STATES = ['healthy', 'injured', 'incapacitated', 'eliminated'] as const
export type HealthState = (typeof HEALTH_STATES)[number]
