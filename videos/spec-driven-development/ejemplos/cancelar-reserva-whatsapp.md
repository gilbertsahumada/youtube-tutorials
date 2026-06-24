# Cancelar una reserva por WhatsApp

> Ejemplo de spec llena para un feature real de una app de reservas que funciona **toda por WhatsApp** (bot conversacional). Lo que la hace útil no es ser larga: es que **define las decisiones que el agente, si no, inventa**.

## Contexto
- App de reservas que opera por un bot de WhatsApp; el cliente se identifica por su número.
- Los mensajes entrantes llegan a un handler central (`src/bot/handler.ts`) que enruta según intención.
- Las reservas viven en el modelo `Reserva` (Prisma); cada una tiene `clienteTelefono`, `inicio`, `estado` (`confirmada` | `cancelada` | `completada`).
- Patrón a seguir: la lógica de negocio NO vive en el handler; va en casos de uso bajo `src/casos-uso/` y los repositorios en `src/data/`.

## Objetivo
Cuando el cliente manda "cancelar" por WhatsApp, el bot cancela su próxima reserva aplicando la política y le confirma por el mismo chat. Sin que el agente invente nada:
- **Identidad:** solo puede cancelar reservas asociadas a SU número. Nunca las de otro.
- **Cuál reserva:** la próxima `confirmada` a futuro. Si tiene más de una futura, el bot pregunta cuál (lista numerada).
- **Política de ventana:** no se puede cancelar con menos de **24h** de anticipación; en ese caso el bot responde el motivo y NO cancela.
- **Efecto:** la reserva pasa a `cancelada` y se libera el cupo de ese horario.
- **Confirmación:** mensaje de vuelta por WhatsApp ("Listo, cancelé tu reserva del lunes 14 a las 15:00").
- **Idempotencia:** si no tiene reservas futuras, o ya está cancelada/pasada, responde claro y no rompe ni cancela dos veces.

## Restricciones
- No tocar la integración de WhatsApp ni el enrutado de intenciones del handler (solo enchufar el caso de uso).
- No cambiar el modelo `Reserva` más allá de usar el campo `estado`.
- Sin dependencias nuevas.

## Fuera de alcance
- Reprogramar/mover una reserva (es otro flujo).
- Política de penalización o cobro por cancelar.
- Cualquier panel web (la app es solo WhatsApp).

## Tareas

### T1: Caso de uso `cancelarReserva`
**Hacer:** función pura `cancelarReserva({ telefono, ahora })` que aplica la política: busca la próxima reserva confirmada del teléfono, valida la ventana de 24h, la marca `cancelada` y libera el cupo. Devuelve un resultado tipado (cancelada / fuera-de-ventana / sin-reservas / elegir-entre-varias).
**Archivos:** `src/casos-uso/cancelar-reserva.ts`, `src/casos-uso/cancelar-reserva.test.ts`
**Verify:** `npm test src/casos-uso/cancelar-reserva.test.ts` con los casos: dentro de ventana (cancela + libera cupo); a menos de 24h (no cancela); sin reservas futuras; cliente con dos reservas futuras (pide elegir); segunda llamada sobre una ya cancelada (no re-cancela).

### T2: Enchufar la intención "cancelar" en el handler
**Hacer:** cuando el handler detecta la intención de cancelar, llama a `cancelarReserva` con el teléfono del remitente. No mete lógica de negocio en el handler.
**Archivos:** `src/bot/handler.ts`
**Verify:** un mensaje "cancelar" de un número con reserva futura dispara el caso de uso (test del handler con un mock del repositorio).

### T3: Mensajes de respuesta
**Hacer:** traducir cada resultado del caso de uso a un mensaje de WhatsApp claro (confirmación con fecha/hora, fuera de ventana, nada que cancelar, elegir entre varias).
**Archivos:** `src/bot/mensajes.ts`
**Verify:** Manual por WhatsApp — mandar "cancelar" con una reserva a >24h (llega confirmación y el cupo queda libre); repetir "cancelar" (responde que no hay nada que cancelar).

## Done (validación final)
- [ ] `npm test` y `npm run build` pasan.
- [ ] Un número solo puede cancelar SUS reservas, nunca las de otro.
- [ ] A menos de 24h no cancela y explica por qué.
- [ ] Cancelar libera el cupo de ese horario.
- [ ] Mandar "cancelar" sin reservas futuras no rompe el bot.
