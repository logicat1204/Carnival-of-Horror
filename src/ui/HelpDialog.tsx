import { Modal } from './Modal'

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal eyebrow="Manual de la función" title="Cómo se juega" onClose={onClose} wide>
      <div className="help-grid">
        <section>
          <h3>Superviviente — primera persona</h3>
          <p>
            Repara cuatro de los cinco generadores para dar energía a las salidas y abre una
            compuerta. Mantén <kbd>E</kbd> junto a un generador o una salida; correr bloquea la
            interacción. Si el asesino se acerca demasiado, no podrás progresar. La Fase 3 todavía
            no tiene combate ni escondites.
          </p>
          <ul className="key-list">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Moverse</span></li>
            <li><kbd>Ratón</kbd><span>Mirar</span></li>
            <li><kbd>Shift</kbd><span>Correr (hace ruido)</span></li>
            <li><kbd>Ctrl</kbd> / <kbd>C</kbd><span>Agacharse</span></li>
            <li><kbd>E</kbd><span>Mantener para reparar / abrir</span></li>
            <li><kbd>V</kbd><span>Cambiar de rol (solo entrenamiento)</span></li>
          </ul>
        </section>
        <section>
          <h3>Asesino — cámara aérea</h3>
          <p>
            La cámara sigue tu cuerpo, pero puedes orbitar, acercarla y desplazar el foco dentro de
            un radio limitado. Los techos se vuelven translúcidos solo cuando bloquean tu foco. Los
            anillos naranjas son ruido aproximado, no posiciones exactas.
          </p>
          <ul className="key-list">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Mover al asesino</span></li>
            <li><kbd>Ratón</kbd><span>Orbitar la cámara</span></li>
            <li><kbd>Rueda</kbd><span>Alejar / acercar</span></li>
            <li><kbd>Alt</kbd> + <kbd>Ratón</kbd><span>Desplazar el foco</span></li>
            <li><kbd>R</kbd><span>Recentrar el foco</span></li>
          </ul>
        </section>
        <section>
          <h3>Pruebas y depuración</h3>
          <ul className="key-list">
            <li><kbd>Esc</kbd><span>Pausa</span></li>
            <li><kbd>F2</kbd><span>Ver colliders</span></li>
            <li><kbd>F3</kbd><span>Panel de depuración</span></li>
            <li><kbd>V</kbd><span>Alternar FPS / cámara aérea</span></li>
          </ul>
        </section>
        <section className="help-note">
          <h3>Estado real de esta entrega</h3>
          <p>
            Esta es la <strong>Fase 3: Generadores, energía y salidas</strong>. En entrenamiento
            local los otros supervivientes son <strong>bots de prueba</strong>: no reparan
            generadores ni abren salidas. En línea, el servidor es la autoridad de las
            interacciones y del resultado. No hay combate, daño ni eliminación todavía. Todo lo que
            aparece en pantalla funciona; lo que falta está documentado en <code>docs/</code>.
          </p>
        </section>
      </div>
    </Modal>
  )
}
