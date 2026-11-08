import { makeAABB, pointInsideAABB } from '../collision'
import { snapRightAngle } from '../math'
import {
  DEFAULT_VALIDATION_REQUIREMENTS,
  type MapConfig,
  type ValidationIssue,
  type ValidationRequirements,
  type ValidationResult,
} from './types'

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/

/**
 * Validates map data before a scene is built. Returns every issue instead of
 * throwing so the editor/future map tools can display actionable messages.
 */
export function validateMapConfig(
  config: MapConfig,
  requirements: ValidationRequirements = DEFAULT_VALIDATION_REQUIREMENTS,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const error = (code: string, message: string, path: string) =>
    issues.push({ severity: 'error', code, message, path })
  const warn = (code: string, message: string, path: string) =>
    issues.push({ severity: 'warning', code, message, path })

  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      issues: [{ severity: 'error', code: 'map.invalid', message: 'La configuración no es un objeto.', path: '$' }],
    }
  }

  if (config.schemaVersion !== 1) {
    error('map.schema_version', 'schemaVersion debe ser 1.', '$.schemaVersion')
  }
  if (!config.id || !ID_PATTERN.test(config.id)) {
    error('map.id', 'El id del mapa debe ser un slug estable (a-z, 0-9, -, _).', '$.id')
  }
  if (!config.name?.trim()) error('map.name', 'El mapa necesita un nombre.', '$.name')

  const { width, depth, playableMargin } = config.dimensions ?? {}
  if (!(width >= 20) || !(depth >= 20)) {
    error('map.dimensions', 'El mapa debe medir al menos 20x20 metros.', '$.dimensions')
  }
  if (!(playableMargin >= 0) || playableMargin * 2 >= Math.min(width, depth)) {
    error('map.margin', 'playableMargin no es válido.', '$.dimensions.playableMargin')
  }

  const bounds = getPlayableBounds(config)
  const halfPlayableX = (width - playableMargin * 2) / 2
  const halfPlayableZ = (depth - playableMargin * 2) / 2
  const checkPoint = (x: number, z: number, path: string, label: string) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      error('map.point_nan', `${label} tiene coordenadas no numéricas.`, path)
      return
    }
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
      error(
        'map.point_out_of_bounds',
        `${label} (${x.toFixed(1)}, ${z.toFixed(1)}) está fuera del área jugable ` +
          `(${halfPlayableX.toFixed(1)} × ${halfPlayableZ.toFixed(1)} m).`,
        path,
      )
    }
  }

  const survivorSpawns = config.spawns?.survivors ?? []
  if (survivorSpawns.length < requirements.minSurvivorSpawns) {
    error(
      'map.survivor_spawns',
      `Se requieren al menos ${requirements.minSurvivorSpawns} puntos de aparición de supervivientes.`,
      '$.spawns.survivors',
    )
  }
  survivorSpawns.forEach((spawn, index) => {
    checkPoint(spawn.x, spawn.z, `$.spawns.survivors[${index}]`, `Aparición de superviviente ${spawn.id}`)
    if (!Number.isFinite(spawn.yaw)) {
      error('map.spawn_yaw', 'La orientación de aparición debe ser numérica.', `$.spawns.survivors[${index}].yaw`)
    }
  })
  if (config.spawns?.killer) {
    checkPoint(config.spawns.killer.x, config.spawns.killer.z, '$.spawns.killer', 'Aparición del asesino')
  } else {
    error('map.killer_spawn', 'Falta la aparición del asesino.', '$.spawns.killer')
  }

  if (!config.generatorSlots?.length || config.generatorSlots.length < requirements.minGenerators) {
    error(
      'map.generators',
      `El mapa necesita al menos ${requirements.minGenerators} punto(s) de generador.`,
      '$.generatorSlots',
    )
  }
  config.generatorSlots?.forEach((slot, index) =>
    checkPoint(slot.x, slot.z, `$.generatorSlots[${index}]`, `Generador ${slot.id}`),
  )

  if (!config.exitGates?.length || config.exitGates.length < requirements.minExitGates) {
    error('map.exits', 'El mapa necesita al menos una puerta de salida.', '$.exitGates')
  }
  config.exitGates?.forEach((gate, index) => {
    checkPoint(gate.x, gate.z, `$.exitGates[${index}]`, `Salida ${gate.id}`)
    if (!Number.isFinite(gate.requiredGenerators) || gate.requiredGenerators < 0) {
      error('map.exit_requirement', 'requiredGenerators debe ser un número >= 0.', `$.exitGates[${index}]`)
    }
  })

  if (!config.structures?.length || config.structures.length < requirements.minStructures) {
    error('map.structures', 'El mapa necesita al menos una estructura.', '$.structures')
  }

  // Unique ids across every data collection, to keep network references stable.
  const ids = new Map<string, string>()
  const registerId = (id: string, path: string) => {
    if (!id || !ID_PATTERN.test(id)) {
      error('map.entity_id', `Id inválido "${id}".`, path)
      return
    }
    const previous = ids.get(id)
    if (previous) error('map.duplicate_id', `El id "${id}" ya existe en ${previous}.`, path)
    else ids.set(id, path)
  }

  config.structures?.forEach((structure, index) => {
    const path = `$.structures[${index}]`
    registerId(structure.id, path)
    if (!structure.label?.trim()) warn('map.structure_label', 'La estructura no tiene rótulo.', `${path}.label`)
    const rotation = snapRightAngle(structure.rotation)
    if (Math.abs(rotation - structure.rotation) > 0.001) {
      error(
        'map.structure_rotation',
        'Las estructuras deben rotar en múltiplos de 90° para que el collider AABB sea exacto.',
        `${path}.rotation`,
      )
    }
    if (!(structure.width > 0 && structure.depth > 0 && structure.height > 0)) {
      error('map.structure_size', 'Las dimensiones de la estructura deben ser positivas.', `${path}`)
    }
    checkFootprint(
      structure.x,
      structure.z,
      structure.width,
      structure.depth,
      structure.rotation,
      width,
      depth,
      path,
      error,
    )
  })

  const obstacleBoxes = config.obstacles?.map((obstacle, index) => {
    const path = `$.obstacles[${index}]`
    registerId(obstacle.id, path)
    if (!(obstacle.width > 0 && obstacle.depth > 0 && obstacle.height > 0)) {
      error('map.obstacle_size', 'Las dimensiones del obstáculo deben ser positivas.', path)
    }
    if (Math.abs(snapRightAngle(obstacle.rotation) - obstacle.rotation) > 0.001) {
      error(
        'map.obstacle_rotation',
        'Los obstáculos deben rotar en múltiplos de 90° para que el collider AABB sea exacto.',
        `${path}.rotation`,
      )
    }
    checkFootprint(
      obstacle.x,
      obstacle.z,
      obstacle.width,
      obstacle.depth,
      obstacle.rotation,
      width,
      depth,
      path,
      error,
    )
    return makeAABB(
      obstacle.id,
      obstacle.x,
      obstacle.z,
      snapRightAngle(obstacle.rotation) % 180 === 0 ? obstacle.width : obstacle.depth,
      snapRightAngle(obstacle.rotation) % 180 === 0 ? obstacle.depth : obstacle.width,
      obstacle.height,
    )
  }) ?? []

  config.fences?.forEach((fence, index) => {
    const path = `$.fences[${index}]`
    registerId(fence.id, path)
    checkPoint(fence.x1, fence.z1, `${path}.x1`, `Valla ${fence.id} (inicio)`)
    checkPoint(fence.x2, fence.z2, `${path}.x2`, `Valla ${fence.id} (fin)`)
    if (!(fence.height > 0)) error('map.fence_height', 'La valla necesita altura.', `${path}.height`)
    if (Math.abs(fence.x1 - fence.x2) > 0.001 && Math.abs(fence.z1 - fence.z2) > 0.001) {
      error(
        'map.fence_axis',
        'Las vallas deben ser horizontales o verticales para usar colliders AABB exactos.',
        path,
      )
    }
    if (Math.hypot(fence.x2 - fence.x1, fence.z2 - fence.z1) < 0.5) {
      warn('map.fence_short', 'La valla mide menos de 0.5 m.', path)
    }
  })

  config.lights?.forEach((light, index) => {
    const path = `$.lights[${index}]`
    registerId(light.id, path)
    checkPoint(light.x, light.z, path, `Luz ${light.id}`)
    if (!(light.intensity >= 0)) error('map.light_intensity', 'La intensidad debe ser >= 0.', path)
    if (light.kind === 'string') {
      if (!Number.isFinite(light.x2) || !Number.isFinite(light.z2)) {
        error('map.string_light', 'La luz de cadena necesita un segundo extremo.', path)
      } else {
        checkPoint(light.x2!, light.z2!, `${path}.x2`, `Luz ${light.id} (extremo)`)
      }
    }
  })

  config.generatorSlots?.forEach((slot, index) => registerId(slot.id, `$.generatorSlots[${index}]`))
  config.exitGates?.forEach((gate, index) => registerId(gate.id, `$.exitGates[${index}]`))
  survivorSpawns.forEach((spawn, index) => registerId(spawn.id, `$.spawns.survivors[${index}]`))
  if (config.spawns?.killer) registerId(config.spawns.killer.id, '$.spawns.killer')
  config.hideSpots?.forEach((spot, index) => registerId(spot.id, `$.hideSpots[${index}]`))
  config.itemSpawns?.forEach((spot, index) => registerId(spot.id, `$.itemSpawns[${index}]`))

  // Spawn points must not start inside solid scenery.
  const spawnChecks: Array<{ x: number; z: number; label: string; path: string }> = [
    ...survivorSpawns.map((s, i) => ({
      x: s.x,
      z: s.z,
      label: `Aparición de superviviente ${s.id}`,
      path: `$.spawns.survivors[${i}]`,
    })),
    ...(config.spawns?.killer
      ? [{ x: config.spawns.killer.x, z: config.spawns.killer.z, label: 'Aparición del asesino', path: '$.spawns.killer' }]
      : []),
  ]
  for (const spawn of spawnChecks) {
    for (const box of obstacleBoxes) {
      if (pointInsideAABB(spawn.x, spawn.z, box, 0.35)) {
        error('map.spawn_inside_obstacle', `${spawn.label} está dentro del obstáculo "${box.id}".`, spawn.path)
      }
    }
  }

  if (!config.theme?.fogColor) warn('map.theme', 'Falta el color de niebla; se usará el valor por defecto.', '$.theme')
  if (!config.audio?.ambience) warn('map.audio', 'Falta el identificador de ambiente sonoro.', '$.audio')

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues }
}

function checkFootprint(
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
  mapWidth: number,
  mapDepth: number,
  path: string,
  report: (code: string, message: string, path: string) => void,
) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    report('map.entity_position', 'La posición de la entidad no es numérica.', path)
    return
  }
  const quarterTurn = Math.abs(snapRightAngle(rotation) % 180) === 90
  const halfW = (quarterTurn ? depth : width) / 2
  const halfD = (quarterTurn ? width : depth) / 2
  if (halfW <= 0 || halfD <= 0) return
  if (
    x - halfW < -mapWidth / 2 ||
    x + halfW > mapWidth / 2 ||
    z - halfD < -mapDepth / 2 ||
    z + halfD > mapDepth / 2
  ) {
    report(
      'map.entity_out_of_bounds',
      `La huella de "${path}" sobresale de los límites físicos del mapa.`,
      path,
    )
  }
}

export function getPlayableBounds(config: MapConfig) {
  const { width, depth, playableMargin } = config.dimensions
  return {
    minX: -width / 2 + playableMargin,
    maxX: width / 2 - playableMargin,
    minZ: -depth / 2 + playableMargin,
    maxZ: depth / 2 - playableMargin,
  }
}
