export type QualityLevel = 'low' | 'medium' | 'high'

export interface GameSettings {
  sensitivity: number
  invertY: boolean
  fov: number
  quality: QualityLevel
  masterVolume: number
  reduceMotion: boolean
  showDebugOnStart: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1,
  invertY: false,
  fov: 74,
  quality: 'high',
  masterVolume: 0.55,
  reduceMotion: false,
  showDebugOnStart: false,
}

export const SETTINGS_STORAGE_KEY = 'carnival-of:settings:v1'

export function normalizeSettings(input: Partial<GameSettings> | null | undefined): GameSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(input ?? {}) }
  return {
    sensitivity: clampNumber(merged.sensitivity, 0.2, 2.5, DEFAULT_SETTINGS.sensitivity),
    invertY: Boolean(merged.invertY),
    fov: clampNumber(merged.fov, 62, 96, DEFAULT_SETTINGS.fov),
    quality: merged.quality === 'low' || merged.quality === 'medium' || merged.quality === 'high'
      ? merged.quality
      : DEFAULT_SETTINGS.quality,
    masterVolume: clampNumber(merged.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
    reduceMotion: Boolean(merged.reduceMotion),
    showDebugOnStart: Boolean(merged.showDebugOnStart),
  }
}

export function loadSettings(): GameSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? normalizeSettings(JSON.parse(raw) as Partial<GameSettings>) : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable in private mode; the game keeps working.
  }
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}
