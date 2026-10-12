# Company Brain: del correo a una decisión

Conecta correos de Gmail con tareas de GitHub. Company Brain compara el acuerdo inicial con las nuevas solicitudes y prepara una propuesta con evidencia. Tú revisas antes de publicar el comentario.

## 1. Configura las conexiones

Necesitas **Node.js ≥22.13**, una cuenta de Gmail, una sesión de GitHub CLI y una API compatible con Chat Completions. No hay dependencias que instalar.

```bash
cd videos/company-brain/demo
cp -n .env.example .env
# Si utilizas nvm: nvm use
```

Completa `.env` con las credenciales de Google, la etiqueta y fecha de Gmail y los datos del modelo. La [guía de conexión](docs/conectar-cuentas.md) explica las siete variables necesarias.

**Las credenciales se configuran únicamente en el entorno o en `.env`.** Si faltan variables o son inválidas, la UI muestra qué debes corregir. Después de editarlas, reinicia el servidor.

## 2. Crea un proyecto y sus filtros

```bash
npm start
```

Abre **http://127.0.0.1:4173** y entra en **Proyectos y filtros**:

1. Crea un proyecto con su nombre, repositorio, issue y referencias del acuerdo.
2. Añade los **correos exactos** o **dominios completos** de sus participantes y asígnalos al proyecto.
3. Elige el proyecto que quieres consultar. Puedes tener varios en la misma demo.

El correo exacto tiene prioridad sobre el dominio. Los subdominios se añaden por separado. Si un correo coincide con varios proyectos, tú eliges su destino en **Conexiones** antes de analizarlo.

## 3. Captura, analiza y decide

1. En **Conexiones**, autoriza Gmail y comprueba el acceso a GitHub.
2. Pulsa **Cargar correos** y selecciona el acuerdo inicial del proyecto.
3. En **Centro de decisiones**, pulsa **Buscar solicitudes**.
4. Abre **Revisar propuesta**, comprueba la evidencia y pulsa **Publicar comentario en GitHub**.

La UI utiliza únicamente datos de tus cuentas. **Observar Gmail** busca solicitudes cada 30 segundos mientras la página está abierta. Publicar conserva el alcance y el estado de la tarea; el equipo decide si los modifica en GitHub.

**EN / ES** cambia el idioma. Los correos, la evidencia y los comentarios conservan su texto original. Este tutorial admite cambios entre CSV y PDF; las referencias del formulario deben coincidir con las del issue y los correos. [Ver el formato del acuerdo](docs/conectar-cuentas.md#proyectos-y-filtros).

## Datos locales y pruebas

SQLite guarda proyectos, filtros, asignaciones, acuerdos y propuestas en `demo/.private/company-brain.sqlite`. Se conservan al reiniciar; no necesitas configurar una base externa. `.env`, `.private/` y `output/` se ignoran en Git.

Ejecuta `npm test` desde `demo/`. Los datos de `demo/fixtures/` se utilizan solo en pruebas aisladas. Los [comandos originales](docs/scripts.md) siguen disponibles con su configuración por terminal.

[Ver video conceptual](https://youtu.be/uB21nWjsx50) · [Leer sobre Company Brain](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes)
