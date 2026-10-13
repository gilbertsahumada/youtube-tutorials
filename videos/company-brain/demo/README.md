# Demo visual de Company Brain

Crea proyectos con un repositorio, participantes y una fecha con hora. Sincroniza Gmail, analiza los mensajes con el modelo y revisa propuestas para crear o actualizar issues. Cada escritura en GitHub necesita tu aprobación.

La [guía completa](../README.md#paso-a-paso) explica la configuración de Google, el modelo y una conversación de prueba paso a paso. La interfaz usa datos reales; empieza sin proyectos ni mensajes precargados.

## Arranque

Necesitas **Node.js ≥22.13**, [GitHub CLI](https://cli.github.com/), Gmail con un cliente OAuth de escritorio y un proveedor compatible con Chat Completions. No hay dependencias que instalar.

Desde esta carpeta:

```bash
cp -n .env.example .env
```

Completa `.env` con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MODEL_BASE_URL`, `MODEL_ID` y `MODEL_API_KEY`. Usa una URL base HTTPS sin `/chat/completions`. Las credenciales quedan en el servidor; no se editan desde la UI. Reinicia la demo después de cambiarlas.

Si usas nvm, ejecuta `nvm use`. Después:

```bash
gh auth login
npm start
```

Abre [http://127.0.0.1:4173](http://127.0.0.1:4173). Si faltan variables, verás el error correspondiente. El repositorio y los filtros se guardan por proyecto en SQLite. Un `GITHUB_REPO` existente solo rellena el campo inicial del repositorio.

## Recorrido de la interfaz

1. **Conexiones y datos:** autoriza el Gmail receptor y comprueba GitHub.
2. **Proyectos → Nuevo proyecto:** nombre, repositorio, fecha y hora UTC y etiqueta opcional. No hace falta un issue inicial.
3. **Configuración del proyecto → Participantes:** añade los correos exactos y dominios de los remitentes. La etiqueta vacía permite filtrar solo por participantes y fecha.
4. **Correos → Sincronizar correo:** descarga los mensajes que coincidan y guarda sus textos para el modelo.
5. **Analizar correos:** compara los nuevos mensajes con los issues abiertos. La aplicación abre **Propuestas**.
6. **Revisar propuesta:** comprueba motivo, citas y descripción completa; aprueba para crear o actualizar el issue, o rechaza. La decisión aparece en **Historial** y **Actividad**.
7. Envía otra respuesta en el hilo, sincroniza y analiza otra vez. El agente recibe el contexto anterior y el issue vinculado.

El sidebar conserva el proyecto en las rutas. **EN / ES** cambia la interfaz; las fuentes mantienen su texto original. Los filtros se combinan dentro del proyecto. Un dominio coincide completo y necesita filtros separados para sus subdominios; los filtros de otro proyecto no cambian esta selección.

## Seguimiento y datos

En **Configuración del proyecto**, activa o pausa el seguimiento automático y elige su intervalo. Funciona mientras el servidor esté encendido, aunque cierres el navegador. Prepara propuestas sin aprobarlas. Las operaciones se ejecutan una a una.

SQLite conserva configuración, mensajes, propuestas, decisiones y actividad en `.private/company-brain.sqlite`. OAuth se guarda en `.private/gmail-token.json`. Puedes cerrar la página o reiniciar el servidor sin perder lo pendiente.

**Conexiones y datos → Reiniciar datos locales** permite empezar de cero con confirmación. Borra únicamente el estado local de la demo; conserva `.env`, OAuth y los mensajes e issues originales. **Eliminar proyecto** borra solo el estado de ese proyecto. Para un respaldo, detén el servidor y copia `.private/`; guarda `.env` por separado.

## Comandos útiles

| Comando | Resultado |
|---|---|
| `npm start` | UI local con conexiones reales. |
| `npm run dev` | Reinicia el servidor al cambiar su código. |
| `npm run preview` | Misma UI que `start`. |
| `npm test` | Pruebas aisladas, sin acceder a tus cuentas. |
| `PORT=4174 npm start` | Otro puerto para el servidor. |

Los comandos por terminal y sus fixtures pertenecen al ejemplo original acotado a CSV/PDF. La UI usa el flujo por proyectos, varias tareas y aprobación de creaciones y actualizaciones; no carga esos fixtures.

[Tutorial completo](../README.md) · [Resolver problemas](../README.md#si-algo-no-funciona) · [Conectar cuentas](../docs/conectar-cuentas.md) · [Ejemplo por terminal](../docs/scripts.md)
