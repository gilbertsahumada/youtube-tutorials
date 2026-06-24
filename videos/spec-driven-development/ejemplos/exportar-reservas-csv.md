# Exportar reservas a CSV

> Ejemplo de spec llena para un feature chico y real (app de reservas en Next.js + Prisma). Lo que la hace útil no es ser larga: es que **define las decisiones que el agente, si no, inventa**.

## Contexto
- App de reservas en Next.js (App Router) + Prisma + Postgres; sesión por negocio.
- El listado vive en `src/app/(dashboard)/reservas/page.tsx`; la query en `src/data/reservas.ts` → `listReservas({ negocioId, desde, hasta })`, que **ya filtra por el `negocioId` de la sesión** (ese es el patrón a seguir).
- Hoy el dueño copia las reservas a mano para llevarlas a Excel; de ahí el export.

## Objetivo
Un botón "Exportar CSV" en el dashboard que descarga las reservas del negocio actual, respetando el rango de fechas activo. El CSV, sin que el agente invente nada:
- Columnas en este orden: `Fecha, Hora, Cliente, Teléfono, Servicio, Estado`.
- Fecha `YYYY-MM-DD`, hora `HH:mm`, en la **zona horaria del negocio** (no UTC).
- UTF-8 **con BOM** (si no, Excel rompe tildes y ñ); separador `,`; los campos con comas o comillas van entre comillas dobles (escape RFC 4180).
- Nombre del archivo: `reservas_<desde>_<hasta>.csv`.
- Rango sin reservas → descarga igual, solo con la fila de encabezados.

## Restricciones
- No tocar auth ni el modelo `Reserva` de Prisma.
- Sin dependencias nuevas: el CSV se arma a mano (es trivial), nada de librerías de CSV.

## Fuera de alcance
- Pantalla de reportes, gráficos, export a Excel o PDF.
- Exportar reservas de otro negocio (debe ser **imposible**, no solo "no incluido").

## Tareas

### T1: Serializador CSV
**Hacer:** función pura `toCsv(reservas)` con el orden de columnas, el formato de fecha/hora, el BOM y el escape de arriba.
**Archivos:** `src/data/csv.ts`, `src/data/csv.test.ts`
**Verify:** `npm test src/data/csv.test.ts` con 3 casos: filas normales; un cliente con coma en el nombre (debe quedar entre comillas); lista vacía (solo encabezados).

### T2: Endpoint de descarga protegido
**Hacer:** `GET /api/reservas/export?desde&hasta` → llama a `listReservas` con el `negocioId` de la sesión y responde el CSV con `Content-Type: text/csv; charset=utf-8` y `Content-Disposition: attachment; filename="reservas_<desde>_<hasta>.csv"`.
**Archivos:** `src/app/api/reservas/export/route.ts`
**Verify:** `curl` autenticado descarga el CSV correcto; con la sesión del negocio B, pedir el export nunca devuelve filas del negocio A.

### T3: Botón en el dashboard
**Hacer:** botón "Exportar CSV" en la toolbar del listado, que llama al endpoint con el rango de fechas activo.
**Archivos:** `src/app/(dashboard)/reservas/Toolbar.tsx`
**Verify:** Manual — rango 2026-03-01 a 2026-03-31, clic en Exportar → se descarga `reservas_2026-03-01_2026-03-31.csv` solo con reservas de marzo.

## Done (validación final)
- [ ] `npm test` y `npm run build` pasan.
- [ ] El CSV abre en Excel y en Google Sheets con tildes y ñ correctas.
- [ ] Por ninguna vía un negocio puede exportar reservas de otro.
- [ ] Un rango sin reservas descarga un CSV con solo encabezados (no rompe).
