# Resultados de pruebas — 2026-11-07

## Entorno

- Windows (win32), Node.js v24.14.0, npm 11.9.0.
- Vite 7.3.7, React 19.3.1, Three.js 0.187.0, Vitest 5.0.5, TypeScript 5.9.3.
- Navegador del harness (Chrome) sobre `http://localhost:5173` con Vite dev.
- Servidor autoritativo local en `ws://localhost:2567`; smoke aislado en el puerto 2599.

## 1. Typecheck

```text
npm run typecheck
```

Equivale a `tsc --noEmit` (cliente) y `tsc -p tsconfig.server.json` (servidor).

**Resultado:** pasa sin errores.

## 2. Unitarias e integración de sala

```text
npm test
```

**Resultado:**

```text
Test Files  10 passed (10)
     Tests  73 passed (73)
```

Desglose:

| Archivo | Pruebas | Resultado |
| --- | ---: | --- |
| `tests/characters.test.ts` | 5 | Pasa |
| `tests/collision.test.ts` | 11 | Pasa |
| `tests/stats.test.ts` | 7 | Pasa |
| `tests/movement.test.ts` | 7 | Pasa |
| `tests/map-validation.test.ts` | 13 | Pasa |
| `tests/camera.test.ts` | 4 | Pasa |
| `tests/protocol.test.ts` | 7 | Pasa |
| `tests/colliders.test.ts` | 4 | Pasa |
| `tests/room.test.ts` | 10 | Pasa |
| `tests/objectives.test.ts` | 5 | Pasa |

Cobertura relevante de Fase 3:

- Reparar generadores hasta completar 4 y activar la energía.
- No permitir la apertura de una salida sin energía.
- Abrir una compuerta y escapar al cruzarla, con resultado de victoria.
- Bloquear la reparación mientras el asesino está a menos de 5.5 m.
- Reanudar la reparación cuando el asesino se aleja.
- Terminar la partida con victoria del asesino al agotarse el reloj.
- Exponer `objectives` y `result` en los snapshots autoritativos.
- Mantener la reconexión, el traspaso de anfitrión y la salida del lobby sin regresiones.

## 3. Build de producción

```text
npm run build
```

**Resultado:** pasa.

```text
dist/index.html                 0.67 kB │ gzip:   0.42 kB
dist/assets/index-*.css        46.13 kB │ gzip:   9.90 kB
dist/assets/index-*.js        922.91 kB │ gzip: 251.51 kB │ map: 4,408.91 kB
```

**Warning aceptado:** chunk principal > 500 kB por Three.js. No es un fallo funcional; queda como deuda de code-splitting.

## 4. Smoke de integración real

```text
npm run smoke
```

El script arranca su propio servidor, conecta dos clientes WebSocket, prueba el flujo completo y comprueba los objetivos en el protocolo.

**Salida real:**

```text
room 6QW8
roster Host:killer, Survivor:survivor
start -38.00,32.00 | 0.00,21.00
snapshots 21 tick 63
survivor moved z 3.15
killer moved x 4.17
reconnect ebecb94a resumed
SMOKE OK
```

Comprobaciones:

| Comprobación | Resultado |
| --- | --- |
| Servidor levanta y responde `/health` con protocolo 3 | Pasa |
| Sala privada creada | Pasa |
| Superviviente se une con el código | Pasa |
| Roster de dos jugadores | Pasa |
| Ambos se preparan | Pasa |
| Inicio del anfitrión | Pasa |
| `match_started` incluye 5 generadores | Pasa |
| Snapshot incluye 2 salidas y `result: null` | Pasa |
| Snapshots del servidor | 21 recibidos; tick 63 |
| Movimiento autoritativo del superviviente | 3.15 m en Z |
| Movimiento autoritativo del asesino | 4.17 m en X |
| Reconexión con token | Pasa; mismo `clientId` (`ebecb94a…`) |
| Cierre limpio | Pasa |

## 5. Prueba de navegador

| Comprobación | Resultado real |
| --- | --- |
| Carga del menú | Pasa. Título **Carnival of… · Fase 3**; sin mojibake. |
| Navegación a **Salas Online** | Pasa. Estado **Conectado**. |
| Crear sala privada | Pasa. Sala `E25C`, código de 4 caracteres y roster propio como anfitrión. |
| Unión de un segundo cliente por WebSocket | Pasa. Roster con asesino `KillerBot` y superviviente `Tester`. |
| Preparado de ambos | Pasa. Ambos aparecen **Listo**. |
| Botón **Iniciar función** | Pasa. El servidor pasó a `playing` y envió `match_started`. |
| Montaje de `GameScreen` | Pasa: `game-shell`, `game-canvas` y `hud` presentes. |
| Canvas WebGL | Pasa: canvas de 1000×700 y contexto **WebGL 2** disponible. |
| HUD de objetivos | Pasa: `0/4` generadores, «SIN ENERGÍA», reloj `04:52` restante y aviso `E` de interacción. |
| Panel de depuración `F3` | Pasa: red `connected`, 2 jugadores reales, latencia 5–9 ms y tick del servidor avanzando. |
| Movimiento local por teclado | Parcial: la posición de depuración cambió de `-38.0, 32.0` a otras coordenadas; no se validó visualmente la cámara. |
| Fin de partida por tiempo | Pasa: overlay «El recinto se cerró», derrota, `0/4` generadores y duración `05:00`. |
| Reparación completa de 4 generadores | **No verificado visualmente**: cubierto por prueba de sala autoritativa. |
| Apertura de salida y escape | **No verificado visualmente**: cubierto por prueba de sala autoritativa. |
| Pointer lock | **No verificado**: el navegador rechazó la captura y `document.pointerLockElement` quedó `null`. |
| Audio | **No verificado**: requiere gesto y salida de audio real. |
| Movimiento remoto/interpolación visual | **No verificado** por la misma limitación. |
| Consola del navegador | Sin errores de aplicación durante menú, lobby y partida montada. |
| Captura de pantalla | No disponible: la herramienta exige una pestaña visible. |

El cliente WebSocket del asesino registró además el resultado autoritativo del servidor:

```text
result {"winner":"killer","reason":"timeout","escapedSurvivors":0,"elapsedMs":300000}
```

La prueba de navegador confirma el **menú, lobby, conexión, roster, inicio, canvas WebGL 2, HUD de objetivos, reloj, panel de depuración y overlay de timeout**. No confirma el recorrido visual completo de reparación/apertura/escape ni pointer lock/audio.

## 6. Incidencias y ajustes de integración

No se detectaron regresiones funcionales en la suite final. Se documentan estos ajustes de integración:

1. **Colliders de generadores:** se añadieron a `src/shared/maps/colliders.ts` para que cliente y servidor coincidan. Las pruebas colocan al superviviente junto al generador, no en su centro, porque teletransportar al actor dentro de la caja lo expulsa con momento.
2. **Protocolo v3:** cualquier cliente con protocolo 2 es rechazado. El smoke y el cliente se actualizaron al mismo tiempo.
3. **Snapshot final:** al terminar la partida se envía un snapshot con `result`; la reconexión dentro de la gracia recibe ese estado final en lugar de una partida congelada sin explicación.
4. **Interacción y sprint:** correr cancela la interacción; el servidor exige `interact: true` y `sprint: false` para acumular progreso.
5. **Pointer lock en automatización:** el clic programático no obtiene captura de ratón. La UI muestra el aviso previsto y el juego continúa; no se interpreta como fallo del juego.

## 7. Incidencias abiertas

- No se validó pointer lock, audio, movimiento continuo, oclusión, anillos de ruido ni interpolación de jugadores remotos en una ventana visible.
- No se recorrió visualmente la reparación de 4 generadores, la apertura de una salida y el escape; solo la prueba autoritativa de sala.
- No hay prueba de carga con 5 clientes ni de caos de red.
- No hay perfil de rendimiento en hardware objetivo. En la pestaña automatizada el render se limitó a ~4 FPS por falta de visibilidad, por lo que esa cifra no representa el rendimiento real.
- El bundle supera el umbral recomendado de Vite.
- Las salas son en memoria y el token no es autenticación fuerte.
- No hay combate, daño, objetos, escondites ni habilidades del asesino: pertenecen a la Fase 4.

## 8. Conclusión honesta

La Fase 3 está implementada y verificada en su capa lógica, de transporte y de interfaz principal: **73 pruebas en 10 archivos**, typecheck de cliente/servidor, build de producción y un smoke real con dos conexiones WebSocket, movimiento autoritativo, objetivos expuestos y reconexión. En navegador se verificaron el menú, el lobby, el inicio de partida, el canvas WebGL 2, el HUD de objetivos con reloj, el panel de depuración y el overlay de derrota por tiempo.

**No se afirma** que la experiencia visual completa de reparación, apertura de salida y escape esté verificada en navegador. Esa parte está cubierta por pruebas de sala autoritativa y queda como primer paso de la próxima sesión en una ventana visible.
