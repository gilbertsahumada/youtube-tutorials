# Serializar reservas a CSV

## Contexto

La aplicación exporta reservas para abrirlas en Excel. `src/csv.js` contiene una función pura `toCsv(reservas)` y no usa dependencias externas.

## Objetivo

Generar un CSV UTF-8 con BOM y columnas `Fecha,Cliente,Servicio`.

## Restricciones

- No agregar dependencias.
- Conservar el orden de las columnas.
- Escapar campos según CSV: duplicar comillas y envolver entre comillas cuando contengan coma, comillas o salto de línea.

## Convención de tareas

Cada tarea contiene exactamente un campo `Verify`. Un valor entre backticks es un comando que debe existir en el proyecto y ejecutarse desde la raíz. Si falta o es ambiguo, la tarea no puede verificarse.

## Tareas

### T1: Serializador CSV

- **Hacer:** implementar `toCsv(reservas)` con BOM, encabezado y escape correcto.
- **Archivos:** `src/csv.js`, `test/csv.test.js`.
- **Verify:** `npm test`.

## Done

- [ ] Los tres tests pasan.
- [ ] La salida incluye BOM.
- [ ] Una lista vacía conserva el encabezado.
- [ ] Nombres con comas y comillas producen CSV válido.
