# Continuación del tutorial: comandos, sesiones y navegación en Pi

Este documento complementa [`README.md`](README.md). El README principal explica la instalación, la autenticación, las skills y las extensiones. Esta continuación propone una demo más pausada para enseñar los comandos, las sesiones y la diferencia entre `tree`, `find` y `ls`.

La demo está pensada para ejecutarse localmente, en modo interactivo. No es un workflow para GitHub Actions.

---

## 1. Preparar el directorio de la demo

Para enseñar los comandos de forma limpia, empieza en un directorio pequeño y separado del repositorio final:

```bash
mkdir -p ~/tmp/pi-commands-demo/src/components
mkdir -p ~/tmp/pi-commands-demo/docs
mkdir -p ~/tmp/pi-commands-demo/scripts

touch \
  ~/tmp/pi-commands-demo/README.md \
  ~/tmp/pi-commands-demo/package.json \
  ~/tmp/pi-commands-demo/.gitignore \
  ~/tmp/pi-commands-demo/.env.example \
  ~/tmp/pi-commands-demo/src/index.ts \
  ~/tmp/pi-commands-demo/src/components/App.tsx \
  ~/tmp/pi-commands-demo/docs/architecture.md \
  ~/tmp/pi-commands-demo/scripts/check.sh

cd ~/tmp/pi-commands-demo
pi --name "Pi: comandos y sesiones"
```

No uses `--no-session` en esta parte: queremos que Pi guarde la conversación para poder demostrar `/tree`, `/resume`, `/fork` y `/clone`.

> Si todavía no has completado `/login`, hazlo según la primera parte del tutorial.

### Para esta grabación: reutilizar el proyecto del video

Como la primera demo ya fue grabada en el [video de YouTube](https://youtu.be/fvXWPim2RzM), no necesitas crear el directorio de ejemplo anterior. Abre una terminal en la raíz del proyecto que construiste durante ese video y ejecuta:

```bash
# Crear una sesión nueva para esta parte del video:
pi --name "Pi: comandos y sesiones"
```

Si quieres recuperar una sesión anterior del proyecto:

```bash
pi -c    # continuar la sesión más reciente
pi -r    # elegir una sesión desde el selector
```

Antes de iniciar Pi, enseña la estructura del proyecto con `tree` y usa `find` si el comando no está instalado:

```bash
if command -v tree >/dev/null 2>&1; then
  tree -a -L 4 -I '.git|node_modules|dist'
else
  printf '%s\n' 'tree no está instalado; usando find como fallback:'
  find . -maxdepth 4 -print | sort
fi
```

El proyecto creado durante el video contiene recursos locales de Pi dentro de `.pi/`. Revisa la extensión y la skill antes de aceptar la confianza del proyecto si Pi la solicita.

---

## 2. Modelo mental: Pi es deliberadamente minimalista

Pi es un **coding harness minimalista para el terminal**: conecta un modelo con el contexto de una sesión y un conjunto de tools para trabajar sobre el directorio actual.

Antes de hablar de las tools, conviene explicar algo importante: Pi mantiene pequeño su núcleo y no incorpora ciertos workflows como funciones built-in.

| Pi no incluye por defecto | Qué significa |
|---|---|
| **Sub-agents** | No existe un coordinador built-in que divida automáticamente el trabajo entre agentes independientes. |
| **MCP** | No incluye un cliente o flujo MCP incorporado. |
| **Plan mode** | No existe un modo especial que bloquee cambios, gestione un plan y luego lo ejecute. |
| **To-dos** | No hay un gestor de tareas obligatorio dentro del core. |
| **Permission popups** | Pi no impone un sistema general de permisos antes de cada tool. |
| **Background bash** | No trae un bash persistente en segundo plano como workflow built-in. |

Esto no significa que esas capacidades sean imposibles. Se pueden añadir mediante extensiones, paquetes, el SDK o herramientas externas como containers y `tmux`. La decisión de Pi es no imponer un workflow único.

### ¿Por qué Pi pudo decir que estaba planificando?

Un modelo puede escribir una respuesta como:

```text
Voy a planificar los pasos antes de modificar los archivos.
```

Eso puede ser simplemente el estilo de respuesta del modelo, una instrucción de una skill o una petición del usuario. También puede aparecer junto al bloque de thinking. No significa que se haya activado un **plan mode** real.

Un plan mode real normalmente añade comportamiento verificable, por ejemplo:

- deshabilitar `write` y `edit` durante la exploración;
- limitar los comandos de `bash` a una allowlist read-only;
- guardar un plan y su progreso;
- ofrecer comandos como `/plan` o `/todos`.

Pi tiene ejemplos de extensiones que implementan plan mode y sub-agents, pero no vienen activos por defecto. La extensión local de esta demo es `onboarding.ts`; el proyecto del video no define un plan mode ni un sistema de sub-agents. Si aparece `/plan` o `/todos` en tu sesión, significa que una extensión o paquete global/local los añadió.

> `thinking` y `plan mode` tampoco son lo mismo: `Shift+Tab` cambia el nivel de reasoning del modelo; no activa un workflow de planificación.

### Orden recomendado para la grabación

1. Explicar este modelo mental minimalista.
2. Mostrar las tools y cómo se activan.
3. Demostrar `/tree` como el feature central de sesiones.
4. Recorrer los comandos slash y los comandos del usuario.
5. Terminar con `tree`, `find`, `ls` y las diferencias con GitHub Actions.

---

## 3. Hay tres clases de comandos

Antes de mostrar muchos comandos, conviene separar tres conceptos que suelen confundirse:

| Clase | Ejemplos | Quién los ejecuta |
|---|---|---|
| Comandos slash | `/model`, `/settings`, `/tree` | Pi controla la aplicación o la sesión. |
| Comandos del usuario | `!git status`, `!!pwd` | El usuario pide al shell que ejecute un comando. |
| Tools del modelo | `read`, `grep`, `find`, `ls`, `bash` | El modelo las llama a través de Pi. |

Escribe `/` en el editor para mostrar el autocompletado de comandos slash.

### 3.1 Comandos slash

Los comandos slash no son prompts normales. Le dicen a Pi que cambie el modelo, navegue la sesión, recargue recursos o abra una pantalla de configuración.

Ejemplos:

```text
/model
/settings
/session
/tree
```

### 3.2 Comandos del usuario: `!` y `!!`

Desde el editor de Pi, comprueba primero si `tree` está disponible y usa `find` como fallback:

```text
!pwd
!command -v tree >/dev/null 2>&1 && tree -a -L 3 -I '.git|node_modules|dist' || find . -maxdepth 3 -print | sort
!!git status --short
```

La diferencia es:

- `!comando`: ejecuta el comando y envía su salida al modelo.
- `!!comando`: ejecuta el comando, pero no envía su salida al modelo.

`!!` no es un sandbox. El comando sigue ejecutándose con tus permisos; simplemente su salida no se añade a la conversación.

### 3.3 Tools del modelo

En una sesión normal Pi tiene siete tools built-in disponibles:

```text
read, write, edit, bash, grep, find, ls
```

Pero la configuración estándar activa inicialmente solo cuatro:

```text
read, write, edit, bash
```

Las otras tres (`grep`, `find` y `ls`) no están desinstaladas ni bloqueadas: son tools built-in read-only opcionales. Pi las separa del conjunto estándar para que puedas elegir explícitamente la superficie de herramientas que tendrá el modelo.

### Activar las siete tools

Si quieres iniciar Pi con todas las tools built-in activas:

```bash
pi --tools read,write,edit,bash,grep,find,ls
```

`--tools` funciona como una allowlist estricta. Por eso, si escribes solamente:

```bash
pi --tools grep,find,ls
```

Pi tendrá esas tres tools, pero no tendrá automáticamente las cuatro predeterminadas. Para activar las siete debes incluirlas todas.

### Activar solo las tools read-only

Para revisar un repositorio sin permitir que el modelo escriba archivos ni ejecute `bash`:

```bash
pi --tools read,grep,find,ls
```

### Dejarlo configurado

Puedes definir `defaultTools` en la configuración global:

```text
~/.pi/agent/settings.json
```

O solo para el proyecto:

```text
.pi/settings.json
```

Ejemplo para activar las siete al iniciar:

```json
{
  "defaultTools": [
    "read",
    "write",
    "edit",
    "bash",
    "grep",
    "find",
    "ls"
  ]
}
```

La configuración de proyecto reemplaza la lista global. Reinicia Pi después de cambiar `defaultTools` para comprobar la nueva lista inicial.

Pi tampoco trae un comando `/tools` built-in. El repositorio de Pi incluye un ejemplo de extensión llamado `tools.ts` que añade un selector interactivo `/tools` y usa `pi.setActiveTools()` para cambiar la lista durante la sesión. Es una extensión opcional: si la cargas, revisa primero su código.

También existen opciones para reducir herramientas:

```bash
pi --exclude-tools bash       # quitar bash del conjunto resultante
pi --no-builtin-tools         # desactivar las tools built-in
pi --no-tools                 # desactivar todas las tools
```

La utilidad práctica de `grep`, `find` y `ls` es que ofrecen operaciones de búsqueda y exploración read-only sin dar al modelo acceso a `bash`. En una sesión normal, `bash` podría ejecutar esas mismas utilidades, pero una allowlist explícita permite controlar mejor qué puede hacer el modelo.

Las tools son diferentes de `!comando`: en el primer caso el modelo decide cuándo llamar a una tool; en el segundo, el usuario escribe explícitamente un comando.

---

## 4. El comando favorito: `/tree`

`/tree` navega el árbol de la **sesión actual**. No muestra los directorios del proyecto.

Para crear ramas visibles durante la grabación, utiliza este recorrido:

### 4.1 Crear el primer camino

Envía un prompt como:

```text
Estoy diseñando una pequeña aplicación para explorar repositorios.
Propón una arquitectura basada en una CLI y explica sus componentes.
```

Después envía:

```text
Desarrolla la alternativa A: una CLI simple con un único proceso.
```

### 4.2 Volver atrás y crear una alternativa

Ahora ejecuta:

```text
/tree
```

En el navegador:

1. Selecciona el mensaje anterior desde el que quieres continuar.
2. Pulsa `Enter`.
3. Edita el prompt que aparece en el editor.
4. Cambia la solicitud por algo como:

```text
Ahora desarrolla la alternativa B: separar la CLI y un servicio worker.
```

5. Envía el prompt.
6. Ejecuta `/tree` otra vez.

Ahora deberías poder ver el camino original y la nueva alternativa como ramas de una misma sesión.

Puedes etiquetar una entrada seleccionada desde el árbol con:

```text
Shift+L
```

### 4.3 Qué hace exactamente `/tree`

Las sesiones de Pi se guardan como árboles: cada entrada tiene un padre y la conversación activa termina en una hoja. `/tree` permite mover la hoja activa a un punto anterior y continuar desde ahí sin crear otro archivo de sesión.

Cuando se abandona una rama, Pi puede generar un resumen de esa rama para conservar el contexto importante sin volver a reproducir toda la conversación.

### 4.4 Por qué `/tree` es tan útil

`/tree` es especialmente bueno para:

- explorar varias alternativas sin perder el trabajo anterior;
- comparar dos diseños desde el mismo punto de partida;
- probar prompts diferentes;
- volver a una decisión anterior;
- experimentar sin crear muchas sesiones independientes;
- conservar la historia de cómo se llegó a una solución.

La frase para la grabación puede ser:

> `/tree` convierte una conversación lineal en un espacio de exploración. Puedo probar una alternativa, volver atrás y probar otra sin borrar la primera.

---

## 5. `/tree` no es `/resume`, `/fork` ni `/clone`

Estos comandos están relacionados, pero resuelven problemas distintos:

| Comando | Qué hace | ¿Crea otro archivo? |
|---|---|---:|
| `/tree` | Navega todas las ramas de la sesión actual. | No |
| `/resume` | Busca y abre una sesión anterior del proyecto. | No |
| `/fork` | Crea una sesión nueva a partir de un mensaje del usuario. | Sí |
| `/clone` | Duplica la rama activa completa en una sesión nueva. | Sí |
| `/new` | Comienza una sesión nueva. | Sí |
| `/compact` | Resume contexto antiguo para reducir tokens. | No |

También existen comandos de shell relacionados:

```bash
pi -r                  # abrir el selector de sesiones anteriores
pi -c                  # continuar la sesión más reciente
pi --fork <path|id>    # bifurcar una sesión por archivo o ID
pi --no-session        # ejecutar sin guardar sesión
```

### Cuándo usar cada uno

- Usa `/tree` para mantener alternativas relacionadas dentro de una misma conversación.
- Usa `/resume` cuando quieres recuperar una conversación anterior.
- Usa `/fork` cuando quieres iniciar una nueva sesión desde un prompt específico.
- Usa `/clone` cuando quieres una copia independiente del camino actual.
- Usa `/new` cuando el tema cambió por completo.
- Usa `/compact` cuando la conversación creció y quieres liberar contexto.

La diferencia que conviene enfatizar es:

> `/tree` organiza ramas dentro de una sesión; `/resume` selecciona entre sesiones distintas.

### Seleccionar un punto anterior o copiarlo

`/tree` y `/fork` permiten partir desde un punto anterior, pero de maneras diferentes:

- `/tree` muestra el árbol completo y permite seleccionar distintos tipos de entradas. Si eliges un mensaje del usuario, Pi lo coloca en el editor para editarlo y crear una nueva rama. Si eliges una respuesta del asistente o una tool, puedes continuar desde allí directamente.
- `/fork` abre un selector de mensajes anteriores del usuario y crea una sesión nueva desde el prompt elegido.
- `/clone` no muestra un selector de puntos anteriores: duplica la rama activa completa en una sesión nueva.

Si quieres clonar un punto anterior, combina los comandos:

```text
/tree
→ selecciona el punto de la conversación
→ /clone
```

Así `/tree` mueve la rama activa al punto elegido y `/clone` copia ese estado a otro archivo de sesión.

---

## 6. Comandos para enseñar después de `/tree`

Después de demostrar las ramas de sesión, recorre los comandos principales:

```text
/model
/settings
/hotkeys
/session
```

### `/model`

Abre el selector de modelos disponibles para los proveedores autenticados.

También puedes usar:

```text
Ctrl+L
```

Desde la shell:

```bash
pi --list-models
```

**Qué explicar:** cambiar de modelo no cambia el repositorio ni la sesión. Cambia el modelo que continuará trabajando sobre el contexto actual.

### `/settings`

Abre la configuración de Pi. Para este video merece la pena enseñar:

- nivel de thinking por defecto;
- tema;
- `quietStartup`;
- compactación automática;
- modo de entrega de mensajes;
- transporte;
- confianza por defecto del proyecto.

No es necesario cambiar todas las opciones. La idea es mostrar que Pi tiene configuración global y configuración específica del proyecto.

### `/hotkeys`

Muestra los atajos disponibles y sus acciones. Es útil porque algunos atajos cambian según la pantalla en la que estés.

Atajos principales:

| Atajo | Uso |
|---|---|
| `Ctrl+L` | Seleccionar modelo. |
| `Ctrl+P` | Ciclar al siguiente modelo. |
| `Shift+Ctrl+P` | Ciclar al modelo anterior. |
| `Shift+Tab` | Cambiar el nivel de thinking. |
| `Ctrl+T` | Colapsar o expandir el thinking. |
| `Ctrl+O` | Colapsar o expandir la salida de tools. |
| `Shift+Enter` | Insertar una nueva línea. |
| `Alt+Enter` | Encolar un follow-up. |
| `Escape` | Cancelar la operación actual. |
| `Ctrl+X` | Copiar la última respuesta. |
| `Ctrl+G` | Abrir el editor externo. |

### `/session`

Muestra información de la sesión actual, incluyendo normalmente:

- archivo de sesión;
- identificador;
- mensajes;
- tokens;
- coste.

Pi guarda las sesiones en:

```text
~/.pi/agent/sessions/
```

Una sesión es un archivo JSONL con una estructura de árbol. Esa estructura es la razón por la que `/tree` es tan interesante.

---

## 7. Otros comandos de sesión

### `/new`

Empieza una conversación nueva. La sesión anterior queda guardada y se puede recuperar con `/resume`.

### `/name <nombre>`

Asigna un nombre fácil de reconocer:

```text
/name exploración de arquitectura
```

Los nombres ayudan a encontrar la sesión en `/resume`.

### `/compact`

Resume mensajes antiguos y conserva una versión más pequeña del contexto. Es útil cuando la conversación es larga.

No es lo mismo que `/tree`:

- `/tree` cambia de camino en la conversación.
- `/compact` reduce el tamaño del camino actual.

### `/export [archivo]`

Exporta la sesión para revisarla o compartirla en otro formato. Revisa siempre el contenido antes de publicar una exportación: puede incluir prompts, respuestas, rutas y resultados de tools.

### `/import <archivo>`

Importa una sesión exportada y permite continuarla.

### `/share`

Publica la sesión como un gist privado de GitHub. No lo uses durante una demo con secretos o información sensible.

---

## 8. Comandos de recursos del proyecto

### `/reload`

Recarga los recursos sin reiniciar Pi:

- skills;
- extensiones;
- prompt templates;
- themes;
- context files;
- keybindings.

En esta demo es el comando que permite enseñar el ciclo:

```text
crear o modificar recurso
  → revisar archivo
  → /reload
  → probar el recurso
```

Después de crear la extensión de onboarding, ejecuta:

```text
/reload
```

Y prueba:

```text
/onboard-test Backend
```

Si no pasas un rol, la extensión muestra el selector:

```text
/onboard-test
```

### `/trust`

Guarda la decisión de confianza del proyecto para futuras sesiones.

Conviene explicarlo así:

> Confiar en un proyecto permite que Pi cargue sus recursos dinámicos. No significa que Pi haya auditado la seguridad de esos archivos.

Una extensión puede ejecutar código con los permisos del proceso, por lo que siempre hay que revisarla antes de confiar.

### `/skill:<nombre>`

Invoca explícitamente una skill disponible:

```text
/skill:repository-onboarding Backend
```

Una skill es conocimiento e instrucciones para el modelo. No es lo mismo que una extensión: la extensión añade comportamiento ejecutable a Pi; la skill orienta cómo resolver una tarea.

---

## 9. `tree`, `find` y `ls` desde el terminal

También existe un comando del sistema llamado `tree`. No hay que confundirlo con el comando slash `/tree`.

```text
/tree       → árbol de una sesión de Pi
 tree       → árbol de directorios del filesystem
```

### `ls`: mirar un directorio

```bash
ls
ls -la
ls -la src
```

`ls` responde principalmente:

> ¿Qué hay aquí?

Es muy bueno para inspeccionar un único directorio, pero no siempre muestra la jerarquía completa.

### `find`: buscar rutas

```bash
find . -maxdepth 3 -type f | sort
find . -type f -name '*.ts' | sort
find . -type d -name node_modules -prune -o -type f -print | sort
```

`find` responde principalmente:

> ¿Qué rutas cumplen esta condición?

Es más preciso y automatizable que `tree`, especialmente cuando quieres filtrar por tipo, nombre, profundidad o fecha. Su salida suele ser plana.

### `tree`: entender la forma del proyecto

```bash
tree -a -L 3 -I '.git|node_modules|dist'
```

`tree` responde principalmente:

> ¿Cómo está organizado este directorio?

Por eso es tan bueno para onboarding: muestra la jerarquía de un vistazo.

Una forma sencilla de explicarlo durante el video:

| Comando | Pregunta que responde | Mejor uso |
|---|---|---|
| `ls` | ¿Qué hay en este directorio? | Inspección local y rápida. |
| `find` | ¿Qué rutas coinciden con este filtro? | Búsqueda precisa y scripts. |
| `tree` | ¿Cuál es la forma del proyecto? | Orientación y explicación visual. |

### Por qué `tree` es mi favorito

`find` puede mostrar más información, pero normalmente entrega una lista plana. `tree` conserva las relaciones padre-hijo y permite ver rápidamente:

- dónde está el punto de entrada;
- qué carpetas son módulos;
- dónde viven los tests y la documentación;
- qué recursos están ocultos, como `.pi/`;
- qué áreas están separadas entre sí;
- si el repositorio parece pequeño, monolítico o dividido en paquetes.

La frase sugerida para la grabación:

> Me encanta `tree` porque antes de leer archivos me da un mapa mental del repositorio. `find` me ayuda a buscar y `ls` a inspeccionar; `tree` me ayuda a orientarme.

### Si `tree` no está instalado

Puedes usar este fallback:

```bash
find . -maxdepth 3 -print | sort
```

En macOS, si quieres instalar el comando de forma permanente:

```bash
brew install tree
```

Para la demo, también puedes mostrar el fallback y explicar que `tree` es una comodidad visual, no una dependencia de Pi.

---

## 10. Secuencia completa para grabar

Esta es una secuencia corta que combina los conceptos:

```text
/model
/settings
/hotkeys
/session
```

Desde el editor de Pi:

```text
!pwd
!command -v tree >/dev/null 2>&1 && tree -a -L 3 -I '.git|node_modules|dist' || find . -maxdepth 3 -print | sort
!find . -maxdepth 3 -type f | sort
```

Después envía dos prompts relacionados:

```text
Propón dos formas de organizar una aplicación pequeña que analiza repositorios.
Explica primero la alternativa A.
```

```text
Desarrolla la alternativa A con más detalle y enumera sus riesgos.
```

Crea una rama alternativa:

```text
/tree
```

Selecciona el primer prompt, edítalo y envía:

```text
Ahora desarrolla la alternativa B y compárala con la alternativa A.
```

Vuelve a mostrar:

```text
/tree
/session
```

Finalmente enseña los comandos de cierre:

```text
/export ~/tmp/pi-commands-session.html
/new
/resume
```

Sal de Pi con:

```text
/quit
```

---

## 11. Comandos adicionales para mencionar

No todos necesitan una demostración completa:

| Comando | Uso |
|---|---|
| `/login` | Iniciar autenticación. |
| `/logout` | Eliminar la credencial seleccionada. |
| `/scoped-models` | Elegir los modelos que participan en `Ctrl+P`. |
| `/copy` | Copiar la última respuesta del asistente. |
| `/changelog` | Mostrar cambios de versión. |
| `/quit` | Salir de Pi. |

Para la primera grabación es mejor enseñar pocos comandos con una historia clara que mostrar una lista larga sin contexto.

---

## 12. Qué no funciona igual en GitHub Actions

Esta demo es interactiva y local. En GitHub Actions normalmente usarás un prompt explícito:

```bash
pi --print --no-session "Resume el contenido de README.md"
```

Por eso no puedes depender de:

- `/tree`;
- `/resume`;
- selectores interactivos;
- `/settings` durante el job;
- la autenticación OAuth local;
- una extensión que espere `ctx.ui.select()`.

En Actions se prefieren:

```text
skill explícita
+ tools allowlist
+ prompt determinista
+ salida Markdown/JSON
```

El recorrido `/tree` pertenece especialmente a la experiencia local de Pi: es una de las razones por las que una sesión interactiva puede ser mucho más exploratoria que un job headless.
