import { describe, expect, it } from 'vitest'
import {
  NET_PROTOCOL_VERSION,
  normalizeInput,
  parseClientMessage,
  parseServerMessage,
  sanitizeName,
  sanitizeProfile,
  sanitizeRoomCode,
} from '../src/shared/net/protocol'

describe('network protocol', () => {
  it('accepts a valid survivor profile and forces the killer character', () => {
    expect(sanitizeProfile({ name: '  Ana  ', role: 'survivor', characterId: 'valeria' })).toEqual({
      name: 'Ana',
      role: 'survivor',
      characterId: 'valeria',
    })
    expect(
      sanitizeProfile({ name: 'Host', role: 'killer', characterId: 'anything' }),
    ).toEqual({ name: 'Host', role: 'killer', characterId: 'master_of_ceremonies' })
  })

  it('rejects invalid roles, unknown survivors and empty names', () => {
    expect(sanitizeProfile({ name: 'Ana', role: 'ghost', characterId: 'valeria' })).toBeNull()
    expect(sanitizeProfile({ name: 'Ana', role: 'survivor', characterId: 'nobody' })).toBeNull()
    expect(sanitizeName('')).toBe('Invitado')
    expect(sanitizeName('   ')).toBe('Invitado')
    expect(sanitizeName('  a  ')).toBe('Invitado')
  })

  it('normalizes room codes and rejects ambiguous or wrong lengths', () => {
    expect(sanitizeRoomCode(' abcd ')).toBe('ABCD')
    expect(sanitizeRoomCode('O123')).toBeNull()
    expect(sanitizeRoomCode('ABC')).toBeNull()
    expect(sanitizeRoomCode('ABCDE')).toBeNull()
  })

  it('clamps movement input and preserves the sequence', () => {
    const input = normalizeInput({
      seq: 12,
      forward: 42,
      right: -3,
      sprint: true,
      crouch: false,
      interact: true,
      yaw: 1.4,
      pitch: 9,
    })
    expect(input).toMatchObject({
      seq: 12,
      forward: 1,
      right: -1,
      sprint: true,
      crouch: false,
      interact: true,
      yaw: 1.4,
      pitch: Math.PI / 2,
    })
  })

  it('rejects malformed movement payloads', () => {
    expect(normalizeInput(null)).toBeNull()
    expect(normalizeInput({ seq: 1.5, forward: 0, right: 0, yaw: 0, pitch: 0 })).toBeNull()
    expect(normalizeInput({ seq: 1, forward: Number.NaN, right: 0, yaw: 0, pitch: 0 })).toBeNull()
    expect(normalizeInput({ seq: -1, forward: 0, right: 0, yaw: 0, pitch: 0 })).toBeNull()
  })

  it('parses client messages and drops malformed JSON', () => {
    expect(parseClientMessage('not json')).toBeNull()
    expect(parseClientMessage('{"type":"nope"}')).toBeNull()
    expect(parseClientMessage('[]')).toBeNull()
    expect(parseClientMessage('{"type":"ping","clientTimeMs":4}')).toEqual({
      type: 'ping',
      clientTimeMs: 4,
    })
    expect(
      parseClientMessage(`{"type":"hello","protocol":${NET_PROTOCOL_VERSION},"token":"abc"}`),
    ).toEqual({ type: 'hello', protocol: NET_PROTOCOL_VERSION, token: 'abc' })
  })

  it('parses server messages without trusting their payload shape', () => {
    expect(
      parseServerMessage(
        '{"type":"welcome","protocol":2,"clientId":"p1","token":"t1","resumed":true}',
      ),
    ).toEqual({
      type: 'welcome',
      protocol: 2,
      clientId: 'p1',
      token: 't1',
      resumed: true,
    })
    expect(parseServerMessage('{"type":"snapshot"}')).toBeNull()
    expect(parseServerMessage('{"type":"error","code":"x"}')).toEqual({
      type: 'error',
      code: 'x',
      message: 'Error de red.',
    })
  })
})
