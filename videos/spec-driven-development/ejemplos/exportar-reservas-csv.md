# Exportar reservas a CSV (por WhatsApp)

> Segundo ejemplo, **misma app de reservas por WhatsApp** que el de cancelar. El dueño quiere sacar sus reservas para llevarlas a Excel / pasárselas al contador. Lo útil no es que la spec sea larga: es que **define las decisiones que el agente, si no, inventa**.

## Contexto
- Misma app de reservas por WhatsApp (bot conversacional; el cliente se identifica por su número).
- Hay UN número dueño (el del negocio), distinto al de los clientes; vive en config como `OWNER_PHONE`.
- Las reservas viven en el modelo `Reserva` (Prisma): `clienteTelefono`, `clienteNombre`, `inicio`, `servicio`, `estado`.
- Patrón a seguir (igual que cancelar): la lógica de negocio va en `src/casos-uso/`, la lectura de datos en `src/data/`, y el handler solo enruta.

## Objetivo
Cuando el DUEÑO manda "exportar" (o "exportar marzo") por WhatsApp, el bot le responde con un archivo CSV de las reservas del rango, listo para abrir en Excel. Sin que el agente invente nada:
- **Quién:** solo el número dueño puede exportar. Un cliente que mande "exportar" recibe la misma respuesta que cualquier mensaje no entendido (ni se entera de que la función existe).
- **Qué rango:** "exportar" = mes actual; "exportar marzo" / "exportar 2026-03" = ese mes.
- **Columnas en este orden:** `Fecha, Hora, Cliente, Teléfono, Servicio, Estado`.
- **Formato:** fecha `YYYY-MM-DD`, hora `HH:mm`, en la **zona horaria del negocio** (no UTC).
- **Encoding:** UTF-8 **con BOM** (si no, Excel rompe tildes y ñ); separador `,`; los campos con comas o comillas van entre comillas dobles (escape RFC 4180).
- **Entrega:** el CSV se manda como **documento de WhatsApp** con nombre `reservas_<desde>_<hasta>.csv`.
- **Rango sin reservas:** igual responde, con un CSV de solo encabezados y un aviso ("no hay reservas en marzo").

## Flujo
**Secuencia** (orden temporal ↓ — comprimida; la completa con lifelines, a pedido):
```
1. Dueño → Handler: "exportar marzo"
2. Handler → exportarReservas(telefono, texto)
3. exportarReservas → Repo: listar reservas del rango
4. exportarReservas → toCsv(reservas)
5. Handler → Mensajes → Dueño: CSV como documento
```
**Flujo** (las decisiones que el agente, si no, inventa):
```
 mensaje "exportar [rango]"
        │
        ▼
 ¿lo manda el número dueño? ──no──▶ (cae en "no entendí", sin pistas)
        │ sí
        ▼
 parsear rango (default: mes actual)
        │
        ▼
 ¿hay reservas en el rango? ──no──▶ CSV solo encabezados + "no hay reservas en X"
        │ sí
        ▼
 armar CSV (BOM + escape) ──▶ enviar como documento
```
> Aprobar este diagrama = aprobar quién puede exportar, el rango por defecto, y qué pasa cuando no hay datos. Eso es lo que se confirma antes de escribir una línea.

## Restricciones
- No tocar la integración de WhatsApp ni el modelo `Reserva`.
- Sin dependencias nuevas: el CSV se arma a mano (es trivial), nada de librerías de CSV.

## Fuera de alcance
- Reportes con gráficos, export a Excel/PDF, totales o estadísticas.
- Que un cliente pueda exportar lo que sea (debe ser **imposible**, no solo "no incluido").

## Tareas

### T1: Serializador CSV
- **Hacer:** función pura `toCsv(reservas)` con el orden de columnas, el formato de fecha/hora, el BOM y el escape de arriba.
- **Archivos:** `src/data/csv.ts`, `src/data/csv.test.ts`
- **Verify:** `npm test src/data/csv.test.ts` con 3 casos: filas normales; un cliente con coma en el nombre (debe quedar entre comillas); lista vacía (solo encabezados).

### T2: Caso de uso `exportarReservas`
- **Hacer:** `exportarReservas({ telefono, texto, ahora })` que valida que `telefono` sea el dueño, parsea el rango del texto (default mes actual), pide las reservas a `src/data/` y devuelve `{ csv, nombreArchivo, vacio }`. Si no es el dueño, devuelve `no-autorizado`.
- **Archivos:** `src/casos-uso/exportar-reservas.ts`, `src/casos-uso/exportar-reservas.test.ts`
- **Verify:** `npm test src/casos-uso/exportar-reservas.test.ts` con: dueño sin argumento (mes actual); "exportar marzo" (ese mes); rango vacío (marca `vacio`); número de cliente (devuelve `no-autorizado`).

### T3: Enchufar en el handler + envío del documento
- **Hacer:** cuando el handler ve la intención "exportar" del número dueño, llama a `exportarReservas` y manda el CSV como documento de WhatsApp; si `vacio`, agrega el aviso; si `no-autorizado`, cae en el flujo de "no entendí".
- **Archivos:** `src/bot/handler.ts`, `src/bot/mensajes.ts`
- **Verify:** Manual por WhatsApp — desde el número dueño, "exportar marzo" → llega `reservas_2026-03-01_2026-03-31.csv` que abre en Excel con tildes ok; desde un número cliente, "exportar" → respuesta de "no entendí", sin archivo.

## Done (validación final)
- [ ] `npm test` y `npm run build` pasan.
- [ ] El CSV abre en Excel y en Google Sheets con tildes y ñ correctas.
- [ ] Solo el número dueño puede exportar; un cliente nunca recibe un CSV.
- [ ] Un rango sin reservas responde con un CSV de solo encabezados y el aviso, sin romper.
