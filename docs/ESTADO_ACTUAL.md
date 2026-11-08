# Estado actual

**Proyecto:** Carnival of…  
**Versión:** 0.3.0  
**Fase:** 3 — Generadores, energía, salidas y fin de partida  
**Fecha de corte:** 2026-11-07  
**Entorno validado:** Windows, Node.js 24.14.0, npm 11.9.0, Vite 7.3.7, React 19.3.1, Three.js 0.187.0, TypeScript 5.9.3.

## Resumen

La Fase 3 añade el primer **bucle de objetivos completo** sobre la red autoritativa de la Fase 2. Los supervivientes reparan 4 de los 5 generadores manteniendo `E`, el recinto obtiene energía, las dos salidas se vuelven interactuables, una compuerta abierta permite escapar y la partida termina con un resultado autoritativo. El asesino puede suprimir una interacción acercándose a menos de 5.5 m, sin combate. Si el reloj de 5 minutos llega a cero, gana el asesino.

El cliente y el servidor comparten las reglas puras en `src/shared/objectives.ts`: radios, tiempos, multiplicador de destreza, energía, compuertas, escape y creación del resultado. El servidor sigue siendo la autoridad de posición, interacción y fin de partida. El entrenamiento local usa las mismas reglas, pero **solo el superviviente local contribuye**; los cuatro bots de prueba no reparan generadores ni abren salidas.

En línea **no hay bots que suplanten jugadores**: una sala necesita exactamente un asesino y al menos un superviviente; los huecos libres permanecen libres. Tampoco existe cambio de rol `V` durante una partida online.

Todavía no existen combate, daño, eliminaciones, inventario, escondites, curaciones ni habilidades del asesino. Los generadores y salidas ya no son datos reservados: son entidades funcionales del mapa.

## Estado por bloque

| Bloque | Estado | Verificación |
| --- | --- | --- |
| Menú principal, ayuda, selección de rol/personaje | Implementado | Typecheck + navegador (menú y lobby) |
| Lobby 1v4: crear/unirse por código, anfitrión, preparado, inicio | Implementado | Typecheck + navegador + smoke de red |
| Servidor autoritativo de movimiento | Implementado | Pruebas de sala + smoke de integración |
| Protocolo WebSocket v3 y validación de entrada | Implementado | Pruebas de protocolo + smoke |
| Snapshots 20 Hz, predicción local y corrección | Implementado | Smoke + revisión de código; frame online montado en navegador |
| Interpolación de jugadores remotos | Implementado | Revisión de código; verificación visual de movimiento remoto pendiente |
| Reconexión con gracia de 25 s | Implementado | Smoke de integración |
| Colliders compartidos cliente/servidor | Implementado | Pruebas + paridad por construcción |
| Generadores reparables con `E` | Implementado | 5 pruebas de objetivos + prueba de sala autoritativa |
| Energía de las salidas (4 generadores) | Implementado | Pruebas de objetivos + snapshot de red |
| Apertura de compuertas con `E` | Implementado | Prueba de sala autoritativa |
| Escape y victoria de supervivientes | Implementado | Prueba de sala autoritativa |
| Derrota por tiempo (5 minutos) | Implementado | Prueba de sala + overlay verificado en navegador |
| Supresión por proximidad del asesino (<5.5 m) | Implementado | Prueba de sala autoritativa |
| Visuales de generadores, salidas y luces | Implementado | Build + revisión de código; verificación visual 3D completa pendiente |
| HUD de objetivos, pips, reloj y aviso de interacción | Implementado | Navegador: panel 0/4, reloj y energía visibles en partida online |
| Overlay de fin de partida | Implementado | Navegador: timeout mostró «El recinto se cerró», derrota, 0/4 y 05:00 |
| Superviviente FPS: mirada, movimiento, sprint, crouch | Implementado | Unitarias + navegador de fases previas |
| Asesino: cuerpo, cámara aérea, oclusión y ruido | Implementado | Unitarias/revisión; verificación visual pendiente |
| Zoom táctico acotado (28–52 m) | Implementado | Pruebas de cámara + typecheck |
| Audio procedural | Implementado, no verificado | Requiere gesto real; bloqueado en automatización |
| Ajustes persistentes | Implementado | Navegador (fases previas) |
| Pausa, reanudar, salir de sala | Implementado | Typecheck + navegador (lobby) |
| Combate, daño, eliminaciones, objetos y escondites | Diferido | No implementado |

## Comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Pasa sin errores (cliente y servidor) |
| `npm test` | **10 archivos, 73 pruebas, todas pasan** |
| `npm run build` | Pasa; bundle **922.91 kB** y **251.51 kB** gzip; warning aceptado de chunk > 500 kB por Three.js |
| `npm run smoke` | **SMOKE OK**: sala, inicio, 21 snapshots, movimiento autoritativo de ambos roles, objetivos expuestos y reconexión |
| Navegador: menú → Salas → crear sala → segundo cliente WS → preparado → iniciar | Verificado: sala `E25C`, `GameScreen` montado, canvas WebGL 2 de 1000×700 |
| HUD online en partida | Verificado: `0/4` generadores, «SIN ENERGÍA», reloj `04:52` inicial y aviso de interacción `E` |
| Fin de partida por tiempo en navegador | Verificado: overlay «El recinto se cerró», derrota, `0/4`, duración `05:00` |
| Reparación completa, apertura de salida y escape | Verificado en la prueba de integración autoritativa de sala; **no** recorrido visual completo en navegador |
| Pointer lock, audio y captura de pantalla | **No verificado**: la pestaña del harness no es visible; el navegador bloqueó la captura del ratón y la herramienta de captura exige una ventana visible |

### Evidencia del smoke de red

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

El script arranca su propio servidor en el puerto 2599, conecta dos clientes WebSocket reales, crea la sala, inicia la partida, envía comandos durante 24 ticks y comprueba que el servidor mueve a ambos jugadores. También valida que el snapshot incluya 5 generadores, 2 salidas y `result: null` durante la partida. Después cierra el cliente superviviente y lo reconecta con su token.

### Evidencia de navegador

En la misma sesión se creó la sala `E25C` con el cliente de navegador como superviviente y un segundo cliente WebSocket como asesino. Ambos se prepararon, el anfitrión inició la función y el servidor pasó a `playing`.

Hechos observados en el DOM real:

```text
GameScreen montado
canvas 1000 x 700 · contexto WebGL 2 disponible
HUD: 0/4 generadores · SIN ENERGÍA · 04:52 RESTANTES
Panel de depuración: red connected · 2 jugadores · tick del servidor avanzando
Overlay final: El recinto se cerró · Derrota · 0/4 · Duración 05:00
```

La pestaña sigue sin ser visible para la herramienta de captura de pantalla. El pointer lock fue rechazado por el navegador y `document.pointerLockElement` permaneció `null`; por eso no se validaron audio, mirada con ratón ni el recorrido visual completo de reparación/escape.

## Decisiones relevantes

1. **Reglas de objetivos compartidas.** `src/shared/objectives.ts` no importa DOM ni Three.js. Cliente y servidor aplican los mismos tiempos, radios, energía y condiciones de fin; el servidor sigue siendo la autoridad.
2. **Interacción por mantener `E`, no por evento único.** El comando de red lleva un booleano `interact` en cada tick. El servidor acumula progreso mientras el jugador esté dentro del radio, no esté corriendo y el asesino no lo esté suprimiendo.
3. **Sin combate en esta fase.** La presión del asesino se resuelve con un radio de 5.5 m que bloquea la interacción. No hay daño ni derribo; esa es una decisión explícita para no presentar como funcional algo que no existe.
4. **Las salidas solo existen como objetivo tras la energía.** `findObjectiveTarget` no devuelve compuertas hasta que `powered` es verdadero. Esto evita abrir una salida con 0 generadores.
5. **El resultado final también se replica.** Al terminar, el servidor envía un snapshot final con `result` y conserva ese estado para una reconexión dentro de la gracia. El cliente muestra un overlay y bloquea la interacción posterior.
6. **Servidor WebSocket propio en lugar de Colyseus.** Se mantiene el protocolo tipado, la simulación determinista y la ausencia de esquemas/codegen. La lógica de sala y objetivos es independiente del transporte.
7. **Una única derivación de colliders.** `src/shared/maps/colliders.ts` incluye ahora los generadores. La escena y el servidor usan la misma geometría, evitando que un jugador pueda reparar desde una posición que el servidor considera dentro de una caja.
8. **Reconexión de transporte, no autenticación.** El token se guarda en `sessionStorage` y permite recuperar la plaza durante 25 s. No es una identidad segura ni un sistema de cuentas.

## Limitaciones y deuda técnica

1. **Sin combate ni eliminación.** No hay ataques, salud funcional, derribo, curación ni eliminación. El asesino solo puede interrumpir interacciones por proximidad y ganar por tiempo.
2. **Sin objetos, escondites ni habilidades.** No hay inventario, consumibles, herramientas ni poderes del asesino.
3. **Salas en memoria y un único proceso.** No hay persistencia, matchmaking público, TLS integrado, límites de tasa avanzados ni autenticación fuerte.
4. **Interpolación simple.** Los actores remotos se amortiguan hacia el último snapshot; no hay buffer temporal con interpolación exacta por tiempo del servidor.
5. **Corrección local por umbral.** No hay replay completo de comandos pendientes; el cliente corrige la posición cuando el error es visible.
6. **Colisión AABB estática.** Sin rampas, alturas jugables, física dinámica ni colisión entre actores.
7. **Un asesino fijo.** El prototipo del asesino y sus estadísticas son únicos; los arquetipos llegan en una fase posterior.
8. **Verificación visual incompleta.** El canvas y el HUD online se montaron y el timeout se vio en el DOM, pero el harness no permitió pointer lock, audio ni captura de pantalla. La reparación/escape visual de extremo a extremo sigue pendiente.
9. **Bundle grande.** Three.js produce ~922 kB minificados (~251 kB gzip); aceptable para el slice, pero conviene dividir la carga.
10. **Accesibilidad parcial.** Hay sensibilidad, FOV, inversión, volumen y reducción de movimiento; faltan remapeo y subtítulos.

## Siguiente objetivo

**Fase 4 — Combate, daño y eliminación:** convertir la presión de objetivos en un enfrentamiento real sin romper la autoridad del servidor. Antes de añadir objetos o habilidades conviene:

1. Validar visualmente la partida online en una ventana real: pointer lock, audio, reparación completa, apertura de salida, escape y movimiento remoto.
2. Medir latencia y estabilidad con 5 clientes reales.
3. Definir ataques, salud, derribo, curación y eliminación con reglas compartidas y pruebas de sala.
4. Decidir si se mantiene el transporte WS propio o se migra a Colyseus antes de que crezcan las reglas de combate.
