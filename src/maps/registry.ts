import type { MapConfig } from '../shared/maps/types'
import type { MapModule } from './types'
import { buildCarnivalMap } from './carnival/map.scene'
import carnivalConfig from './carnival/map.config.json'

/**
 * Map registry. Adding a map means dropping a folder with a validated config
 * and a scene builder, then registering it here. Gameplay code never imports a
 * specific map.
 */
const MAPS: Record<string, MapModule> = {
  carnival: {
    config: carnivalConfig as unknown as MapConfig,
    build: buildCarnivalMap,
  },
}

export const DEFAULT_MAP_ID = 'carnival'

export function getMapModule(id: string = DEFAULT_MAP_ID): MapModule {
  const module = MAPS[id]
  if (!module) {
    throw new Error(
      `Mapa desconocido "${id}". Mapas disponibles: ${Object.keys(MAPS).join(', ')}.`,
    )
  }
  return module
}

export function listMaps(): Array<{ id: string; name: string }> {
  return Object.entries(MAPS).map(([id, module]) => ({ id, name: module.config.name }))
}
