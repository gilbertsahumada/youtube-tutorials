# Comandos originales

La [interfaz visual](../README.md) es el recorrido recomendado. Estos comandos siguen disponibles para explorar la implementación, desde `videos/company-brain/demo/`, con Node.js ≥22.13.

Copia `.env.example` a `.env` solo si ese archivo aún no existe y completa los valores según la [guía de conexión](conectar-cuentas.md). No reemplaces una configuración existente.

| Comando | Resultado |
|---|---|
| `npm start` | Interfaz local en `http://127.0.0.1:4173` |
| `npm run dev` | Servidor con reinicio al modificar el código |
| `npm test` | Pruebas locales con APIs simuladas |
| `npm run preview` | La misma interfaz local con datos reales |
| `npm run test:fixture` | Validación aislada del pipeline por terminal, sin APIs ni publicación |
| `npm run gmail:login` | Autoriza Gmail de lectura y guarda el token local |
| `npm run inbox` | Lista los mensajes filtrados, incluyendo su ID |
| `npm run baseline` | Captura el acuerdo inicial con el modelo, sin publicar |
| `npm run once` | Analiza nuevas solicitudes; publica solo si `PUBLISH=true` |
| `npm run watch` | Observación por terminal; requiere `PUBLISH=true` |

La plantilla `.env.example` contiene únicamente las cinco conexiones de la UI. Si ejecutas estos scripts por terminal, añade manualmente `GITHUB_REPO`, `GITHUB_ISSUE_NUMBER` y `ALLOWED_SENDER` a `.env` y las referencias a `config/project.json`. Para `gmail:login` solo necesitas Client ID y Client secret de Google. Para `inbox`, añade `ALLOWED_SENDER` y `GMAIL_AFTER`; `GMAIL_LABEL` es opcional. Con una etiqueta vacía, Gmail busca directamente por remitente y fecha. Copia el ID de Gmail API del correo inicial a `GMAIL_INITIAL_MESSAGE_ID` antes de `baseline`; este paso también requiere repo, issue y modelo. En la UI seleccionas ese correo desde Conexiones y su ID queda en SQLite.

Empieza con `PUBLISH=false`: `once` prepara el comentario en `output/`. Tras revisarlo, `PUBLISH=true` permite al comando publicarlo y guardar el resultado en `.private/state.json`.

**La UI publica al pulsar su botón de revisión**, independientemente de `PUBLISH`. El watcher de la UI prepara propuestas; el watcher por terminal publica comentarios. Ambos comparten un lock para evitar operaciones concurrentes. La UI guarda sus proyectos, filtros, fechas de inicio, etiquetas opcionales y estado en SQLite; la CLI conserva su recorrido de un solo proyecto con `config/project.json`, `.private/baseline.json` y `.private/state.json`.

Los proyectos se crean desde el formulario de la UI y sus fechas y etiquetas se editan allí. Los scripts usan sus archivos privados por separado. La UI nunca modifica `.env`.

No hay comando de aprobación ni cambios automáticos en la tarea. Para otro destino en la CLI, usa otra copia de la demo. En la UI, crea otro proyecto con el formulario.
