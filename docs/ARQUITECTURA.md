# Arquitectura

**Versión:** Fase 3 — Generadores, energía, salidas y fin de partida  
**Última actualización:** 2026-11-07

## 1. Principios

1. **Una sola simulación de movimiento.** Cliente y servidor ejecutan `stepMovement` con el mismo paso fijo, los mismos perfiles y los mismos colliders.
2. **El servidor es la autoridad.** Acepta comandos, valida secuencias y límites, simula movimiento y objetivos, y difunde el estado. El cliente predice para responder, pero se corrige.
3. **Las reglas de juego viven fuera de React.** Menú, lobby y HUD componen la interfaz; `Game`, `src/shared/objectives.ts` y `server/` son los dueños del bucle y del estado.
4. **Nada decorativo se presenta como funcional.** Los generadores y salidas ya son objetivos reales. Combate, daño, objetos y habilidades no existen y se declaran como diferidos.
5. **La red es un transporte, no un atajo.** El protocolo es explícito, validado y separable de la lógica de sala.

## 2. Capas

```text
┌─────────────────────────────────────────────────────────────┐
│ React: App, MainMenu, LobbyScreen, GameScreen, Hud, Pause   │
│ MatchEndOverlay, SettingsPanel, HelpDialog                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ eventos / props
┌──────────────────────────────▼──────────────────────────────┐
│ Game: render Three.js, cámaras, input, predicción, remotos  │
│ objetivos locales · HUD · resultado · NetworkClient          │
└──────────────────────────────┬──────────────────────────────┘
                               │ protocolo tipado (JSON/WS)
┌──────────────────────────────▼──────────────────────────────┐
│ server/: RoomManager → CarnivalRoom → tick autoritativo     │
│ movimiento · interacción · energía · escape · timeout       │
└──────────────────────────────┬──────────────────────────────┘
                               │ imports puros
┌──────────────────────────────▼──────────────────────────────┐
│ src/shared/: movement, collision, stats, characters,        │
│ maps, objectives, protocol                                   │
└─────────────────────────────────────────────────────────────┘
```

## 3. Stack

| Capa | Tecnología | Motivo |
| --- | --- | --- |
| Build | Vite 7 + TypeScript 5.9 | Arranque rápido, tipado estricto, build simple |
| UI | React 19 | Menú, lobby, HUD y overlays sin acoplar la simulación |
| Render | Three.js 0.187 | Control directo de escena, cámaras, materiales y post-proceso ligero |
| Servidor | Node.js + `ws` | Servidor autoritativo pequeño, sin esquemas/codegen |
| Pruebas | Vitest 5 | Unitarias de simulación, protocolo, salas, colliders y objetivos |
| Scripts | `tsx`, `concurrently` | Ejecutar TypeScript en Node y arrancar cliente+servidor |

No se usa React Three Fiber ni Rapier. R3F acoplaría el bucle al árbol React y Rapier introduciría un motor cuyas decisiones habría que replicar en servidor. La colisión actual es un resolvedor determinista de círculo contra AABB estáticos, suficiente y portable.

## 4. Bucle y frecuencias

| Elemento | Frecuencia | Responsable |
| --- | --- | --- |
| Simulación autoritativa | 60 Hz (`FIXED_DT`) | `CarnivalRoom.tickStep` |
| Envío de comandos | 30 Hz | `Game.updateNetworkSend` |
| Snapshots | Cada 3 ticks ≈ 20 Hz | `CarnivalRoom.maybeSnapshot` |
| Render | `requestAnimationFrame` | `GameLoop` |
| Ping | Cada 2 s | `NetworkClient` |

El servidor acumula como máximo 4 pasos por intervalo para no entrar en espiral si el event loop se retrasa. Los comandos se guardan como el último estado válido por jugador; si no llega uno nuevo en 300 ms, se aplica entrada idle. El temporizador de partida avanza dentro del tick autoritativo, no en el reloj del cliente.

## 5. Red

### 5.1 Transporte

- WebSocket en `ws://localhost:2567` por defecto.
- `VITE_SERVER_URL` permite apuntar a otro host; `PORT` y `HOST` configuran el servidor.
- Mensajes JSON pequeños, máximo 16 KiB por payload.
- `GET /health` devuelve estado, versión de protocolo, salas y jugadores.

### 5.2 Protocolo v3

Definido en `src/shared/net/protocol.ts`.

**Cliente → servidor**

```text
hello            { protocol, token? }
create_room      { profile }
join_room        { code, profile }
update_profile   { profile }
ready            { ready }
start_match      { }
input            { input: { seq, forward, right, sprint, crouch, interact, yaw, pitch } }
ping             { clientTimeMs }
leave            { }
```

**Servidor → cliente**

```text
welcome          { protocol, clientId, token, resumed }
room             { room: { code, phase, hostId, maxSurvivors, you, players } }
left_room        { }
match_started    { match: { roomCode, serverTick, serverTimeMs, players, objectives } }
snapshot         { snapshot: { tick, serverTimeMs, players, objectives, result } }
pong             { clientTimeMs, serverTimeMs }
error            { code, message }
session_expired  { message }
```

La validación vive en el servidor: `sanitizeProfile`, `sanitizeRoomCode` y `normalizeInput`. Las secuencias deben ser enteras, no negativas y estrictamente crecientes. Los ejes se recortan a `[-1, 1]`, el pitch a `[-π/2, π/2]` y el rol se limita a `survivor | killer`. `interact` se normaliza a booleano.

`PlayerState` incluye `action: 'generator' | 'gate' | null` y `escaped: boolean`. `MatchStart` y `NetSnapshot` incluyen el estado de objetivos: generadores con progreso, compuertas con progreso, energía, generadores requeridos y tiempo restante. `NetSnapshot.result` es `null` mientras la partida sigue y contiene ganador, motivo, supervivientes escapados y duración cuando termina.

### 5.3 Salas

`RoomManager` mantiene salas en memoria:

- Código de 4 caracteres sin `I`, `O`, `0` ni `1`.
- Máximo 5 jugadores: exactamente 1 asesino y hasta 4 supervivientes.
- El primer jugador es anfitrión; si se desconecta, el host pasa al siguiente conectado.
- Inicio: el anfitrión pulsa **Iniciar** cuando todos están preparados, hay 1 asesino y al menos 1 superviviente.
- En lobby, una desconexión libera el rol de inmediato. En partida, la plaza se conserva 25 s.
- El spawn se asigna por orden de entrada de los supervivientes y por el spawn de asesino del mapa.
- Al terminar, la sala pasa a `ended`, conserva el resultado y detiene la simulación.

### 5.4 Predicción, corrección e interpolación

**Jugador local**

1. `SurvivorController` o `KillerController` simula con `stepMovement`.
2. Cada 2 ticks envía el comando con su secuencia, ejes, sprint/crouch, `interact` y yaw.
3. Al recibir un snapshot, busca su propio estado.
4. Si el error de posición supera **0.6 m**, corrige posición y velocidad. Por debajo del umbral no se toca para evitar temblor.
5. La cámara y el yaw local no se reemplazan por el snapshot.

**Jugadores remotos**

`RemotePlayer` guarda el último estado autoritativo y amortigua posición y yaw hacia él con `damp`/`dampAngle`. El golpe de 20 Hz se suaviza en el render de 60 Hz. No es una interpolación con buffer temporal; es una solución deliberadamente simple para el slice.

**Ruido**

Los supervivientes remotos que corren emiten pings periódicos aproximados. El servidor no replica eventos de ruido todavía; el cliente los deriva de `sprinting` y `speed` del snapshot.

### 5.5 Reconexión

1. `welcome` entrega un token y un `clientId`.
2. El cliente guarda el token en `sessionStorage`.
3. Si el socket se cierra, `NetworkClient` reintenta con backoff (máximo 6 intentos).
4. El servidor busca el token; si la partida sigue y la gracia de 25 s no ha expirado, reasigna el socket, conserva el jugador y reenvía `match_started` y el último snapshot.
5. Si la partida ya terminó, el snapshot reenviado contiene el resultado final y el cliente muestra el overlay correspondiente.
6. Si la sesión expiró, responde `session_expired` y crea una sesión nueva. En partida, el cliente pasa a estado cerrado y ofrece volver al menú.

El token es una sesión de transporte, **no** una identidad autenticada.

## 6. Simulación compartida

### 6.1 Movimiento

`src/shared/net/movement.ts`:

- Entrada normalizada; diagonal sin bonus de velocidad.
- Aceleración mediante `damp`.
- Velocidad objetivo según caminar/correr/agacharse.
- Colisión resuelta con `resolveCircleAgainstWorld`.
- Estado resultante: posición, yaw, velocidad, velocidad real, flags de movimiento.

Perfiles en `src/shared/stats.ts`:

- Superviviente: multiplicadores por velocidad, físico y destreza; 50 es neutro.
- Asesino: velocidad base 4.35 m/s, aceleración propia.
- El servidor recalcula el perfil desde el `characterId`; nunca confía en velocidades enviadas por el cliente.

### 6.2 Colisión y colliders compartidos

`src/shared/maps/colliders.ts` deriva todos los AABB del mapa:

- Carpas con hueco de puerta real.
- Casetas con mostrador, pared trasera y laterales.
- Carrusel aproximado con 8 cajas de anillo + núcleo.
- Noria, taquilla, obstáculos y vallas.
- **Generadores**, con una caja de 1.9 × 1.6 m y 1.45 m de alto.
- Rotaciones de estructuras restringidas a múltiplos de 90°, de modo que el AABB sea exacto.

La escena (`map.scene.ts`) y el servidor llaman a las mismas funciones. Una prueba verifica que los IDs son únicos, que los spawns quedan libres y que el carrusel y las carpas conservan su forma.

### 6.3 Mapa

`map.config.json` se valida con `validateMapConfig` al arrancar cliente y servidor. Contiene:

- 5 spawns de superviviente y 1 de asesino.
- Estructuras, obstáculos, vallas, luces y decoración.
- 5 generadores y 2 salidas, ahora **funcionales**.
- Las dos salidas declaran `requiredGenerators: 4`.

### 6.4 Reglas de objetivos

`src/shared/objectives.ts` es puro y compartido por cliente y servidor:

| Regla | Valor |
| --- | --- |
| Generadores en el mapa | 5 |
| Generadores requeridos | 4 |
| Reparación base | 22 s (`GENERATOR_REPAIR_SECONDS`) |
| Apertura de salida base | 12 s (`GATE_OPEN_SECONDS`) |
| Radio de interacción con generador | 2.9 m |
| Radio de interacción con salida | 4.2 m |
| Radio de escape | 2.2 m |
| Radio de supresión del asesino | 5.5 m |
| Límite de partida | 5 minutos |
| Multiplicador de destreza | x0.75 – x1.25 |

Funciones principales:

- `createObjectiveState(source, timeLimitMs)`: crea generadores y salidas desde el mapa.
- `findObjectiveTarget(state, x, z)`: devuelve el objetivo útil más cercano; las salidas solo aparecen si `powered` es verdadero.
- `applyGeneratorRepair(state, id, seconds, rate)`: acumula progreso y marca el generador como reparado; refresca la energía.
- `applyGateOpen(state, id, seconds, rate)`: solo funciona con energía; acumula progreso hasta abrir.
- `advanceObjectiveTimer(state, seconds)`: descuenta el reloj y detecta el timeout.
- `isAtOpenGate(state, x, z)`: detecta el cruce de una salida abierta.
- `isInteractionSuppressed(killerX, killerZ, survivorX, survivorZ)`: bloquea la interacción si el asesino está a menos de 5.5 m.
- `createMatchResult(state, winner, reason, escapedSurvivors)`: construye el resultado con duración real.

El servidor aplica estas reglas por jugador en cada tick. La interacción requiere `interact: true`, no estar esprintando, estar dentro del radio y no estar suprimido. Correr cancela la interacción. Cuando un superviviente cruza una salida abierta se marca `escaped` y se termina la partida con victoria de supervivientes. Si el reloj llega a cero antes, gana el asesino.

## 7. Cliente

### 7.1 `Game`

Orquesta:

- `Viewport` + escena procedural.
- `GameLoop` fijo a 60 Hz.
- Cámaras FPS y aérea.
- Controladores locales, bots de entrenamiento o jugadores remotos.
- Audio, pings, oclusión, HUD y debug.
- Estado local de objetivos en entrenamiento y estado autoritativo en online.
- Visuales de generadores/salidas (`ObjectiveVisuals`).
- Resultado local o de red y overlay de fin de partida.

En modo online: desactiva el cambio de rol `V`, no crea bots, se suscribe a snapshots y envía `interact` a 30 Hz.

### 7.2 `NetworkClient`

- Conexión, hello, token y reconexión.
- Cola de mensajes parseados y callbacks de sala, inicio, snapshot, estado y aviso.
- Ping/latencia.
- Detección de sesión perdida: si había partida y el servidor responde con `resumed: false`, cierra el estado online.

### 7.3 UI

- `MainMenu`: entrenamiento local + acceso a salas; textos y versión de Fase 3.
- `LobbyScreen`: crear/unirse, nombre, rol, personaje, roster, preparado, inicio, copiar código y estado de conexión.
- `GameScreen`: monta `Game`, captura pointer lock/audio, overlays de pausa, red y fin de partida.
- `Hud`: modo, sala, jugadores, latencia, tick, salud, objetivo, generadores, energía, reloj, aviso de interacción, ruido y debug.
- `PauseMenu`: pausa, ajustes, salir de sala; oculta el cambio de rol en online.
- `MatchEndOverlay`: ganador, motivo, generadores reparados y duración.

## 8. Servidor

```text
server/
├─ index.ts        # HTTP /health + WebSocket, sesiones, broadcast, tick loop
├─ roomManager.ts  # registro de salas, códigos, tokens, reanudación
└─ room.ts         # estado de sala, roles, inicio, movimiento, objetivos y snapshots
```

`CarnivalRoom` es intencionadamente independiente del transporte. Las pruebas lo instancian directamente sin abrir sockets. `RoomManager` también es puro respecto a Node salvo la generación de UUID/códigos.

El servidor envía un snapshot final tras el fin de partida. Ese snapshot se conserva para una reconexión dentro de la gracia, de modo que un jugador que vuelve ve el resultado en lugar de una partida congelada sin explicación.

## 9. Configuración y despliegue

Desarrollo:

```bash
npm run dev:online
# o
npm run server
npm run dev
```

Producción:

```bash
npm run build
npm run server
npm run preview
```

El servidor autoritativo y el cliente estático pueden desplegarse por separado. Si el cliente se sirve por HTTPS, el servidor debe exponerse como `wss://` (por ejemplo, detrás de un proxy inverso). Las salas son en memoria: reiniciar el proceso pierde las partidas.

## 10. Pruebas

| Archivo | Cobertura |
| --- | --- |
| `tests/collision.test.ts` | Resolución círculo/AABB, límites y deslizamiento |
| `tests/movement.test.ts` | Paso fijo, aceleración, sprint/crouch, diagonal |
| `tests/stats.test.ts` | Multiplicadores y extremos |
| `tests/characters.test.ts` | Datos de los seis supervivientes |
| `tests/map-validation.test.ts` | Validación del mapa y datos reservados |
| `tests/camera.test.ts` | Límites del zoom aéreo |
| `tests/protocol.test.ts` | Sanitización, parseo y validación |
| `tests/room.test.ts` | Roles, inicio, tick, secuencias, host y reconexión |
| `tests/colliders.test.ts` | Derivación compartida, spawns, puertas y generadores |
| `tests/objectives.test.ts` | Reglas puras, reparación, energía, salidas, supresión, escape y timeout |
| `npm run smoke` | Servidor real, dos sockets, partida, movimiento, objetivos expuestos y reconexión |

## 11. Deuda y evolución

1. Validar visualmente la partida online con una ventana real y 5 clientes.
2. Medir latencia/jitter y decidir si la amortiguación es suficiente.
3. Añadir buffer de snapshots e interpolación temporal exacta.
4. Considerar replay de comandos pendientes para reconciliación fina.
5. Migrar o no a Colyseus antes de que crezcan las reglas de juego.
6. Añadir autenticación, límites de tasa, TLS y persistencia de salas si se despliega públicamente.
7. Implementar en Fase 4 combate, salud, daño, derribo, curación, eliminación, objetos y habilidades del asesino.
