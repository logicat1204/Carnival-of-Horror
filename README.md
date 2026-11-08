# Carnival of…

Juego web 3D de terror asimétrico **1 vs 4** ambientado en un carnaval abandonado. Esta entrega corresponde a la **Fase 3 — Generadores, energía, salidas y fin de partida**: además del entrenamiento local y las salas privadas autoritativas, ahora se puede reparar generadores, alimentar las salidas, abrir una compuerta y escapar antes de que se agote el reloj.

> **Estado:** Fase 3 implementada y verificada en su capa lógica, de transporte y de interfaz principal. `npm test` ejecuta **73 pruebas en 10 archivos**; typecheck, build y smoke de red pasan. En navegador se verificaron el menú, el lobby, el montaje del canvas WebGL 2, el panel de objetivos, el reloj y el overlay de fin de partida por tiempo. La reparación completa, la apertura de una salida y el escape están cubiertos por la prueba de integración autoritativa de sala; su recorrido visual completo con pointer lock y audio sigue pendiente por las limitaciones del navegador automatizado. No hay combate, daño, eliminación, objetos ni habilidades del asesino.

## Arranque rápido

Requisitos: Node.js 20.19+ (probado con Node 24.14.0) y un navegador con WebGL 2.

```bash
npm install
npm run dev:online
```

`dev:online` arranca a la vez el servidor autoritativo en `ws://localhost:2567` y Vite en `http://localhost:5173`. También se pueden usar dos terminales:

```bash
npm run server   # servidor Node/WebSocket
npm run dev      # cliente Vite
```

Abre `http://localhost:5173`. Para probar una partida completa:

1. Pulsa **Salas → Crear sala privada**. Se genera un código de 4 caracteres.
2. En otra ventana o pestaña, elige **Salas → Unirse** e introduce el código.
3. Cada jugador elige rol y personaje, y pulsa **Estoy preparado**.
4. El anfitrión pulsa **Iniciar función** cuando haya exactamente 1 asesino y entre 1 y 4 supervivientes.
5. El superviviente repara **4 de los 5 generadores** manteniendo `E`, busca una salida con energía, ábrela con `E` y cruza la compuerta.
6. El asesino gana si el reloj de **5 minutos** llega a cero antes de que escape al menos un superviviente.

La sala exige al menos un asesino y un superviviente; no se rellenan huecos con bots en línea.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run server` | Servidor autoritativo Node/WebSocket en el puerto 2567 |
| `npm run dev:online` | Servidor + cliente Vite a la vez |
| `npm run build` | Typecheck cliente/servidor + build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run typecheck` | `tsc --noEmit` del cliente y del servidor |
| `npm test` | Pruebas unitarias y de integración de sala con Vitest |
| `npm run test:watch` | Vitest en modo watch |
| `npm run smoke` | Prueba de integración real: arranca un servidor aislado, crea una sala, inicia partida, valida movimiento, objetivos y reconexión |

## Controles

| Contexto | Entrada | Acción |
| --- | --- | --- |
| Superviviente | `WASD` / flechas | Moverse |
| Superviviente | Ratón | Mirar (requiere pointer lock) |
| Superviviente | `Shift` | Correr |
| Superviviente | `Ctrl` / `C` | Agacharse |
| Superviviente | `E` | Mantener para reparar un generador o abrir una salida |
| Asesino | `WASD` | Mover el cuerpo por el recinto |
| Asesino | Ratón | Orbitar la cámara aérea |
| Asesino | Rueda | Zoom acotado (**28–52 m**; por defecto 34 m) |
| Asesino | `Alt` + ratón | Paneo del foco, limitado a 15 m |
| Asesino | `R` | Recentrar el foco |
| Ambos | `F2` | Mostrar/ocultar colliders |
| Ambos | `F3` | Mostrar/ocultar panel de depuración |
| Ambos | `Esc` | Pausa |
| Solo entrenamiento local | `V` | Cambiar de rol para probar ambas cámaras |

El zoom del asesino es deliberadamente conservador: la distancia mínima de 28 m mantiene la cámara por encima de los toldos y evita que se convierta en un visor de interiores a corta distancia.

## Qué incluye esta fase

- **Objetivos autoritativos:** 5 generadores en el mapa, 4 necesarios para dar energía; puertas de salida bloqueadas hasta completar la energía.
- **Interacción con `E`:** reparación base de 22 s por generador y apertura base de 12 s por salida. La destreza del personaje aplica un multiplicador de x0.75 a x1.25. Correr cancela la interacción.
- **Presión del asesino:** si el asesino está a menos de 5.5 m, la interacción del superviviente se suprime sin combate.
- **Fin de partida:** gana el equipo superviviente cuando al menos uno cruza una salida abierta; gana el asesino si expira el límite de 5 minutos. El servidor envía el resultado final y un snapshot de cierre.
- **Salas privadas 1v4:** código de 4 caracteres, anfitrión, lista de jugadores, selección de rol/personaje, estado de preparado e inicio coordinado.
- **Servidor autoritativo:** simulación a 60 Hz con el mismo `stepMovement` del cliente, validación de secuencias, límites de velocidad, colisiones, perfiles de personaje, reparaciones y resultado.
- **Protocolo v3:** comandos con `interact`; snapshots con `action`, `escaped`, `objectives` y `result`. La reconexión dentro de la gracia de 25 s recibe el estado final si la partida ya terminó.
- **Replicación:** snapshots a 20 Hz, predicción local del propio jugador, corrección cuando el error supera 0.6 m e interpolación por amortiguación de jugadores remotos.
- **Reconexión:** token de sesión en `sessionStorage`; el servidor conserva la plaza durante 25 segundos y reanuda la partida.
- **Visuales de objetivos:** generadores, salidas y luces de estado procedurales, con colliders compartidos entre cliente y servidor.
- **HUD de objetivos:** progreso de generadores, energía, tiempo restante, aviso de interacción y panel de presión para el asesino; overlay de resultado con ganador, generadores y duración.
- **Entrenamiento local:** el vertical slice de la Fase 1 sigue disponible con cuatro bots de prueba, cambio de rol y las dos cámaras. Los bots **no** reparan generadores ni abren salidas.
- **Mapa procedural:** carrusel, gran carpa, noria, casetas, vallas, cajas, barriles, luces y decoración low-poly, sin assets externos.
- **HUD y depuración:** estado de red, sala, latencia, tick del servidor, FPS, draw calls, triángulos, colliders y ruido aproximado.

## Arquitectura en una frase

React compone la interfaz; `Game` orquesta el render Three.js y una simulación de paso fijo a 60 Hz. El movimiento, las colisiones, los perfiles y las reglas de objetivos viven en `src/shared/` sin dependencias del navegador y se ejecutan también en `server/`.

La red usa un servidor WebSocket propio con un protocolo tipado (`src/shared/net/protocol.ts`). Se evaluó Colyseus, pero para este slice se prefirió evitar el coste de esquemas/codegen y mantener la simulación determinista como única fuente de verdad. La decisión está documentada en `docs/ARQUITECTURA.md`.

## Estructura

```text
carnival-of/
├─ server/            # servidor autoritativo: salas, transporte WS, objetivos, tick
├─ scripts/           # prueba de integración de red
├─ src/
│  ├─ shared/         # movimiento, colisión, stats, mapas, objetivos y protocolo
│  ├─ game/           # render, cámaras, controladores, entidades, audio y visuales
│  ├─ maps/           # datos y construcción procedural del mapa
│  ├─ net/            # cliente WebSocket, predicción y reconexión
│  └─ ui/             # menú, lobby, HUD, pausa, ajustes y fin de partida
├─ tests/             # Vitest de simulación, protocolo, salas, colliders y objetivos
└─ docs/              # estado, arquitectura, bitácora, registro y pruebas
```

## Configuración

Copia `.env.example` si necesitas cambiar la URL del servidor:

```env
VITE_SERVER_URL=ws://localhost:2567
PORT=2567
HOST=0.0.0.0
```

En producción, el cliente estático puede servirse por separado; el servidor autoritativo debe desplegarse con TLS (`wss://`) si el cliente se sirve por HTTPS.

## Documentación

- [Estado actual](docs/ESTADO_ACTUAL.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Bitácora](docs/BITACORA.md)
- [Registro de funcionalidades](docs/funcionalidades/registro.json)
- [Plan de pruebas](docs/pruebas/PLAN_PRUEBAS.md)
- [Resultados de pruebas](docs/pruebas/RESULTADOS.md)

## Limitaciones conocidas

- En línea se replican **movimiento, objetivos y resultado**. No hay combate, daño, eliminaciones, inventario, escondites ni habilidades del asesino.
- Los bots solo existen en el entrenamiento local; no se presentan como jugadores de red y no contribuyen a los objetivos.
- Las salas viven en memoria en un único proceso. No hay autenticación fuerte, matchmaking público, TLS integrado ni persistencia.
- La reconexión conserva la plaza 25 s; el token es una sesión de transporte, no una identidad segura.
- La colisión sigue siendo un resolvedor determinista de círculo contra AABB estáticos. No hay rampas ni física dinámica.
- La reparación completa, la apertura de salida y el escape están verificados en la capa autoritativa de sala, pero no se recorrieron visualmente de principio a fin en el navegador automatizado. El pointer lock, el audio y la captura de pantalla siguen bloqueados por la falta de una ventana visible.
- El bundle de Three.js supera los 500 kB minificados; se aceptará code-splitting cuando crezca la UI.
