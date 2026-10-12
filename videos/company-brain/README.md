# Company Brain: del correo a una decisión

Una demo visual de cómo conectar lo que se conversa con lo que se construye.

**El caso:** el cliente acordó exportar reportes en CSV y la tarea de GitHub refleja ese acuerdo. Después llega un correo pidiendo PDF. Company Brain reúne el contexto y propone revisar el alcance, con evidencia de ambos correos.

**Tú decides:** la propuesta puede publicarse como comentario. La descripción y el estado de la tarea se conservan hasta que una persona los cambie.

## 1. Abre la demo

Necesitas **Node.js 22 o superior**. No hay dependencias que instalar.

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/company-brain/demo
npm start
```

Abre **http://127.0.0.1:4173**. Si ya tienes el repositorio, entra en `videos/company-brain/demo` y ejecuta `npm start`.

## 2. Explora el ejemplo

La interfaz abre en **Ejemplo**, lista para usar sin cuentas ni claves:

El botón **EN / ES**, arriba a la derecha, cambia el idioma de la interfaz y recuerda tu elección. Los correos, la evidencia y los comentarios conservan su texto original.

1. Mira **Lo que sabemos**: el correo del acuerdo inicial y la tarea que pide CSV.
2. Lee **Lo que cambió**: el cliente solicita priorizar PDF.
3. Pulsa **Analizar solicitud** para ver la propuesta y su evidencia.
4. Pulsa **Revisar propuesta → Simular revisión** para completar el recorrido.

El ejemplo usa correos, tarea y análisis preparados. No consulta APIs ni publica en GitHub. **Reiniciar demo** permite repetirlo durante el video.

## 3. Prueba con tus cuentas

En **Mis cuentas → Configuración**:

1. Configura Gmail, un issue de prueba en GitHub y tu proveedor de IA; pulsa **Guardar configuración**.
2. Pulsa **Conectar Gmail** y autoriza la cuenta receptora. Comprueba el acceso a GitHub.
3. Usa **Textos del ejemplo** para enviar el primer correo y aplícale la etiqueta configurada.
4. Pulsa **Cargar correos** y selecciona el acuerdo inicial para capturarlo.
5. Envía el segundo correo, aplica la etiqueta y pulsa **Buscar solicitudes**.
6. Revisa la propuesta. **Publicar comentario en GitHub** escribe únicamente ese comentario.

**Observar Gmail** busca nuevas solicitudes cada 30 segundos mientras la página está abierta. Cada propuesta espera tu revisión antes de publicarse.

La preparación de cuentas está en la propia interfaz y en la [guía de conexión](docs/conectar-cuentas.md). Usa datos ficticios: el modo real envía correos y tarea al proveedor de IA y puede generar cargos.

## Para explorar el código

| Carpeta o archivo | Qué encontrarás |
|---|---|
| `demo/web/` | Interfaz en JavaScript y CSS, sin framework ni compilación |
| `demo/src/server.mjs`, `studio.mjs` | Servidor local y acciones de la interfaz |
| `demo/src/plan.mjs`, `pipeline.mjs` | Análisis, validación de evidencia y coordinación del flujo |
| `demo/src/gmail.mjs`, `github.mjs` | Integraciones con las cuentas reales |
| `demo/test/`, `fixtures/` | Pruebas y datos del ejemplo |

Ejecuta `npm test` desde `demo/` para verificar el flujo con APIs simuladas. Los [comandos originales](docs/scripts.md) siguen disponibles como alternativa.

Las claves y el estado se guardan localmente en `.env`, `.private/` y `output/`, excluidos de Git. El servidor escucha solo en esta computadora.

[Ver video conceptual](https://youtu.be/uB21nWjsx50) · [Leer sobre Company Brain](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes)
