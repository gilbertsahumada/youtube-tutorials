# Comandos originales

La [interfaz visual](../README.md) es el recorrido recomendado. Estos comandos siguen disponibles para explorar la implementación, desde `videos/company-brain/demo/`, con Node.js ≥22.

Si prefieres configurarlos manualmente, copia `.env.example` a `.env` solo si ese archivo aún no existe y completa los valores según la [guía de conexión](conectar-cuentas.md). No reemplaces una configuración existente.

| Comando | Resultado |
|---|---|
| `npm start` | Interfaz local en `http://127.0.0.1:4173` |
| `npm run dev` | Servidor con reinicio al modificar el código |
| `npm test` | Pruebas locales con APIs simuladas |
| `npm run preview` | Ejemplo por terminal: `output/fixture.json` y `fixture-comment.md`; sin APIs ni publicación |
| `npm run gmail:login` | Autoriza Gmail de lectura y guarda el token local |
| `npm run inbox` | Lista los mensajes filtrados, incluyendo su ID |
| `npm run baseline` | Captura el acuerdo inicial con el modelo, sin publicar |
| `npm run once` | Analiza nuevas solicitudes; publica solo si `PUBLISH=true` |
| `npm run watch` | Observación por terminal; requiere `PUBLISH=true` |

Para `gmail:login` solo necesitas Client ID y Client secret de Google. Para `inbox`, añade etiqueta, remitente y fecha. Copia el ID de Gmail API del correo inicial a `GMAIL_INITIAL_MESSAGE_ID` antes de `baseline`; este paso también requiere repo, issue y modelo.

Empieza con `PUBLISH=false`: `once` prepara el comentario en `output/`. Tras revisarlo, `PUBLISH=true` permite al comando publicarlo y guardar el resultado en `.private/state.json`.

**La UI publica al pulsar su botón de revisión**, independientemente de `PUBLISH`. El watcher de la UI prepara propuestas; el watcher por terminal publica comentarios. Ambos comparten el contexto, el estado y el lock para evitar operaciones concurrentes.

No hay comando de aprobación ni cambios automáticos en la tarea. Para otro destino, usa otra copia de la demo.
