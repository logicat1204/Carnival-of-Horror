# Plan de pruebas — Fase 3

## 1. Alcance

Cubre la capa compartida (movimiento, colisión, stats, personajes, mapas, colliders y reglas de objetivos), el protocolo de red v3, el ciclo de vida de salas, el servidor autoritativo real, la interacción con generadores y salidas, las condiciones de fin de partida y la interfaz de menú/lobby/HUD. También incluye comprobaciones de build y una lista de verificación manual para la partida online en ventana visible.

No cubre combate, daño, eliminaciones, inventario, escondites, habilidades del asesino, rendimiento en hardware objetivo ni pruebas de carga multijugador: esas funciones no pertenecen a esta fase.

## 2. Pruebas automatizadas

Ejecutar:

```bash
npm run typecheck
npm test
npm run build
npm run smoke
```

### Unitarias e integración de sala (`tests/`)

| Archivo | Qué valida | Casos |
| --- | --- | --- |
| `tests/collision.test.ts` | AABB, solape vertical, empuje lateral/esquina/interior, límites, cajas bajas, esquina cóncava, margen de punto | 11 |
| `tests/movement.test.ts` | Dirección, determinismo e inmutabilidad, diagonal sin ventaja, walk/sprint/crouch, frenado, muro y límites | 7 |
| `tests/stats.test.ts` | Redondeo/límites, neutralidad en 50, extremos 1/100, ventaja estrecha, monotonía, perfil de movimiento | 7 |
| `tests/characters.test.ts` | 6 ids únicos, datos completos, stats 1–100, paletas, variedad, fallback, stub del asesino | 5 |
| `tests/map-validation.test.ts` | Mapa real válido, conteos reservados, bounds, schema, ids duplicados, spawns, rotaciones, vallas, huellas, asesino ausente | 13 |
| `tests/camera.test.ts` | Distancia mínima/máxima, valor por defecto, paso de zoom, recentrado y límites de paneo | 4 |
| `tests/protocol.test.ts` | Perfiles válidos/inválidos, rol de asesino forzado, códigos, normalización de comandos con `interact`, JSON malformado, mensajes de servidor | 7 |
| `tests/colliders.test.ts` | Derivación determinista, ids únicos, spawns libres, anillo del carrusel, puertas de carpas y colliders de generadores | 4 |
| `tests/room.test.ts` | Anfitrión, límites de rol, inicio, tick autoritativo, secuencias, gracia/reconexión, traspaso de anfitrión, salida del lobby, socket tardío, tokens | 10 |
| `tests/objectives.test.ts` | Reglas puras, reparación, energía, apertura, escape, supresión por proximidad, reloj y timeout | 5 |

**Total esperado:** 73 pruebas en 10 archivos.

Cobertura específica de Fase 3:

- Reparar generadores hasta completar los 4 requeridos y activar la energía.
- No poder abrir una salida sin energía.
- Abrir una compuerta tras energía y escapar al cruzarla.
- Bloquear la reparación mientras el asesino está a menos de 5.5 m.
- Reanudar la reparación cuando el asesino se aleja.
- Terminar la partida con victoria del asesino al agotarse los 5 minutos.
- Exponer objetivos y resultado en el snapshot de red.

### Integración de red (`npm run smoke`)

El script `scripts/smoke-server.mjs`:

1. Arranca un servidor aislado en el puerto 2599 con `tsx`.
2. Espera `GET /health`.
3. Conecta un cliente asesino, hace `hello` con protocolo 3 y crea una sala.
4. Conecta un cliente superviviente y se une con el código.
5. Comprueba el roster de dos jugadores.
6. Marca a ambos como preparados e inicia la partida.
7. Comprueba que `match_started` incluye 5 generadores y que el snapshot incluye 2 salidas y `result: null`.
8. Envía comandos reales durante 24 ticks y recoge snapshots.
9. Verifica que el servidor movió al superviviente en Z y al asesino en X.
10. Cierra el socket del superviviente y lo reconecta con su token.
11. Verifica `welcome.resumed`, `match_started`, `room.you` y que la partida sigue.
12. Cierra los clientes y el servidor.

**Criterios de aceptación:**

- El proceso termina con `SMOKE OK`.
- Se reciben al menos 3 snapshots.
- Ambos jugadores se desplazan más de 0.2 m por acción del servidor.
- El snapshot contiene 5 generadores, 2 salidas y ningún resultado durante la partida.
- La reconexión devuelve el mismo `clientId`.

## 3. Pruebas manuales de navegador

Abrir `npm run dev:online` en una ventana visible con WebGL 2.

| # | Paso | Resultado esperado | Estado 2026-11-07 |
| --- | --- | --- | --- |
| B1 | Cargar `/` | Menú con narrativa, seis personajes y aviso de Fase 3 | Pasa |
| B2 | Abrir **Salas Online** | Lobby conectado al servidor; sin errores de consola | Pasa |
| B3 | Crear sala con nombre | Código de 4 caracteres, roster propio como anfitrión | Pasa |
| B4 | Unirse desde otra ventana con el código | Dos jugadores en el roster; roles visibles | Pasa (cliente WS de prueba) |
| B5 | Cambiar rol/personaje | El servidor valida el rol y actualiza el roster; un rol ocupado se rechaza | Revisión de código + unitarias |
| B6 | Marcar preparado a ambos | Ambos aparecen **Listo**; el inicio se habilita al anfitrión | Pasa |
| B7 | Iniciar función | `match_started` y montaje de `GameScreen` | Pasa |
| B8 | Canvas y HUD online | Canvas WebGL 2 montado y panel de objetivos visible | Pasa: 1000×700, `0/4`, «SIN ENERGÍA», `04:52` |
| B9 | Capturar ratón y audio | Pointer lock y audio activos | **No verificado**: el navegador bloqueó la captura y la pestaña no es visible |
| B10 | Mover superviviente | Predicción local y corrección desde snapshots | Parcial: el movimiento por teclado se reflejó en la posición de depuración; no se validó visualmente la cámara |
| B11 | Reparar un generador | Aviso `E`, barra de progreso y pip actualizado | **No verificado visualmente**; cubierto por prueba de sala |
| B12 | Completar 4 generadores | Energía activa y salidas interactuables | **No verificado visualmente**; cubierto por prueba de sala |
| B13 | Abrir una salida y escapar | Compuerta abierta, `escaped` y victoria de supervivientes | **No verificado visualmente**; cubierto por prueba de sala |
| B14 | Dejar expirar el reloj | Overlay de derrota del superviviente y victoria del asesino | Pasa: «El recinto se cerró», derrota, `0/4`, `05:00` |
| B15 | Mover asesino y orbitar | Cuerpo autoritativo, cámara aérea, zoom 28–52 m | **No verificado visualmente** |
| B16 | Observar jugador remoto | Interpolación suave a 20 Hz | **No verificado visualmente** |
| B17 | Cerrar y reabrir la pestaña durante la partida | Reconexión en 25 s con el mismo jugador | Smoke automatizado |
| B18 | Salir de la sala | `left_room`, tokens limpiados y retorno al menú | Navegador (lobby) + unitarias |
| B19 | `Esc` | Pausa; el asesino conserva la partida en servidor | Revisión de código |
| B20 | `F2` / `F3` | Colliders y panel de depuración | Pasa `F3` en partida online |
| B21 | Consola | Sin errores ni warnings de Three.js | Pasa en lobby/partida montada |
| B22 | Captura de pantalla | Imagen del frame 3D | **No disponible**: la herramienta exige una pestaña visible |

## 4. Casos negativos de red y objetivos

| Caso | Resultado esperado | Cobertura |
| --- | --- | --- |
| Perfil sin rol válido | `bad_profile`; no se crea jugador | `protocol.test.ts` + servidor |
| Personaje desconocido | `bad_profile` | `protocol.test.ts` |
| Código de 3/5 caracteres o con `I/O/0/1` | `bad_code` | `protocol.test.ts` |
| Sala inexistente | `room_not_found` | `room.test.ts` |
| Sala con 2 asesinos | `killer_taken` | `room.test.ts` |
| Quinto superviviente | `survivors_full` | `room.test.ts` |
| Inicio sin asesino/superviviente/preparados | `need_killer` / `need_survivor` / `not_ready` | `room.test.ts` |
| Comando con `seq` repetido o menor | Se ignora | `room.test.ts` |
| Comando con NaN/infinito o ejes enormes | Se rechaza o se recorta | `protocol.test.ts` |
| Abrir salida sin energía | La interacción no progresa | `objectives.test.ts` |
| Reparar con el asesino a <5.5 m | Progreso 0 y `action: null` | `objectives.test.ts` |
| Cruzar una salida cerrada | No hay escape | `objectives.test.ts` |
| Expirar los 5 minutos | Gana el asesino con motivo `timeout` | `objectives.test.ts` |
| Socket antiguo cierra tras reconectar | No expulsa al jugador reanudado | `room.test.ts` |
| Salida de un jugador del lobby | La sala sigue para los demás y se transfiere el host | `room.test.ts` |

## 5. Regresión mínima antes de cada entrega

1. `npm run typecheck`.
2. `npm test`.
3. `npm run build`.
4. `npm run smoke`.
5. Cargar el menú, crear una sala y comprobar que el lobby conecta.
6. En una ventana visible, entrar a la partida y verificar pointer lock, audio, movimiento local y jugador remoto.
7. Reparar 4 generadores, abrir una salida y escapar; comprobar el overlay de victoria.
8. Dejar expirar otra partida y comprobar el overlay de derrota.
9. Revisar la consola del navegador y los logs del servidor.

## 6. Pruebas no incluidas

- Carga con 20+ salas o 100+ conexiones.
- Caos de red simulado (pérdida, duplicación, jitter alto).
- Persistencia tras reiniciar el servidor.
- Seguridad de autenticación real, TLS o rate limiting.
- Combate, daño, eliminaciones, inventario y habilidades del asesino: Fase 4.
- Accesibilidad completa y remapeo de controles.
