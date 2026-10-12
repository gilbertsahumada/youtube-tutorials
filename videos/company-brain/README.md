# Company Brain: del correo a una decisión

Conecta correos de Gmail con una tarea de GitHub. Company Brain compara el acuerdo inicial con las nuevas solicitudes y prepara una propuesta con evidencia. Tú revisas antes de publicar el comentario.

## 1. Configura el entorno

Necesitas **Node.js ≥22**, una cuenta de Gmail, una sesión de GitHub CLI y una API compatible con Chat Completions. No hay dependencias que instalar.

```bash
cd videos/company-brain/demo
cp -n .env.example .env
```

Completa `.env` con tus credenciales de Google, los filtros de Gmail, el repositorio e issue y los datos del modelo. La [guía de conexión](docs/conectar-cuentas.md) explica cada variable.

**Las credenciales se configuran únicamente en el entorno o en `.env`.** La UI muestra el estado de las conexiones. Si falta una variable o es inválida, verás un error con los campos que debes corregir. Después de editar el entorno, reinicia el servidor.

## 2. Abre la interfaz

```bash
npm start
```

Abre **http://127.0.0.1:4173**. El botón **EN / ES** cambia el idioma y recuerda tu elección; los correos y la evidencia conservan su texto original.

## 3. Sigue el recorrido

1. En **Conexiones**, pulsa **Conectar Gmail** y autoriza la cuenta receptora. Comprueba el acceso a GitHub.
2. Pulsa **Cargar correos** y selecciona el mensaje que define el acuerdo inicial de la tarea.
3. En **Centro de decisiones**, pulsa **Buscar solicitudes** para comparar nuevos correos con ese acuerdo y el issue.
4. Abre **Revisar propuesta**, comprueba la evidencia y pulsa **Publicar comentario en GitHub** cuando quieras publicarla.

La interfaz utiliza únicamente datos de tus cuentas. **Observar Gmail** busca nuevas solicitudes cada 30 segundos mientras la página está abierta. Publicar el comentario conserva el alcance y el estado de la tarea; el equipo decide si los modifica en GitHub.

Este tutorial admite cambios entre CSV y PDF. Ajusta el proyecto en `demo/config/project.json` antes de capturar el acuerdo y utiliza esas mismas referencias en el issue y los correos. La [guía de conexión](docs/conectar-cuentas.md) detalla el formato.

## Código y pruebas

- `demo/web/`: interfaz en JavaScript y CSS, sin compilación.
- `demo/src/`: servidor local, integraciones y validación de propuestas.
- `demo/test/` y `demo/fixtures/`: datos aislados para pruebas automatizadas.

Ejecuta `npm test` desde `demo/`. Los [comandos originales](docs/scripts.md) siguen disponibles. `.env`, `.private/` y `output/` quedan excluidos de Git.

[Ver video conceptual](https://youtu.be/uB21nWjsx50) · [Leer sobre Company Brain](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes)
