import type { CoreStats } from './stats'

export type Gender = 'femenino' | 'masculino'

export interface CharacterPalette {
  primary: string
  secondary: string
  skin: string
  hair: string
  accent: string
}

export interface CharacterBuild {
  /** Total height in meters. Affects the avatar's proportions, not hitboxes. */
  height: number
  /** 0..1 shoulder width factor for the low-poly silhouette. */
  shoulders: number
  hairStyle: 'long' | 'short' | 'curly' | 'buzz' | 'bun'
  accessories: Array<'glasses' | 'cap' | 'bandana' | 'toolbelt' | 'backpack' | 'headphones'>
}

export interface SurvivorCharacter {
  id: string
  name: string
  surname: string
  profession: string
  gender: Gender
  age: number
  origin: string
  bio: string
  playstyle: string
  stats: CoreStats
  palette: CharacterPalette
  build: CharacterBuild
}

/**
 * Six original survivors. Stats are authored data; advantages are derived by
 * shared/stats.ts and are intentionally restrained.
 */
export const SURVIVORS: readonly SurvivorCharacter[] = [
  {
    id: 'valeria',
    name: 'Valeria',
    surname: 'Ocampo',
    profession: 'Ingeniera de atracciones',
    gender: 'femenino',
    age: 29,
    origin: 'Ciudad de México',
    bio: 'Mantuvo viva la maquinaria del carnaval durante siete temporadas. Conoce cada engranaje, cada cable pelado y cada puerta que nadie más sabe abrir.',
    playstyle: 'Reparaciones rápidas. Frágil en una persecución directa.',
    stats: { speed: 55, physique: 35, dexterity: 95 },
    palette: {
      primary: '#1f5d5b',
      secondary: '#d9b35c',
      skin: '#b97a54',
      hair: '#241a17',
      accent: '#8c2f39',
    },
    build: { height: 1.7, shoulders: 0.5, hairStyle: 'bun', accessories: ['toolbelt'] },
  },
  {
    id: 'luna',
    name: 'Luna',
    surname: 'Ferreira',
    profession: 'Atleta de pista',
    gender: 'femenino',
    age: 24,
    origin: 'Montevideo',
    bio: 'Llegó al recinto persiguiendo una luz que se movía entre las carpas. Corre más rápido de lo que piensa y todavía no ha decidido si eso es una virtud.',
    playstyle: 'La más rápida del grupo. Aprende despacio y no sabe reparar bajo presión.',
    stats: { speed: 95, physique: 50, dexterity: 30 },
    palette: {
      primary: '#b34a1e',
      secondary: '#efe6d5',
      skin: '#8c5a3c',
      hair: '#1a1512',
      accent: '#e0b15c',
    },
    build: { height: 1.68, shoulders: 0.55, hairStyle: 'curly', accessories: ['headphones'] },
  },
  {
    id: 'camila',
    name: 'Camila',
    surname: 'Rivas',
    profession: 'Mecánica de feria',
    gender: 'femenino',
    age: 33,
    origin: 'Valparaíso',
    bio: 'Arregla generadores con la misma calma con la que desarma una trampa. Guarda una llave inglesa en el bolsillo y una lista de nombres en la memoria.',
    playstyle: 'Equilibrada. Puede defender a un compañero o terminar una reparación.',
    stats: { speed: 65, physique: 65, dexterity: 75 },
    palette: {
      primary: '#4f5730',
      secondary: '#b98b52',
      skin: '#a66a45',
      hair: '#3a241a',
      accent: '#8c2f39',
    },
    build: { height: 1.66, shoulders: 0.6, hairStyle: 'short', accessories: ['bandana', 'toolbelt'] },
  },
  {
    id: 'axel',
    name: 'Axel',
    surname: 'Ndiaye',
    profession: 'Exjugador de rugby',
    gender: 'masculino',
    age: 27,
    origin: 'Dakar',
    bio: 'Vino a buscar a su hermana y se quedó atrapado cuando las puertas se cerraron. Empuja barricadas como si fueran muebles y no sabe cuándo detenerse.',
    playstyle: 'Fuerte y veloz en línea recta. Las tareas técnicas le cuestan.',
    stats: { speed: 85, physique: 85, dexterity: 25 },
    palette: {
      primary: '#1f3d6e',
      secondary: '#d9b35c',
      skin: '#5b3a28',
      hair: '#12100e',
      accent: '#c94f3d',
    },
    build: { height: 1.9, shoulders: 0.9, hairStyle: 'buzz', accessories: ['backpack'] },
  },
  {
    id: 'noah',
    name: 'Noah',
    surname: 'Lindqvist',
    profession: 'Estudiante de ingeniería',
    gender: 'masculino',
    age: 21,
    origin: 'Gotemburgo',
    bio: 'Documentaba leyendas urbanas para su tesis. La última entrada de su cuaderno está fechada la noche que entró al carnaval, y la letra se vuelve ilegible.',
    playstyle: 'Excelente con mecanismos y pruebas de habilidad. Poco resistente.',
    stats: { speed: 60, physique: 40, dexterity: 90 },
    palette: {
      primary: '#8a6a22',
      secondary: '#3d3a35',
      skin: '#e0b191',
      hair: '#6b4a2f',
      accent: '#2c5f6e',
    },
    build: { height: 1.8, shoulders: 0.55, hairStyle: 'short', accessories: ['glasses'] },
  },
  {
    id: 'dante',
    name: 'Dante',
    surname: 'Bianchi',
    profession: 'Rescatista voluntario',
    gender: 'masculino',
    age: 41,
    origin: 'Nápoles',
    bio: 'Entró cuando escuchó gritos que nadie más oyó. Sostiene puertas, carga heridos y habla poco. La feria parece reconocerlo.',
    playstyle: 'El más resistente. Golpes contundentes, pero lento y torpe con herramientas.',
    stats: { speed: 55, physique: 95, dexterity: 45 },
    palette: {
      primary: '#26313d',
      secondary: '#c44a3b',
      skin: '#c58c65',
      hair: '#2b211d',
      accent: '#d9b35c',
    },
    build: { height: 1.93, shoulders: 0.95, hairStyle: 'buzz', accessories: ['backpack'] },
  },
] as const

export function getSurvivor(id: string): SurvivorCharacter {
  return SURVIVORS.find((character) => character.id === id) ?? SURVIVORS[0]
}

/** Placeholder killer used in Phase 1. Archetypes and abilities arrive in Phase 4. */
export interface KillerStub {
  id: string
  name: string
  title: string
  description: string
  palette: CharacterPalette
  stats: { speed: number; physique: number; dexterity: number }
}

export const KILLER_STUB: KillerStub = {
  id: 'master_of_ceremonies',
  name: 'El Maestro de Ceremonias',
  title: 'Anfitrión del recinto',
  description:
    'Una figura alta con levita raída y una máscara de porcelana agrietada. Observa el carnaval desde arriba, como si dirigiera una función que solo él comprende. Modelo provisional de la Fase 1; los tres arquetipos jugables se implementarán en la Fase 4.',
  palette: {
    primary: '#2a1720',
    secondary: '#8c1c2b',
    skin: '#d8c9b0',
    hair: '#0e0c0d',
    accent: '#e0b15c',
  },
  stats: { speed: 50, physique: 70, dexterity: 40 },
}
