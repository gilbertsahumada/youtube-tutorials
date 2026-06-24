# Exportar reservas a CSV

> Ejemplo de spec llena, para un feature chico y real de una app de reservas (Next.js + Prisma). Así se ve aplicar las 5 preguntas.

## Contexto
- La app ya tiene dashboard de reservas, permisos por negocio y filtros de fecha.
- Patrón a seguir: las acciones del dashboard viven en `src/app/dashboard/` y usan la capa de datos en `src/data/`.
- Decisión ya tomada: la exportación es del lado servidor (no se arma el CSV en el cliente).

## Objetivo
Agregar una acción en el dashboard para descargar las reservas filtradas por rango de fechas, en formato CSV.

## Restricciones
- No tocar autenticación.
- No cambiar el modelo de reservas.
- No agregar dependencias salvo que sea necesario y justificado.

## Fuera de alcance
- No crear una pantalla nueva de reportes.
- No exportar reservas de otros negocios.
- No agregar gráficos ni dashboards de analítica.

## Tareas

### T1: Encontrar el flujo actual de reservas
**Hacer:** Mapear dónde viven las reservas (query, componente del dashboard, filtros de fecha).
**Archivos:** solo lectura/exploración.
**Verify:** listar los archivos/rutas involucrados antes de modificar nada.

### T2: Crear el serializador CSV
**Hacer:** Función pura que toma reservas y devuelve un string CSV con encabezados.
**Archivos:** `src/data/csv.ts`, `src/data/csv.test.ts`
**Verify:** `test` con 3 reservas y encabezados exactos (fecha, hora, cliente, telefono, servicio, estado).

### T3: Agregar la descarga protegida
**Hacer:** Endpoint o server action que devuelve el CSV de las reservas del negocio actual, respetando permisos.
**Archivos:** `src/app/api/reservas/export/route.ts`
**Verify:** el usuario del negocio A NO puede exportar reservas del negocio B (devuelve 403).

### T4: Agregar el botón en el dashboard
**Hacer:** Botón "Exportar CSV" que respeta el rango de fechas seleccionado.
**Archivos:** `src/app/dashboard/ReservasToolbar.tsx`
**Verify:** descarga un `.csv` que respeta el rango de fechas.

## Done (validación final)
- [ ] `bun run build` (o el build del proyecto) pasa.
- [ ] Manual: seleccionar un rango → Exportar → abrir el `.csv` en Sheets/Excel → columnas y filas correctas.
- [ ] Manual: un usuario de otro negocio no puede exportar reservas ajenas.
- [ ] Sin regresiones en el listado de reservas del dashboard.
