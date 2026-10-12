# Demo visual de Company Brain

La demo compara un acuerdo de Gmail con una tarea de GitHub y una solicitud posterior. El caso del tutorial pasa de **CSV a PDF**: ves las tres fuentes, revisas una propuesta con evidencia y decides si publicas el comentario en el issue.

**Para hacerla de principio a fin, sigue la [guía del tutorial](../README.md#paso-a-paso).** Incluye la creación de las credenciales, la descripción del issue, los campos del proyecto y dos correos que puedes enviar con tus cuentas.

## Arranque

Necesitas **Node.js ≥22.13**, GitHub CLI con una sesión autorizada, Gmail con un cliente OAuth de escritorio y un proveedor compatible con Chat Completions. No hay paquetes que instalar.

Desde esta carpeta:

```bash
cp -n .env.example .env
```

Completa `.env` con estas siete variables:

| Conexión | Variables |
|---|---|
| Cliente OAuth de Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Correos que se consultarán | `GMAIL_LABEL`, `GMAIL_AFTER` |
| Proveedor y modelo de IA | `MODEL_BASE_URL`, `MODEL_ID`, `MODEL_API_KEY` |

La etiqueta debe existir en el Gmail receptor y estar aplicada a los mensajes. La fecha debe ser anterior al acuerdo inicial. [Cómo obtener y configurar estos valores](../README.md#1-prepara-las-conexiones).

Si usas nvm, ejecuta `nvm use`. Después:

```bash
gh auth login
npm start
```

Abre [http://127.0.0.1:4173](http://127.0.0.1:4173). Las credenciales se leen exclusivamente del entorno o `.env` en el servidor. Al cambiarlas, reinícialo. Una configuración incompleta muestra un error; la interfaz utiliza datos de tus cuentas.

## Recorrido en la UI

1. **Proyectos y filtros:** crea el proyecto con su nombre, referencia, repositorio `owner/repo`, número del issue, entrega y requisito. Añade el correo exacto del remitente o su dominio y asígnalo al proyecto.
2. **Conexiones:** autoriza el Gmail receptor y comprueba la sesión de GitHub. Pulsa **Cargar correos** y captura el correo del acuerdo inicial. Las referencias y el formato deben coincidir con el issue.
3. **Centro de decisiones:** cuando llegue el nuevo correo etiquetado, pulsa **Buscar solicitudes**. Verás el acuerdo, la tarea y la nueva petición, junto con la propuesta de cambio.
4. **Revisar propuesta:** comprueba las citas y el comentario. **Publicar comentario en GitHub** deja la propuesta pendiente de revisión humana; el equipo decide si modifica el alcance de la tarea.

El correo exacto tiene prioridad sobre el dominio entre todos los proyectos. Añade los subdominios por separado. Si un mensaje coincide con varios proyectos, asígnalo en **Conexiones → Correos por asignar** antes de analizarlo.

**EN / ES** cambia el idioma de la interfaz. **Fuentes de contexto** permite leer los documentos completos. **Observar Gmail** consulta cada 30 segundos mientras permanezcas en la vista; cada publicación requiere tu revisión.

## Estado local

SQLite conserva proyectos, filtros, asignaciones, acuerdos, propuestas y publicaciones en `.private/company-brain.sqlite`. La autorización de Gmail está en `.private/gmail-token.json`; los diagnósticos están en `output/<proyecto>/`. Al recargar la página o reiniciar el servidor, se conserva el estado.

Para respaldarlo, detén la demo y copia `.private/`; guarda `.env` por separado. Estos archivos están excluidos de Git y los archivos privados y diagnósticos no se sirven como archivos web. Una vez capturado el acuerdo, el destino y las referencias quedan fijos; para otro alcance, crea un proyecto nuevo.

## Comandos útiles

| Comando | Resultado |
|---|---|
| `npm start` | UI local con datos reales. |
| `npm run dev` | Reinicia el servidor al cambiar su código. |
| `npm run preview` | La misma UI y conexiones que `start`. |
| `npm test` | Pruebas con APIs simuladas, sin acceder a tus cuentas. |
| `npm run test:fixture` | Prueba aislada del recorrido por terminal, sin publicación. |
| `PORT=4174 npm start` | Arranca en otro puerto si el 4173 está ocupado. |

Los datos de `fixtures/` se utilizan solo en pruebas, sin sustituir los datos de la UI. Las variables opcionales de `.env.example` corresponden a los comandos originales; los proyectos y filtros de la UI se guardan en SQLite.

[Tutorial completo](../README.md) · [Resolver problemas](../README.md#si-algo-no-funciona) · [Detalle de conexiones](../docs/conectar-cuentas.md) · [Scripts y compatibilidad con la CLI](../docs/scripts.md)
