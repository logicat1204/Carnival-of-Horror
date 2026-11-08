# Bitácora

Registro cronológico de decisiones y verificaciones. Las fechas son locales del entorno de desarrollo.

## 2026-11-02 — 01 · Arranque y decisiones de stack

- Se crea el proyecto en `carnival-of/` (Vite + React + TypeScript + Three.js).
- Se descarta React Three Fiber: la escena es imperativa y la simulación debe poder ejecutarse fuera de React.
- Se descarta Rapier: la colisión se resuelve con un modelo determinista propio, más fácil de replicar en servidor.
- Se aplaza Colyseus a la Fase 2 y se prohíbe simular multijugador o mostrar salas falsas.
- Se instalan `react`, `react-dom`, `three`, `vite`, `typescript`, `vitest` y tipos.

## 2026-11-02 — 02 · Capa compartida

- `shared/math.ts`: clamp, lerp, damp, normalización, ángulos, PRNG mulberry32 y snap a 90°.
- `shared/collision.ts`: AABB, círculo contra caja, resolución iterativa y límites.
- `shared/net/movement.ts`: `stepMovement` puro y determinista.
- `shared/stats.ts`: stats 1–100 y multiplicadores de velocidad, stun y destreza.
- `shared/constants.ts`: tick 60 Hz, límites de cámara, radios y velocidades.
- `shared/net/contracts.ts`: contratos de fase 2 (comandos, snapshots, eventos).

## 2026-11-02 — 03 · Mapa y mundo

- `map.config.json` de 96 × 96 m, 5 spawns de superviviente, spawn del asesino, 5 generadores y 2 salidas reservados.
- Validación de ids únicos, límites, huellas, rotaciones, vallas y spawns dentro de obstáculos.
- Escena procedural: carrusel, noria, gran carpa, casetas, puestos, vallas, cajas, barriles, luces, cielo, luna y escombros.
- `WorldBuilder` valida, construye, deriva colliders y genera la malla de depuración.
- Se ajusta el spawn del asesino a `{ x: 0, z: 21, yaw: 0 }` para encuadrar el recinto.

## 2026-11-02 — 04 · Sistemas de juego

- `GameLoop` de paso fijo con límite de catch-up.
- `Input` con pointer lock, teclas, rueda y `Alt` para paneo.
- Cámara FPS con crouch, FOV y head bob; cámara aérea con órbita, zoom y foco acotado.
- Oclusión selectiva de techos/toldos.
- Controladores de superviviente y asesino sobre la misma simulación.
- Cuatro bots con PRNG determinista, colisión y ruido aproximado.
- Audio procedural con Web Audio.

## 2026-11-02 — 05 · Interfaz

- Menú principal con narrativa, seis personajes originales, pestaña de asesino, ayuda y ajustes.
- HUD diferenciado para superviviente, asesino y depuración.
- Pausa, ajustes, overlays de carga/error/captura y toasts.
- Persistencia de ajustes en `localStorage`.
- Estilos completos de identidad de carnaval.

## 2026-11-02 — 06 · Primera verificación

- `npx tsc --noEmit`: pasa.
- `npm run build`: pasa.
- Se corrige un error de sintaxis CSS (`code) {`) que generaba warning de esbuild.
- Se corrige `PCFSoftShadowMap` (eliminado en Three.js 0.187) por `PCFShadowMap`; desaparece el warning en una carga limpia.
- Se detecta un fallo en los multiplicadores de stats: la fórmula solo cubría la mitad superior y llevaba el stat 1 a 0.65 en vez de 0.85. Se sustituye por interpolación por tramos con 50 neutral y extremos 0.85/1.05, 0.7/1.3 y 0.75/1.25.
- Se añaden 43 pruebas en 5 archivos: colisión, movimiento determinista, stats, personajes y validación de mapas.
- `npm test`: 5 archivos, 43 pruebas, todas pasan.

## 2026-11-02 — 07 · Smoke test de navegador

- Servidor Vite en `localhost:5173`.
- El menú renderiza; **Entrar al recinto** monta el canvas WebGL y el HUD de superviviente.
- El clic automatizado de captura no obtiene pointer lock (ventana no visible); la UI muestra el toast previsto y el juego continúa.
- `V` cambia el estado de rol, visible al abrir pausa; el HUD del asesino muestra altitud 27 m, ángulo 58°, foco (0, 21) y paneo 0/15 m.
- Pausa, ajustes, cambio de calidad a **Bajo** y cierre del modal funcionan sin errores de consola.
- Entrada como asesino desde el menú: funciona; HUD táctico y 4 bots.
- No se pudo capturar imagen ni validar visualmente oclusión/ruido/audio por limitaciones del entorno. Se registra como pendiente, no como verificado.

## 2026-11-02 — 08 · Documentación inicial

- Se crean `README.md`, `ESTADO_ACTUAL.md`, `ARQUITECTURA.md`, `BITACORA.md`, registro de funcionalidades y documentos de pruebas.
- Se declaran explícitamente las carencias de la Fase 1 y las verificaciones no realizadas.

## 2026-11-03 — 09 · Revisión del zoom del asesino

- El usuario valida la estética y pide que la cámara aérea sea poderosa sin ser omnisciente.
- Se sube la distancia mínima de 18 a **28 m**, el valor por defecto de 31 a **34 m** y se baja el paso de zoom de 2.4 a **2**; el máximo sigue en **52 m**.
- La relación máxima de acercamiento pasa de 2.9× a 1.86×. El mínimo queda por encima de los toldos (≈24 m).
- Se añaden 4 pruebas en `tests/camera.test.ts` para límites, paso y recentrado.
- Typecheck y pruebas de cámara: pasan.

## 2026-11-03 — 10 · Fase 2: colliders y protocolo compartidos

- Se extrae la derivación de colliders del mapa a `src/shared/maps/colliders.ts`; la escena y el servidor consumen las mismas funciones.
- Se mantiene la rotación de estructuras en múltiplos de 90° para que el AABB sea exacto.
- Se crea `src/shared/net/protocol.ts` con versión 2, mensajes tipados, saneado de perfiles, normalización de comandos y parseo defensivo.
- Se fija el modelo de red: servidor 60 Hz, comandos a 30 Hz y snapshots a 20 Hz.
- Se añaden pruebas de protocolo y de derivación de colliders.

## 2026-11-03 — 11 · Servidor autoritativo y salas

- Se instalan `ws`, `@types/ws`, `tsx` y `concurrently`.
- Se implementa `server/room.ts`: roles, anfitrión, preparado, inicio, simulación con `stepMovement`, snapshots, gracia de reconexión y traspaso de anfitrión.
- Se implementa `server/roomManager.ts`: códigos privados de 4 caracteres, tokens, reanudación y limpieza de salas.
- Se implementa `server/index.ts`: HTTP `/health`, WebSocket, validación de `hello`, enrutado de mensajes, broadcast y bucle de tick.
- Se decide **no usar Colyseus** en este slice: el protocolo propio tipado evita esquemas/codegen y mantiene la simulación determinista como única fuente de verdad. La lógica de sala es independiente del transporte.
- Pruebas de sala y protocolo: pasan.

## 2026-11-03 — 12 · Cliente de red, lobby y HUD

- `NetworkClient`: conexión, token en `sessionStorage`, ping, reconexión con backoff, callbacks de sala/inicio/snapshot/estado/aviso.
- `LobbyScreen`: crear/unirse por código, nombre, rol, personaje, roster, preparado, inicio del anfitrión, copiar código y estado de conexión.
- `App`: máquina de pantallas `menu | lobby | game` y sesión online estable.
- `Game`: predicción local, corrección por umbral de 0.6 m, creación/eliminación de jugadores remotos, entrada de red a 30 Hz y bloqueo de `V` en online.
- `RemotePlayer`: amortiguación de snapshots a 20 Hz y ruido aproximado de supervivientes que corren.
- `Hud`, `PauseMenu` y `GameScreen`: sala, latencia, tick, jugadores, overlays de reconexión y salida segura.
- Se añaden estilos de lobby, roster, badges de red y overlays.

## 2026-11-03 — 13 · Integración, pruebas y correcciones

- Smoke real con dos clientes WebSocket: crear sala, unirse, preparar, iniciar, mover a ambos roles y reconectar con token. Resultado: **SMOKE OK**.
- Se corrige un bug grave en `RoomManager.leave`: al salir un jugador del lobby se borraba la sala aunque quedaran otros. Ahora la sala solo se elimina si queda vacía o cerrada, y el anfitrión se transfiere.
- Se corrige una carrera de reconexión: el cierre tardío del socket antiguo ya no borra el socket nuevo ni desconecta al jugador reanudado.
- Se corrige el envío de `sprint`/`crouch` en modo asesino: el cliente los envía en `false` porque el controlador del asesino no los usa; antes podía desincronizar la velocidad autoritativa.
- Se corrige el lobby para que un error del servidor libere el estado `busy` y revierta un cambio de rol rechazado.
- Se evita seguir enviando comandos cuando la sesión online se declara cerrada.
- Se añaden pruebas de salida del lobby, traspaso de anfitrión y cierre tardío de socket.
- `npm test`: **9 archivos, 68 pruebas, todas pasan**.
- `npm run smoke`: **SMOKE OK** con 21 snapshots, movimiento autoritativo de superviviente y asesino, y reconexión.

## 2026-11-03 — 14 · Verificación de navegador y cierre de fase

- Se carga el cliente Vite en el navegador del harness. El título ya muestra **Fase 2**.
- Menú → **Salas Online** → crear sala: la conexión aparece como **Conectado** y se genera un código de 4 caracteres.
- Se une un segundo cliente WebSocket como asesino; el roster muestra ambos roles, ambos se preparan y el botón **Iniciar función** se habilita.
- Al iniciar, `GameScreen` se monta y el servidor mantiene la partida. Sin errores de consola.
- Se prueba además un código de sala inexistente: el servidor responde con el aviso correspondiente y el formulario vuelve a quedar disponible.
- La pestaña del harness no es visible: `requestAnimationFrame` queda suspendido y el canvas no llega a crearse. Por eso **no se valida visualmente** el frame online, el pointer lock, el audio ni la interpolación de remotos en esta sesión.
- La captura de pantalla sigue bloqueada por la misma limitación de visibilidad.
- Se actualizan README, estado, arquitectura, registro y documentos de pruebas con resultados reales y pendientes.

## 2026-11-07 — 15 · Fase 3: reglas de objetivos compartidas

- Se crea `src/shared/objectives.ts` sin dependencias de DOM ni Three.js para que cliente y servidor compartan las mismas reglas.
- Se fijan 5 generadores, 4 requeridos, reparación base de 22 s, apertura de salida de 12 s, radios de interacción/escape y límite de 5 minutos.
- La destreza del personaje aplica un multiplicador de x0.75 a x1.25 sobre reparación y apertura.
- Las salidas solo aparecen como objetivo cuando la energía está activa.
- El asesino suprime la interacción si está a menos de 5.5 m; no se añade combate.
- Se añaden pruebas puras para reparación, energía, apertura, escape, supresión y reloj.

## 2026-11-07 — 16 · Fase 3: autoridad de servidor y protocolo v3

- Se sube `NET_PROTOCOL_VERSION` a **3**.
- `NetInput` incorpora `interact`; `PlayerState` incorpora `action` y `escaped`; `MatchStart` y `NetSnapshot` incorporan `objectives`; `NetSnapshot` incorpora `result`.
- `CarnivalRoom` acumula reparaciones y aperturas por tick, aplica el multiplicador del personaje, bloquea la interacción si el asesino está cerca y termina la partida al cruzar una salida o al expirar el reloj.
- Se marca `escaped` y se detiene la simulación al terminar; el servidor envía un snapshot final con el resultado.
- La reconexión dentro de la gracia reenvía `match_started` y el último snapshot, incluido el resultado final si la partida ya terminó.
- Se añaden colliders de generadores a la derivación compartida y a la escena.
- Se amplía el smoke a protocolo 3 y a la comprobación de 5 generadores, 2 salidas y `result: null` durante la partida.

## 2026-11-07 — 17 · Fase 3: visuales, HUD y textos

- `ObjectiveVisuals` construye generadores, salidas y luces de estado procedurales.
- El HUD del superviviente muestra generadores (`0/4`), energía, tiempo restante, pips de progreso y el aviso `E` de reparación/apertura.
- El HUD del asesino muestra la presión de objetivos con el mismo estado de generadores y el tiempo restante.
- `GameScreen` añade el overlay de fin de partida con ganador, motivo, generadores reparados y duración.
- Menú, lobby, ayuda, pausa y título se actualizan a Fase 3 y versión 0.3.0.
- En entrenamiento local los bots siguen sin reparar generadores ni abrir salidas; solo el superviviente local contribuye.
- Se actualiza `package.json` y `package-lock.json` a **0.3.0**.

## 2026-11-07 — 18 · Fase 3: verificación real y límites

- `npm run typecheck`: pasa en cliente y servidor.
- `npm test`: **10 archivos, 73 pruebas, todas pasan**.
- `npm run build`: pasa; bundle **922.91 kB** y **251.51 kB** gzip; se mantiene el warning de chunk > 500 kB por Three.js.
- `npm run smoke`: **SMOKE OK**; sala `6QW8`, 21 snapshots, tick 63, superviviente movido 3.15 m en Z, asesino 4.17 m en X y reconexión `ebecb94a` reanudada.
- Navegador: menú Fase 3, lobby conectado, sala `E25C` creada, segundo cliente WebSocket como asesino, ambos preparados y partida iniciada.
- En la partida online se montó `GameScreen`, se creó un canvas de 1000×700 con contexto WebGL 2 y se mostró el panel de objetivos con `0/4`, «SIN ENERGÍA» y `04:52` restantes.
- El panel de depuración mostró red conectada, 2 jugadores reales y el tick del servidor avanzando.
- Al agotarse el reloj, el overlay mostró «El recinto se cerró», derrota, `0/4` generadores y duración `05:00`.
- **No verificado:** pointer lock, audio, captura de pantalla y recorrido visual completo de reparación/apertura/escape. El navegador rechazó el pointer lock y la herramienta de captura exige una pestaña visible.
- La reparación, apertura, escape y timeout están cubiertos por pruebas de sala autoritativa; no se afirma que el recorrido visual completo esté validado.

## Decisiones abiertas

1. Validar visualmente la partida online en una ventana real con dos o cinco clientes, incluido el recorrido completo de reparación, apertura y escape.
2. Medir latencia/jitter y decidir si la amortiguación simple es suficiente.
3. Decidir si se mantiene el servidor WS propio o se migra a Colyseus antes de que crezcan las reglas.
4. Diseñar la Fase 4: combate, salud, daño, derribo, curación y eliminación.

## Pendiente para la próxima sesión

- Abrir el juego en una ventana visible y validar pointer lock, audio, oclusión, anillos de ruido y jugadores remotos con capturas.
- Recorrer en navegador una partida completa: reparar 4 generadores, abrir una salida y escapar.
- Medir FPS/draw calls en hardware objetivo.
- Probar una partida real con 5 clientes y una desconexión de red.
- Iniciar la Fase 4 sobre las reglas autoritativas actuales.
