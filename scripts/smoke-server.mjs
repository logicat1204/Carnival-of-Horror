import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const PORT = Number(process.env.CARNIVAL_SMOKE_PORT ?? 2599)
const SERVER_URL = `ws://127.0.0.1:${PORT}`
const TSX = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url))
const SERVER = fileURLToPath(new URL('../server/index.ts', import.meta.url))

const server = spawn(process.execPath, [TSX, SERVER], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', (chunk) => { serverLog += String(chunk) })
server.stderr.on('data', (chunk) => { serverLog += String(chunk) })
server.on('exit', (code) => {
  if (code && code !== 0) console.error(serverLog)
})

try {
  await waitForHealth()
  const killer = await connectClient('killer')
  await killer.opened
  killer.send({ type: 'hello', protocol: 3 })
  const killerWelcome = await killer.waitFor((message) => message.type === 'welcome')
  if (!killerWelcome.token) throw new Error('welcome without token')

  killer.send({
    type: 'create_room',
    profile: { name: 'Host', role: 'killer', characterId: 'master_of_ceremonies' },
  })
  const roomView = await killer.waitFor(
    (message) => message.type === 'room' && message.room.players.length === 1,
  )
  const code = roomView.room.code
  console.log('room', code)

  const survivor = await connectClient('survivor')
  await survivor.opened
  survivor.send({ type: 'hello', protocol: 3 })
  await survivor.waitFor((message) => message.type === 'welcome')
  survivor.send({
    type: 'join_room',
    code,
    profile: { name: 'Survivor', role: 'survivor', characterId: 'valeria' },
  })
  const roster = await survivor.waitFor(
    (message) => message.type === 'room' && message.room.players.length === 2,
  )
  console.log('roster', roster.room.players.map((player) => `${player.name}:${player.role}`).join(', '))

  killer.send({ type: 'ready', ready: true })
  survivor.send({ type: 'ready', ready: true })
  await killer.waitFor(
    (message) => message.type === 'room' && message.room.players.every((player) => player.ready),
  )
  killer.send({ type: 'start_match' })
  const match = await survivor.waitFor((message) => message.type === 'match_started')
  const survivorStart = match.match.players.find((player) => player.role === 'survivor')
  const killerStart = match.match.players.find((player) => player.role === 'killer')
  if (match.match.objectives.generators.length !== 5) {
    throw new Error('match does not expose five generators')
  }
  console.log(
    'start',
    `${survivorStart.x.toFixed(2)},${survivorStart.z.toFixed(2)}`,
    '|',
    `${killerStart.x.toFixed(2)},${killerStart.z.toFixed(2)}`,
  )

  for (let sequence = 1; sequence <= 24; sequence++) {
    survivor.send({
      type: 'input',
      input: {
        seq: sequence,
        forward: 1,
        right: 0,
        sprint: false,
        crouch: false,
        interact: false,
        yaw: 0,
        pitch: 0,
      },
    })
    killer.send({
      type: 'input',
      input: {
        seq: sequence,
        forward: 0,
        right: 1,
        sprint: false,
        crouch: false,
        interact: false,
        yaw: 0,
        pitch: 0,
      },
    })
    await sleep(25)
  }
  await sleep(250)
  const snapshots = survivor.messages.filter((message) => message.type === 'snapshot')
  const last = snapshots.at(-1)
  if (!last) throw new Error('no snapshots received')
  const survivorEnd = last.snapshot.players.find((player) => player.role === 'survivor')
  const killerEnd = last.snapshot.players.find((player) => player.role === 'killer')
  const survivorDelta = survivorStart.z - survivorEnd.z
  const killerDelta = killerEnd.x - killerStart.x
  console.log('snapshots', snapshots.length, 'tick', last.snapshot.tick)
  console.log('survivor moved z', survivorDelta.toFixed(2))
  console.log('killer moved x', killerDelta.toFixed(2))
  if (survivorDelta <= 0.2) throw new Error('authoritative survivor did not move')
  if (killerDelta <= 0.2) throw new Error('authoritative killer did not move')
  if (snapshots.length < 3) throw new Error('not enough snapshots')
  if (last.snapshot.objectives?.gates?.length !== 2) {
    throw new Error('snapshot does not expose two exits')
  }
  if (last.snapshot.result !== null) throw new Error('snapshot unexpectedly ended the match')

  const token = survivorWelcomeToken(survivor)
  survivor.ws.close()
  await sleep(120)
  const reconnected = await connectClient('survivor-reconnect')
  await reconnected.opened
  reconnected.send({ type: 'hello', protocol: 3, token })
  const resumed = await reconnected.waitFor(
    (message) => message.type === 'welcome' && message.resumed === true,
  )
  if (!resumed.clientId) throw new Error('reconnect did not restore player id')
  await reconnected.waitFor((message) => message.type === 'match_started')
  const resumedRoom = await reconnected.waitFor((message) => message.type === 'room')
  if (resumedRoom.room.you !== resumed.clientId) throw new Error('room.you mismatch')
  console.log('reconnect', resumed.clientId.slice(0, 8), 'resumed')

  survivor.send({ type: 'leave' })
  killer.send({ type: 'leave' })
  await sleep(100)
  reconnected.ws.close()
  killer.ws.close()
  console.log('SMOKE OK')
} finally {
  server.kill('SIGTERM')
}

function survivorWelcomeToken(client) {
  const welcome = [...client.messages].reverse().find((message) => message.type === 'welcome')
  if (!welcome?.token) throw new Error('survivor token not found')
  return welcome.token
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`)
      if (response.ok) return
    } catch {
      // Server still starting.
    }
    await sleep(120)
  }
  throw new Error(`server did not start:\n${serverLog}`)
}

function connectClient(label) {
  const ws = new WebSocket(SERVER_URL)
  const messages = []
  const waiters = []
  ws.on('message', (data) => {
    const message = JSON.parse(String(data))
    messages.push(message)
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue
      waiters.splice(waiters.indexOf(waiter), 1)
      waiter.resolve(message)
    }
  })
  const opened = new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  const waitFor = (predicate, timeout = 5000) =>
    new Promise((resolve, reject) => {
      const found = messages.find(predicate)
      if (found) return resolve(found)
      const waiter = { predicate, resolve }
      waiters.push(waiter)
      const timer = setTimeout(() => {
        const index = waiters.indexOf(waiter)
        if (index >= 0) waiters.splice(index, 1)
        reject(new Error(`${label}: timeout waiting for message`))
      }, timeout)
      timer.unref?.()
    })
  return {
    label,
    ws,
    messages,
    opened,
    waitFor,
    send: (message) => ws.send(JSON.stringify(message)),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
