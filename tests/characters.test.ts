import { describe, expect, it } from 'vitest'
import { getSurvivor, KILLER_STUB, SURVIVORS } from '../src/shared/characters'

describe('survivor roster', () => {
  it('ships exactly six original survivors with unique ids', () => {
    expect(SURVIVORS).toHaveLength(6)
    expect(new Set(SURVIVORS.map((character) => character.id)).size).toBe(6)
    expect(new Set(SURVIVORS.map((character) => character.name)).size).toBe(6)
  })

  it('gives every survivor complete, in-range authored data', () => {
    for (const character of SURVIVORS) {
      expect(character.id).toMatch(/^[a-z][a-z0-9_-]*$/)
      expect(character.name.trim().length).toBeGreaterThan(0)
      expect(character.surname.trim().length).toBeGreaterThan(0)
      expect(character.profession.trim().length).toBeGreaterThan(0)
      expect(character.bio.length).toBeGreaterThan(80)
      expect(character.playstyle.length).toBeGreaterThan(10)
      expect(character.age).toBeGreaterThanOrEqual(18)
      expect(character.age).toBeLessThanOrEqual(80)
      expect(character.build.height).toBeGreaterThan(1.4)
      expect(character.build.height).toBeLessThan(2.2)
      expect(character.build.shoulders).toBeGreaterThan(0)
      expect(character.build.shoulders).toBeLessThanOrEqual(1)

      for (const value of Object.values(character.stats)) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(100)
      }

      for (const color of Object.values(character.palette)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('covers both genders and varied builds', () => {
    expect(SURVIVORS.some((character) => character.gender === 'femenino')).toBe(true)
    expect(SURVIVORS.some((character) => character.gender === 'masculino')).toBe(true)
    expect(new Set(SURVIVORS.map((character) => character.build.hairStyle)).size).toBeGreaterThan(1)
    expect(new Set(SURVIVORS.map((character) => character.build.height)).size).toBe(6)
  })

  it('falls back to the first survivor for unknown ids', () => {
    expect(getSurvivor('valeria').id).toBe('valeria')
    expect(getSurvivor('does-not-exist')).toBe(SURVIVORS[0])
  })
})

describe('killer stub', () => {
  it('has a stable id and complete placeholder data', () => {
    expect(KILLER_STUB.id).toBe('master_of_ceremonies')
    expect(KILLER_STUB.description).toContain('Fase 1')
    for (const value of Object.values(KILLER_STUB.stats)) {
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})
