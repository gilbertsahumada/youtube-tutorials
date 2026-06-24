# Recordar la reserva 24h antes (por WhatsApp)

> Tercer ejemplo, **misma app**. Lo que lo hace distinto a los otros dos: no lo dispara un mensaje del cliente, lo dispara el **reloj** (un job programado). Sirve para ver que una spec también ordena las tareas que corren solas — donde los casos borde (mandar dos veces, mandarle a alguien que canceló) son más fáciles de olvidar.

## Contexto
- Misma app de reservas por WhatsApp.
- Ya existe un runner de jobs programados en `src/jobs/` que corre cada 15 min (hay un job de ejemplo ahí que puedes copiar como patrón).
- Reservas en el modelo `Reserva` (Prisma): `inicio`, `estado`, `clienteTelefono`, `servicio`.

## Objetivo
Cada vez que corre el job, manda por WhatsApp un recordatorio a los clientes cuya reserva confirmada empieza en ~24h, **una sola vez**. Sin que el agente invente nada:
- **A quién:** reservas con `estado = confirmada` cuyo `inicio` cae en la ventana `[ahora+24h, ahora+24h+15min)` (la ventana = el intervalo del runner, para no saltarse ni repetir reservas).
- **Una sola vez:** si ya se mandó el recordatorio de esa reserva, no se manda de nuevo (idempotencia).
- **Si se cancela:** una reserva `cancelada` nunca recibe recordatorio, aunque caiga en la ventana.
- **Mensaje:** "Te recordamos tu reserva de <servicio> mañana a las <hora>. Si no puedes, responde 'cancelar'." — en la zona horaria del negocio.
- **Si no hay ninguna en la ventana:** el job corre y no hace nada (no es un error).

## Flujo
**Secuencia** (orden temporal ↓ — comprimida; la completa con lifelines, a pedido):
```
1. Runner (reloj) → recordar24h(ahora)
2. recordar24h → Repo: confirmadas en la ventana, sin recordar
3. recordar24h → Mensajes → Cliente: recordatorio (por cada una)
4. recordar24h → Repo: marcar "recordatorio enviado"
```
**Flujo** (las decisiones — acá viven los casos borde fáciles de olvidar):
```
 corre el job (cada 15 min)
        │
        ▼
 buscar confirmadas con inicio en [+24h, +24h+15min) y sin recordatorio
        │
        ▼
 ¿hay alguna? ──no──▶ termina (no hace nada)
        │ sí
        ▼
 por cada reserva: enviar recordatorio ──▶ marcar "recordada"
```
> Aprobar este diagrama = aprobar la ventana exacta, la idempotencia (no mandar dos veces) y que una cancelada no reciba nada. Eso es lo que se confirma antes de escribir una línea.

## Restricciones
- No tocar la integración de WhatsApp ni el modelo más allá de un dato de "recordatorio enviado".
- Sin dependencias nuevas; reusar el runner de `src/jobs/`.

## Fuera de alcance
- Recordatorios configurables (otras antelaciones, 1h antes, etc.).
- Reintentos si WhatsApp falla un envío (por ahora es best-effort: si una falla, sigue con las demás).

## Tareas

### T1: Marca de "recordatorio enviado"
- **Hacer:** agregar el dato para saber si una reserva ya fue recordada (campo `recordatorioEnviado` en `Reserva`, o tabla aparte — elige y justifica la decisión en la spec). Incluye la migración.
- **Archivos:** `prisma/schema.prisma`, la migración generada.
- **Verify:** `npx prisma migrate dev` corre; el dato existe y por defecto es "no enviado".

### T2: Caso de uso `recordar24h`
- **Hacer:** función `recordar24h({ ahora })` que pide las reservas confirmadas en la ventana y sin recordar, y devuelve la lista a notificar. **No envía nada todavía** (pura y testeable).
- **Archivos:** `src/casos-uso/recordar-24h.ts`, `src/casos-uso/recordar-24h.test.ts`
- **Verify:** `npm test src/casos-uso/recordar-24h.test.ts` con: reserva a 24h exactas (entra); a 26h (no entra todavía); a 24h pero cancelada (no entra); a 24h pero ya recordada (no entra).

### T3: Job que envía y marca
- **Hacer:** job en `src/jobs/` que llama a `recordar24h`, manda el mensaje por cada reserva y la marca como recordada. Si el envío de una falla, sigue con las demás.
- **Archivos:** `src/jobs/recordar-24h.ts`, `src/bot/mensajes.ts`
- **Verify:** Manual/integración — con una reserva de prueba a 24h, correr el job una vez (llega el WhatsApp y queda marcada); correrlo de nuevo (no re-envía).

## Done (validación final)
- [ ] `npm test` y `npm run build` pasan.
- [ ] Una reserva a ~24h recibe exactamente UN recordatorio, nunca dos.
- [ ] Una reserva cancelada no recibe recordatorio.
- [ ] El job sin reservas en la ventana corre sin error y sin mandar nada.
