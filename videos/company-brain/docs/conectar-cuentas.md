# Conectar tus cuentas

Arranca la demo con `npm start` desde `demo/` y abre **Mis cuentas → Configuración**. La interfaz guarda los valores en `.env`; no tienes que editarlo a mano.

Usa una cuenta Gmail de prueba, otro correo tuyo como remitente y un repositorio privado sandbox. En modo real, el modelo recibe el contenido de los correos y la tarea.

## Gmail

1. En [Google Cloud](https://console.cloud.google.com/), activa **Gmail API**.
2. En Google Auth Platform, configura una audiencia **External**, modo **Testing**, y añade la **cuenta receptora** como usuario de prueba.
3. Incluye `https://www.googleapis.com/auth/gmail.readonly` en los permisos.
4. Crea un cliente OAuth de tipo **Aplicación de escritorio**.
5. Copia su **Client ID** y **Client secret** a la interfaz. Son credenciales de Google, no tu contraseña ni la clave del modelo.
6. En el Gmail receptor crea la etiqueta `company-brain-demo`. Aplícala a cada correo, manualmente o con un filtro por remitente y asunto.
7. En **Remitente permitido**, escribe la dirección del otro correo desde el que enviarás los mensajes.
8. Conserva una fecha de lectura anterior al primer correo. La fecha inicial de la interfaz cubre las últimas 24 horas; si tu correo es más antiguo, elige un corte anterior.
9. Pulsa **Guardar configuración → Conectar Gmail → Abrir autorización de Google**. Selecciona la cuenta receptora y vuelve a la demo.

El permiso OAuth permite leer el buzón; etiqueta, remitente y fecha son filtros del programa. No se solicitan permisos de envío o modificación. El token se guarda en `.private/gmail-token.json`.

## GitHub

La demo utiliza una sesión de [GitHub CLI](https://cli.github.com/). Si aún no tienes una, inicia sesión una vez:

```bash
gh auth login
```

1. Crea un repositorio privado de prueba desde GitHub.
2. Introduce su nombre `tu-usuario/company-brain-sandbox` en Configuración y guarda.
3. Pulsa **Preparar el issue → Crear issue en GitHub**. El enlace incluye el título y la descripción del caso.
4. Guarda en la interfaz el número del issue que acabas de crear.
5. Pulsa **Comprobar acceso** para comprobar la sesión.

La tarea debe estar abierta, pedir CSV y conservar estas líneas en su descripción:

```text
Proyecto: portal-cliente
Entrega: entrega-1
Requisito: exportar-reportes
Formato actual: CSV
```

## Modelo de IA

Introduce los tres valores de un proveedor compatible con **Chat Completions**:

| Campo | Valor |
|---|---|
| URL base | URL HTTPS de la API, sin `/chat/completions` |
| ID del modelo | Identificador disponible en tu cuenta del proveedor |
| API key | Clave válida para esa URL base |

La demo añade `/chat/completions` y pide una respuesta JSON. Una suscripción a un chat web no sustituye la clave de API.

Pulsa **Guardar configuración**. Las claves se guardan localmente; los campos vacíos conservan las claves existentes.

## Capturar, analizar y revisar

1. Pulsa **Textos del ejemplo**, copia el primer correo y envíalo desde el remitente permitido al Gmail receptor. Aplica la etiqueta.
2. En **Captura el acuerdo inicial**, pulsa **Cargar correos** y selecciona ese mensaje. El modelo comprueba que correo e issue coincidan en CSV.
3. Envía el segundo correo con la solicitud de PDF y aplícale la misma etiqueta.
4. Pulsa **Buscar solicitudes** para ver el contraste y la propuesta.
5. En **Revisar propuesta**, comprueba los extractos y el comentario completo. **Publicar comentario en GitHub** escribe solo ese comentario y evita repetirlo.

Una publicación no cambia la tarea ni aprueba el nuevo alcance. La decisión posterior se toma manualmente en GitHub. El ejemplo usa un único proyecto y admite cambios entre CSV y PDF.

## Si algo no aparece

| Problema | Qué revisar |
|---|---|
| Sin correos | Cuenta receptora autorizada, etiqueta aplicada, remitente exacto y fecha anterior al mensaje. Se leen mensajes con texto plano, sin adjuntos. |
| Google bloquea el acceso | Cuenta receptora añadida como usuario de prueba, Gmail API activa y cliente OAuth de escritorio. |
| GitHub falla | Sesión de `gh`, acceso al sandbox y número de un issue abierto. |
| Evidencia rechazada | El extracto debe coincidir literalmente con el correo, mencionar el formato y tener al menos 20 caracteres. El diagnóstico de la captura está en `output/initial-context.json`. |
| El issue cambió | Busca solicitudes de nuevo; el comentario se valida contra el estado actual antes de publicarse. |
| Otra instancia en curso | Detén el otro servidor o script. El flujo comparte un lock local; no borres un lock sin comprobar el proceso. |

La dirección del remitente no verifica criptográficamente su identidad. La demo prepara propuestas, no sustituye un sistema empresarial de permisos o aprobación.

Para otro proyecto, issue o correo inicial, usa otra copia de la demo: el acuerdo capturado se conserva. **Observar Gmail** funciona mientras esta página está abierta; prepara propuestas sin publicarlas automáticamente.
