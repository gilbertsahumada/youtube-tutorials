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

Para estos scripts, configura `GITHUB_REPO`, `GITHUB_ISSUE_NUMBER` y `ALLOWED_SENDER` en `.env` y las referencias en `config/project.json`. Para `gmail:login` solo necesitas Client ID y Client secret de Google. Para `inbox`, añade `ALLOWED_SENDER` y `GMAIL_AFTER`; `GMAIL_LABEL` es opcional. Con una etiqueta vacía, Gmail busca directamente por remitente y fecha. Copia el ID de Gmail API del correo inicial a `GMAIL_INITIAL_MESSAGE_ID` antes de `baseline`; este paso también requiere repo, issue y modelo.

Empieza con `PUBLISH=false`: `once` prepara el comentario en `output/`. Tras revisarlo, `PUBLISH=true` permite al comando publicarlo y guardar el resultado en `.private/state.json`.

**La UI publica al pulsar su botón de revisión**, independientemente de `PUBLISH`. El watcher de la UI prepara propuestas; el watcher por terminal publica comentarios. Ambos comparten un lock para evitar operaciones concurrentes. La UI guarda sus proyectos, filtros, fechas de inicio, etiquetas opcionales y estado en SQLite; la CLI conserva su recorrido de un solo proyecto con `config/project.json`, `.private/baseline.json` y `.private/state.json`.

Para importar ese proyecto y sus archivos privados en el primer inicio con una base vacía, establece `IMPORT_LEGACY_PROJECT=true` en el entorno o `.env`, además del repo, issue y remitente de la CLI. La opción viene desactivada: configurar esas tres variables por sí solo no crea proyectos. Los proyectos ya importados se conservan y la UI indica su origen. Los cambios posteriores no se sincronizan entre ambos recorridos. La UI nunca modifica `.env`. `GMAIL_LABEL` y `GMAIL_AFTER` pertenecen a este recorrido de terminal; la UI solo los lee una vez al actualizar una base anterior o importar el proyecto de la CLI. Después se editan por proyecto en el formulario.

No hay comando de aprobación ni cambios automáticos en la tarea. Para otro destino en la CLI, usa otra copia de la demo. En la UI, crea otro proyecto con el formulario.
