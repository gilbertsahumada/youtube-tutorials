# Tutorial de Pi: instalación, configuración, skills y extensiones

Este README sigue el orden del video. Primero instalamos Pi, iniciamos una sesión en un directorio vacío, nos autenticamos con Codex y recorremos la interfaz. Después explicamos los conceptos mientras usamos Pi y, recién entonces, creamos el repositorio de la demo desde cero.

La revisión automatizada de Pull Requests pertenece al segundo demo, [`videos/pi-pr-evidence`](../pi-pr-evidence).

## Orden de la grabación

1. Instalar Pi.
2. Abrir Pi en un directorio de paseo, sin recursos del proyecto.
3. Ejecutar `/login` y conectarlo con ChatGPT/Codex.
4. Mostrar los comandos más importantes y `/settings`.
5. Explicar el modelo mental de Pi, sus tools, sesiones, thinking y contexto.
6. Crear un repositorio vacío para la demo.
7. Pedirle a Pi que proponga y cree una skill y una extensión.
8. Revisar los archivos, explicar qué hace cada recurso y recargar Pi.
9. Ejecutar el onboarding final en modo read-only.

El resultado final de esta demo es:

```text
videos/pi/
├── README.md
└── .pi/
    ├── package.json
    ├── package-lock.json
    ├── extensions/
    │   └── onboarding.ts
    └── skills/
        └── repository-onboarding/
            └── SKILL.md
```

> Para grabar el recorrido no necesitas abrir Pi dentro del repositorio final de este tutorial. Comienza en un directorio vacío y construye allí la demo. Esta carpeta contiene el resultado reproducible que queda versionado.

---

## 1. Requisitos

Necesitas:

- Node.js 22.19 o superior.
- npm.
- Git.
- Un terminal interactivo.
- Una cuenta ChatGPT Plus/Pro si vas a usar Codex mediante suscripción.

Comprueba Node antes de empezar:

```bash
node --version
npm --version
git --version
```

La instalación global de Pi y el `package.json` dentro de `.pi/` son cosas distintas:

- El CLI global permite ejecutar `pi` desde cualquier directorio.
- El paquete local de `.pi/` proporciona tipos y resolución de imports para las extensiones de este proyecto.

---

## 2. Instalar Pi

La instalación oficial mediante npm es:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` evita ejecutar scripts de ciclo de vida durante la instalación. Pi no los necesita para el uso normal.

Comprueba que el CLI quedó disponible:

```bash
pi --version
pi --help
```

También existe el instalador oficial de `pi.dev`:

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

En el video usamos npm porque hace explícito qué paquete se instala.

---

## 3. Primera sesión: Pi antes de crear el repositorio

Antes de construir la demo, abre Pi en un directorio de paseo. Así puedes enseñar la aplicación sin que todavía existan skills o extensiones locales del proyecto:

```bash
mkdir -p ~/tmp/pi-tour
cd ~/tmp/pi-tour
pi
```

Este directorio puede estar vacío. No hace falta crear `.pi/`, `AGENTS.md` ni un repositorio Git para hacer el primer recorrido.

Cuando Pi arranque, observa:

- El encabezado de inicio.
- El área de mensajes.
- El editor inferior.
- El footer con modelo, thinking, tokens y context window.

Una primera solicitud para probar el ciclo básico:

```text
Dime en qué directorio estoy y qué archivos puedes encontrar aquí.
```

Pi trabaja sobre el directorio actual. El modelo recibe un conjunto de tools, llama a una de ellas, recibe el resultado y decide si necesita continuar.

### 3.1 Iniciar sesión con Codex

Dentro de Pi ejecuta:

```text
/login
```

En el selector elige **ChatGPT Plus/Pro (Codex)**, o el nombre equivalente que muestre tu versión de Pi. Completa el flujo OAuth en el navegador y vuelve al terminal.

Las credenciales quedan gestionadas por Pi en:

```text
~/.pi/agent/auth.json
```

Ese archivo contiene credenciales personales. Nunca lo subas al repositorio ni lo imprimas en logs.

La suscripción OAuth es adecuada para el uso local interactivo. Para CI/CD utilizaremos una API key administrada como secret en el demo separado de revisión de Pull Requests; no copiamos credenciales personales de OAuth a GitHub Actions.

Comprueba el modelo disponible:

```text
/model
```

Puedes seleccionar un modelo desde el selector o pulsar `Ctrl+L`.

### 3.2 API key como alternativa

Pi también puede usar una API key. Por ejemplo, para un proveedor compatible con OpenAI:

```bash
export OPENAI_API_KEY="..."
pi --model openai/<model-id>
```

La variable depende del proveedor. Pi documenta las variables soportadas en [Providers](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md).

No pongas una API key en este README, en una skill, en una extensión ni en el repositorio.

---

## 4. Los comandos más importantes

Escribe `/` en el editor para abrir el autocompletado de comandos. Para el primer video, estos son los comandos que vale la pena mostrar:

| Prioridad | Comando | Qué enseña |
|---|---|---|
| Imprescindible | `/login` | OAuth o API key del proveedor. |
| Imprescindible | `/model` | Selección del modelo; también `Ctrl+L`. |
| Imprescindible | `/settings` | Thinking, tema, compaction, transporte y preferencias. |
| Imprescindible | `/session` | Sesión actual, archivo, tokens, coste y estadísticas. |
| Muy útil | `/hotkeys` | Todos los atajos configurados. |
| Muy útil | `/reload` | Recargar skills, extensiones, prompts, themes y contexto. |
| Muy útil | `/trust` | Guardar la decisión de confianza del proyecto. |
| Muy útil | `/compact` | Resumir el contexto anterior manualmente. |
| Para sesiones | `/new` | Empezar una sesión nueva. |
| Para sesiones | `/resume` | Elegir una sesión anterior. |
| Para sesiones | `/tree` | Navegar por las ramas de una sesión. |
| Para terminar | `/quit` | Salir de Pi. |

Comandos adicionales que puedes mencionar si queda tiempo:

- `/scoped-models`: seleccionar los modelos que participan en el ciclo de `Ctrl+P`.
- `/name <nombre>`: asignar un nombre a la sesión.
- `/export [archivo]`: exportar una sesión a HTML o JSONL.
- `/copy`: copiar la última respuesta del asistente.
- `/changelog`: consultar cambios de versión.
- `/logout`: eliminar la credencial seleccionada.

### 4.1 El recorrido recomendado en pantalla

Después de `/login`, una secuencia corta y clara es:

```text
/model
/settings
/hotkeys
/session
```

En `/settings` muestra especialmente:

- `defaultThinkingLevel`.
- `theme`.
- `quietStartup`.
- `tuiMode` (`regular` o `fullscreen`).
- `compaction.enabled`.
- `steeringMode` y `followUpMode`.
- `transport`.
- `defaultProjectTrust`, si quieres explicar confianza de proyectos.

No necesitas cambiar todo. La intención es enseñar que Pi tiene una configuración global y otra por proyecto, y que el comportamiento se puede ajustar sin modificar el código de Pi.

Para salir del recorrido:

```text
/quit
```

### 4.2 Atajos y sintaxis que conviene mostrar

| Atajo o sintaxis | Uso |
|---|---|
| `@` | Buscar y adjuntar un archivo del proyecto. |
| `!comando` | Ejecutar un comando y enviar su salida al modelo. |
| `!!comando` | Ejecutarlo sin añadir su salida al contexto del modelo. |
| `Shift+Enter` | Insertar una nueva línea en el editor. |
| `Escape` | Cancelar la operación actual. |
| `Ctrl+L` | Abrir el selector de modelos. |
| `Ctrl+P` / `Shift+Ctrl+P` | Ciclar modelos configurados. |
| `Shift+Tab` | Cambiar el nivel de thinking. |
| `Ctrl+T` | Colapsar o expandir bloques de thinking visibles. |
| `Ctrl+O` | Colapsar o expandir la salida de tools. |
| `Ctrl+G` | Abrir el editor externo configurado. |
| `Ctrl+X` | Copiar el último mensaje del asistente. |
| `Alt+Enter` | Encolar un follow-up mientras Pi está trabajando. |

`!!` no es una garantía de seguridad: es una orden explícita del usuario para no enviar esa salida al modelo. La tool `bash` sigue existiendo para el modelo si está activa.

### 4.3 Equivalentes desde el CLI

Pi también se puede controlar desde la shell:

```bash
pi                              # sesión interactiva nueva
pi -c                           # continuar la sesión más reciente
pi -r                           # elegir una sesión anterior
pi --model <modelo>             # seleccionar un modelo al iniciar
pi --thinking medium            # iniciar con un nivel de thinking
pi -p "Resume el directorio"    # modo print, sin TUI interactiva
pi --no-session                 # sesión efímera
pi --tools read,grep,find,ls    # herramientas read-only
pi --list-models                # listar modelos disponibles
pi --help                       # referencia completa
```

Para refrescar los catálogos de modelos:

```bash
pi update --models
```

---

## 5. Qué es Pi

Pi es un **coding harness minimalista para el terminal**. El modelo no modifica un repositorio directamente: Pi le proporciona contexto, un modelo, una sesión y un conjunto de tools para interactuar con el directorio actual.

El ciclo mental es:

```text
prompt del usuario
      → modelo
      → llamada a una tool
      → resultado de la tool
      → siguiente decisión del modelo
```

Pi no intenta imponer un workflow completo. En lugar de incluir obligatoriamente plan mode, subagentes, MCP o un sistema de permisos, permite construir esos comportamientos mediante extensiones, skills o paquetes.

### 5.1 Las cuatro tools por defecto

En una sesión normal Pi expone inicialmente cuatro tools al modelo:

| Tool | Para qué sirve |
|---|---|
| `read` | Leer archivos o fragmentos de archivos. |
| `write` | Crear o sobrescribir archivos. |
| `edit` | Modificar archivos mediante reemplazos exactos. |
| `bash` | Ejecutar comandos del shell. |

Pi también incluye tres tools built-in de lectura:

```text
grep, find, ls
```

Estas no forman parte del conjunto inicial de cuatro, pero se pueden habilitar mediante `--tools`. La forma precisa de decirlo en el video es:

> Pi tiene siete tools built-in, pero la sesión por defecto empieza con cuatro: `read`, `write`, `edit` y `bash`.

Para ver la lista completa:

```bash
pi --help
```

Para la ejecución final de esta demo usaremos una allowlist read-only:

```bash
pi --tools read,grep,find,ls
```

Con ese comando el modelo no recibe `write`, `edit` ni `bash` como tools invocables.

### 5.2 El usuario y el modelo no tienen exactamente la misma interfaz

El usuario puede escribir comandos como `!git status` o `!!git status` desde el editor. Eso es distinto de las tools que Pi habilita para que el modelo las invoque.

Por eso distinguimos:

- **Tools del modelo:** `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`.
- **Comandos del usuario:** `/settings`, `/model`, `/reload`, `!comando`, etc.
- **Extensiones:** código que puede registrar nuevos comandos, tools, eventos y UI.
- **Skills:** instrucciones que el modelo carga bajo demanda.

---

## 6. Modelo, thinking y contexto

### 6.1 Seleccionar el modelo

Dentro de Pi:

```text
/model
```

También puedes pulsar `Ctrl+L`. El selector muestra los modelos disponibles para los proveedores autenticados. Los catálogos dependen de la versión de Pi, la cuenta y el proveedor.

Desde la shell:

```bash
pi --list-models
```

Al iniciar Pi también puedes indicar el modelo:

```bash
pi --provider openai-codex --model <model-id>
```

O usar el identificador completo:

```bash
pi --model openai-codex/<model-id>
```

No inventes `<model-id>`: usa uno que aparezca en `/model` o `pi --list-models`.

### 6.2 Configurar el thinking

El nivel de thinking se puede cambiar de tres formas:

1. Desde `/settings`.
2. Pulsando `Shift+Tab`.
3. Al iniciar Pi:

```bash
pi --thinking high
```

Los niveles disponibles son:

```text
off, minimal, low, medium, high, xhigh, max
```

No todos los modelos soportan todos los niveles. Pi ajusta el valor a las capacidades del modelo; un modelo que no soporta reasoning termina usando `off`.

Hay dos conceptos distintos:

- `Shift+Tab` cambia cuánto reasoning se solicita al modelo.
- `Ctrl+T` solo colapsa o expande el bloque de thinking en pantalla.

El borde del editor cambia de color para reflejar el nivel activo. El footer muestra el nivel junto al modelo cuando el modelo soporta reasoning.

### 6.3 Mostrar el contexto en pantalla

Aquí conviene corregir una confusión frecuente: Pi muestra dos cosas relacionadas, pero no hay un único botón llamado `showContext`.

#### Uso del context window

El footer inferior muestra automáticamente información como:

```text
↑tokens ↓tokens ... 12.4%/128k (auto)              modelo • medium
```

El porcentaje representa el uso estimado del context window del modelo actual. También pueden aparecer tokens de entrada/salida, cache, coste y el modelo seleccionado.

**No existe un setting `showContext` para activar este porcentaje:** el uso del contexto forma parte del footer interactivo por defecto. Si la terminal es muy estrecha, el footer puede truncarse.

`/session` muestra información más detallada y `/compact` permite resumir contexto manualmente. La compactación automática está activada por defecto y se puede revisar en `/settings`.

#### Archivos de contexto cargados

El encabezado de inicio puede listar secciones como:

```text
Context
Skills
Prompts
Extensions
Themes
```

La sección `Context` corresponde principalmente a `AGENTS.md` y `CLAUDE.md`. Pi los busca en:

- `~/.pi/agent/AGENTS.md` — instrucciones globales.
- Directorios padres del directorio actual.
- El directorio actual.
- `CLAUDE.md` en esas mismas ubicaciones.

Para que el encabezado sea visible, deja `quietStartup` en `false`:

```json
{
  "quietStartup": false
}
```

Si existe una configuración silenciosa, puedes forzar el encabezado con:

```bash
pi --verbose
```

No confundas estos conceptos:

| Concepto | Dónde se observa | Qué lo controla |
|---|---|---|
| Uso actual del contexto | Footer: `%/contextWindow` | Pi lo muestra automáticamente. |
| Instrucciones cargadas | Encabezado: `Context` | `AGENTS.md`, `CLAUDE.md`, `quietStartup` y `--verbose`. |
| Capacidad del modelo | `/model` y metadata | El modelo y su `contextWindow`. |

`TUI mode` (`regular` o `fullscreen`) cambia la disposición de la interfaz, pero no activa el uso del contexto.

---

## 7. Recursos globales y recursos locales

Una parte importante del video es explicar que Pi puede tener recursos personales globales y recursos específicos de cada proyecto.

### 7.1 Skills globales y locales

Pi descubre skills en estas ubicaciones principales:

| Alcance | Ubicación |
|---|---|
| Global | `~/.pi/agent/skills/` |
| Global compatible | `~/.agents/skills/` |
| Proyecto | `.pi/skills/` |
| Proyecto compatible | `.agents/skills/` |

Las skills de proyecto se buscan desde el directorio actual y sus ancestros hasta la raíz del repositorio Git. Una skill tiene como entrada un archivo `SKILL.md`.

Ejemplos:

```text
~/.pi/agent/skills/review/SKILL.md          # personal, todos los proyectos
~/.agents/skills/pdf-tools/SKILL.md        # personal/compartida
mi-repo/.pi/skills/repository-onboarding/SKILL.md  # solo este proyecto
mi-repo/.agents/skills/testing/SKILL.md    # solo este proyecto o árbol
```

### 7.2 Extensiones globales y locales

Las extensiones se descubren en:

| Alcance | Ubicación |
|---|---|
| Global | `~/.pi/agent/extensions/` |
| Proyecto | `.pi/extensions/` |

Una extensión es un módulo TypeScript o JavaScript que puede registrar comandos, tools, eventos, atajos y UI.

Ejemplos:

```text
~/.pi/agent/extensions/safety-gate.ts       # protección personal global
mi-repo/.pi/extensions/onboarding.ts        # comportamiento de este proyecto
```

### 7.3 Settings, contexto y otros recursos

La misma idea se aplica a otros recursos:

| Recurso | Global | Proyecto |
|---|---|---|
| Settings | `~/.pi/agent/settings.json` | `.pi/settings.json` |
| Contexto | `~/.pi/agent/AGENTS.md` | `AGENTS.md` o `CLAUDE.md` |
| Prompt templates | `~/.pi/agent/prompts/` | `.pi/prompts/` |
| Themes | `~/.pi/agent/themes/` | `.pi/themes/` |

Los settings de proyecto sobrescriben los globales. Los context files se combinan siguiendo el árbol de directorios.

### 7.4 Qué conviene poner en cada lugar

Usa recursos **globales** para workflows personales que quieres en todos tus proyectos:

- Una skill personal para revisar seguridad.
- Una extensión que pide confirmación antes de comandos destructivos.
- Tus atajos, tema o preferencias de editor.

Usa recursos **locales** para comportamientos que deben viajar con el repositorio:

- `repository-onboarding`.
- Convenciones del equipo.
- Comandos específicos del proyecto.
- Una extensión que añade un comando propio de esa aplicación.

Para esta demo usamos recursos locales porque queremos que otra persona pueda clonar el repositorio y reproducirla. No colocamos la skill ni la extensión en `~/.pi/agent/`.

### 7.5 Packages y alcance de instalación

Pi también puede empaquetar skills, extensiones, prompts y themes:

```bash
pi install npm:@org/mi-paquete       # instalación global por defecto
pi install npm:@org/mi-paquete -l    # instalación local del proyecto
pi list                              # paquetes configurados
```

La instalación global escribe la configuración del usuario. `-l` usa `.pi/settings.json` y `.pi/` del proyecto. Esto es diferente de crear directamente `.pi/skills/` o `.pi/extensions/`, pero sirve para distribuir varios recursos juntos.

Para probar un recurso solo durante una ejecución:

```bash
pi -e ./ruta/a/extension.ts
pi --skill ./ruta/a/SKILL.md
```

Para controlar exactamente qué se descubre:

```bash
pi --no-extensions
pi --no-skills
pi --no-context-files
```

`--skill` explícito sigue pudiendo cargar una skill aunque se use `--no-skills`. Revisa siempre el código de una extensión y el contenido de una skill antes de confiar en ellos: las extensiones ejecutan código con tus permisos y las skills pueden instruir al modelo para realizar acciones.

### 7.6 Project trust

Pi puede pedir confianza antes de cargar recursos locales del proyecto. Confiar permite cargar `.pi/settings.json`, `.pi` y extensiones del proyecto.

En el recorrido:

1. Primero abrimos Pi en un directorio sin `.pi`.
2. Después creamos `.pi/` con la skill y la extensión.
3. Pi puede pedir confianza al reiniciar o al recargar.
4. Aceptamos solo después de revisar los archivos.
5. `/trust` guarda la decisión para futuras sesiones.

La confianza del proyecto no es una revisión de seguridad automática. Es una autorización para cargar recursos dinámicos del proyecto.

---

## 8. Crear el repositorio desde cero

Después del recorrido inicial, sal de Pi y crea un directorio nuevo. Debe estar vacío salvo por `.git`:

```text
/quit
```

```bash
mkdir -p ~/projects/pi-onboarding-demo
cd ~/projects/pi-onboarding-demo
git init
pi --verbose
```

Si tienes un repositorio remoto vacío, puedes clonarlo en lugar de ejecutar `git init`. No agregues todavía un README generado por GitHub si quieres que la primera pantalla sea realmente un repositorio sin archivos.

En este primer arranque no deberían existir todavía:

```text
.pi/
AGENTS.md
CLAUDE.md
```

Esto permite enseñar la diferencia entre una sesión de Pi sin recursos locales y la sesión posterior, cuando el proyecto ya trae su propia skill y extensión.

---

## 9. Pedirle a Pi que cree la demo

Puedes decirle a la audiencia que no tiene que memorizar el código: Pi puede proponer y crear una skill o una extensión si le explicas el objetivo. La práctica recomendable es separar **planificación**, **implementación** y **revisión**.

### 9.1 Primero pide una propuesta

Con las tools normales activas, escribe:

```text
Quiero construir una demo educativa de Pi en este repositorio vacío.

La demo debe enseñar cómo una extensión recibe el rol de un desarrollador y
le pide al modelo usar una skill llamada repository-onboarding.

La skill debe analizar repositorios desconocidos en modo inicialmente read-only,
respaldar afirmaciones con rutas reales y distinguir evidencia, inferencia y
preguntas abiertas.

Antes de crear o modificar archivos:
1. Propón la estructura de directorios.
2. Explica qué responsabilidad tendrá la skill.
3. Explica qué responsabilidad tendrá la extensión.
4. Indica qué dependencias locales necesitaríamos.
5. Señala riesgos y decisiones abiertas.
No escribas archivos todavía.
```

Esto muestra que Pi no es solo un generador de archivos: primero puede explorar el problema, razonar sobre la estructura y hacer preguntas.

### 9.2 Después pide la implementación

Cuando revises la propuesta, puedes solicitar:

```text
Implementa la propuesta aprobada.

Crea únicamente una demo local de Pi con esta estructura:

.pi/package.json
.pi/extensions/onboarding.ts
.pi/skills/repository-onboarding/SKILL.md

La extensión debe registrar /onboard-test, aceptar un rol como argumento o
mostrar un selector con Backend, Frontend, Fullstack y DevOps, comprobar que Pi
esté idle y enviar al modelo un mensaje para usar repository-onboarding.

La skill debe:
- Trabajar inicialmente en modo read-only.
- No modificar archivos ni instalar dependencias.
- Respetar AGENTS.md, CLAUDE.md y la documentación local.
- Citar rutas reales.
- Separar evidencia, inferencia y preguntas abiertas.
- Generar un onboarding progresivo según el rol.

No ejecutes npm install ni agregues credenciales. Después de escribir, resume
cada archivo y espera mi revisión.
```

Pídeselo a Pi, pero revisa siempre el diff antes de aceptar el resultado. Una extensión es código ejecutable y una skill puede cambiar la conducta del modelo.

### 9.3 Revisa lo que creó

Puedes pedirle a Pi que muestre el resultado o revisar desde otra terminal:

```bash
find . -maxdepth 5 -type f -not -path './.git/*' -print | sort
git diff -- .
```

La estructura esperada es:

```text
.pi/
├── package.json
├── extensions/
│   └── onboarding.ts
└── skills/
    └── repository-onboarding/
        └── SKILL.md
```

Si el contenido es correcto, instala la dependencia local usando el lockfile versionado de la demo:

```bash
npm ci --prefix .pi
```

En un proyecto nuevo generado durante la grabación, crea el lockfile con la versión que decidas fijar y revísalo antes de versionarlo. En esta demo reproducible el paquete está fijado a `0.83.0` en `.pi/package.json` y en `.pi/package-lock.json`.

---

## 10. Crear la estructura final de la demo

La demo versionada contiene:

```text
videos/pi/
├── README.md
└── .pi/
    ├── package.json
    ├── package-lock.json
    ├── extensions/
    │   └── onboarding.ts
    └── skills/
        └── repository-onboarding/
            └── SKILL.md
```

`.pi/` contiene recursos específicos del proyecto. Si Pi solicita confiar en el proyecto, revisa primero la extensión y la skill, y después acepta la confianza.

### 10.1 El package local

`.pi/package.json` declara la dependencia que necesita la extensión para sus tipos e imports:

```json
{
  "name": "pi-onboarding-demo",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@earendil-works/pi-coding-agent": "0.83.0"
  }
}
```

Instala sin crear dependencias en la raíz:

```bash
npm ci --prefix .pi
```

### 10.2 La skill `repository-onboarding`

Una **skill** es un paquete de instrucciones especializadas. No es un comando shell ni una función TypeScript: le enseña al modelo cómo resolver una clase de problemas y cuándo aplicar ese procedimiento.

Crea:

```text
.pi/skills/repository-onboarding/SKILL.md
```

Toda skill debe tener al menos `name` y `description` en el frontmatter:

```markdown
---
name: repository-onboarding
description: Analiza repositorios desconocidos y crea recorridos de onboarding para desarrolladores según su rol. Úsalo cuando el usuario quiera entender la arquitectura, estructura, ejecución o convenciones de un codebase.
---

# Repository Onboarding

## Reglas

- Trabaja inicialmente en modo de solo lectura.
- No modifiques archivos ni instales dependencias.
- Respeta AGENTS.md, CLAUDE.md y la documentación del repositorio.
- Respalda las afirmaciones con rutas reales.
- Distingue entre evidencia, inferencia y preguntas abiertas.

## Proceso

1. Lee el README y las instrucciones locales.
2. Inspecciona manifiestos, estructura y entry points.
3. Identifica cómo se ejecuta, prueba y construye el proyecto.
4. Adapta el recorrido al rol del desarrollador.
5. Entrega un onboarding progresivo con comandos verificables.
```

La versión completa está en [`SKILL.md`](.pi/skills/repository-onboarding/SKILL.md). También define los roles `Backend`, `Frontend`, `Fullstack` y `DevOps`, reglas de solo lectura y un formato de salida reproducible.

Pi descubre las skills así:

1. Escanea las ubicaciones globales y locales al iniciar.
2. Añade sus nombres y descripciones al system prompt.
3. Cuando una tarea coincide, el modelo lee el `SKILL.md` completo con `read`.
4. El modelo sigue las instrucciones usando las tools activas.

Puedes forzarla con:

```text
/skill:repository-onboarding Backend
```

O cargarla desde el CLI:

```bash
pi --skill .pi/skills/repository-onboarding/SKILL.md
```

### 10.3 La extensión `onboarding.ts`

Una **extensión** es código TypeScript ejecutado por Pi. Puede añadir comandos, tools, eventos, atajos, UI y validaciones.

Crea:

```text
.pi/extensions/onboarding.ts
```

La extensión de esta demo es:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const ROLES = [
    "Backend",
    "Frontend",
    "Fullstack",
    "DevOps",
]

export default function extension(pi: ExtensionAPI) {
    pi.registerCommand("onboard-test", {
        description: "This extension provides onboarding functionality for new users.",
        handler: async (args, ctx) => {
            if (!ctx.isIdle()) {
                ctx.ui.notify("Espera a que Pi termine la tarea actual antes de iniciar el onboarding", "warning")
                return;
            }

            let role = args.trim();

            if (!role) {
                const selectedRole = await ctx.ui.select("Selecciona tu rol", ROLES);
                if (!selectedRole) {
                    ctx.ui.notify("No se seleccionó ningún rol. Cancelando onboarding.", "warning")
                    return;
                }
                role = selectedRole;
            }

            ctx.ui.notify("Iniciando onboarding", "info")

            pi.sendUserMessage(
                [
                    "Usa la skill disponible llamada repository-onboarding.",
                    "Lee y sigue sus instrucciones antes de analizar el proyecto.",
                    "",
                    `Rol del desarrollador: ${role}`,
                    "",
                    "Analiza el repositorio actual y genera el onboarding.",
                    "Respalda las afirmaciones con rutas de archivos reales.",
                    "No modifiques archivos ni instales dependencias.",
                ].join("\n"),
            );
        }
    })
}
```

Qué hace cada parte:

- `pi.registerCommand("onboard-test", ...)` crea `/onboard-test`.
- `ctx.isIdle()` evita iniciar otro onboarding mientras Pi trabaja.
- `ctx.ui.select()` muestra el selector de rol.
- `ctx.ui.notify()` muestra feedback en la interfaz.
- `pi.sendUserMessage()` inyecta un mensaje de usuario real y dispara un nuevo turno.
- El mensaje transmite el rol y pide cargar `repository-onboarding`.

La extensión **no contiene el conocimiento de onboarding**. Implementa la interacción y la orquestación mínima; la skill contiene el proceso de análisis.

Puedes probar la extensión explícitamente:

```bash
pi -e .pi/extensions/onboarding.ts
```

En el flujo normal se descubre automáticamente desde `.pi/extensions/` después de confiar en el proyecto.

---

## 11. Skill versus extensión

| | Skill | Extensión |
|---|---|---|
| Forma | `SKILL.md` con instrucciones | Módulo TypeScript/JavaScript |
| Propósito | Enseñar un proceso especializado al modelo | Cambiar el comportamiento de Pi |
| Activación | Descripción, `/skill:nombre` o `--skill` | Carga automática, `-e` o `--extension` |
| Puede definir | Reglas, pasos, formato, scripts y referencias | Comandos, tools, hooks, UI, atajos y providers |
| En esta demo | Analiza el repositorio y genera onboarding | Recibe el rol y envía el kickoff |
| Riesgo | Puede instruir al modelo para ejecutar acciones | Ejecuta código con los permisos del usuario |

La separación es deliberada:

```text
extensión = interacción y control
skill     = conocimiento y procedimiento
Pi        = runtime, sesión, modelo y tools
```

Si solo necesitas que el modelo siga un proceso, empieza por una skill. Si necesitas un selector, un comando, una confirmación, una integración externa o una regla que bloquee tools, añade una extensión.

---

## 12. Recargar y ejecutar la demo final

Después de crear o modificar `SKILL.md` y `onboarding.ts`, si sigues en la sesión del proyecto ejecuta:

```text
/reload
```

Si todavía estás en la sesión del directorio vacío, sal y abre Pi desde el proyecto que acabas de crear:

```text
/quit
```

```bash
cd ~/projects/pi-onboarding-demo
pi --verbose
```

Acepta la confianza del proyecto después de revisar `.pi/` y, si hiciera falta, ejecuta `/reload` en esa nueva sesión.

Pi recarga:

- Context files.
- Skills.
- Extensions.
- Prompt templates.
- Themes.
- Keybindings.

Si cambió la confianza del proyecto o una configuración importante, reinicia Pi para que el recorrido sea claro y reproducible.

Inicia la demo final con únicamente tools de lectura. Ejecuta el comando desde la raíz del repositorio que contiene la carpeta `videos/pi`:

```bash
cd /ruta/a/youtube-tutorials
pi --verbose --tools read,grep,find,ls
```

Si durante la grabación estás dentro del repositorio creado desde cero, usa su ruta real en lugar de `/ruta/a/youtube-tutorials`.

Acepta la confianza solo después de revisar `.pi/`. En el encabezado deberías poder identificar la skill y la extensión cargadas.

Ejecuta:

```text
/onboard-test Backend
```

La extensión y la skill deben existir en el proyecto actual. Si todavía estás en el directorio vacío, primero termina la creación de `.pi/` y reinicia Pi desde ese proyecto; `/onboard-test` no existirá antes de cargar `onboarding.ts`.

Para probar únicamente la skill, sin el comando de la extensión:

```text
/skill:repository-onboarding Backend
```

O sin argumentos para mostrar el selector:

```text
/onboard-test
```

Prueba también:

```text
/onboard-test Frontend
/onboard-test Fullstack
/onboard-test DevOps
```

### Resultado esperado

1. La extensión comprueba que Pi esté idle.
2. Se usa el rol escrito o el rol seleccionado.
3. Pi muestra una notificación de inicio.
4. La extensión envía el kickoff al modelo.
5. El modelo carga `repository-onboarding`.
6. La skill guía la inspección del repositorio.
7. El modelo usa `read`, `grep`, `find` y `ls`.
8. La respuesta distingue evidencia, inferencias, preguntas abiertas y limitaciones.

La allowlist read-only es una defensa adicional. La skill también prohíbe modificar archivos e instalar dependencias, pero la restricción de tools hace que el límite sea visible y verificable.

---

## 13. Solución de problemas

### `pi: command not found`

Comprueba la versión y la ruta del binario:

```bash
npm prefix -g
command -v pi
```

Añade el directorio de binarios globales al `PATH` según tu instalación de Node y abre un terminal nuevo.

### Codex no aparece en `/login` o `/model`

- Comprueba que ejecutaste `/login` dentro de Pi.
- Verifica que la cuenta tenga ChatGPT Plus/Pro.
- Ejecuta `pi update --models` para refrescar el catálogo.
- Revisa la versión con `pi --version`.

### La skill no aparece

- Confirma que el archivo se llame exactamente `SKILL.md`.
- Revisa que tenga `name` y `description` en el frontmatter.
- Ejecuta `/reload` o reinicia Pi.
- Acepta la confianza del proyecto.
- Comprueba que no estés usando `--no-skills` sin `--skill` explícito.

### La extensión no aparece

- Confirma la ruta `.pi/extensions/onboarding.ts`.
- Ejecuta `pi -e .pi/extensions/onboarding.ts` para probarla explícitamente.
- Ejecuta `/reload`.
- Comprueba que `npm ci --prefix .pi` haya terminado correctamente.

### No veo `Context` en el encabezado

- Usa `pi --verbose`.
- Revisa que `quietStartup` sea `false`.
- Comprueba que exista un `AGENTS.md` o `CLAUDE.md` en una ubicación que Pi cargue.
- Recuerda que el porcentaje del context window vive en el footer y no depende de `quietStartup`.

### El modelo intenta modificar archivos

Reinicia con la allowlist:

```bash
pi --tools read,grep,find,ls
```

No uses `--tools read,write,edit,bash` para esta parte si el objetivo es demostrar onboarding read-only.

---

## 14. Seguridad y reproducibilidad

- No subas `~/.pi/agent/auth.json`.
- No pongas API keys en `README.md`, prompts, skills ni extensiones.
- Revisa el código de toda extensión: las extensiones ejecutan TypeScript con tus permisos.
- Revisa también las skills: pueden indicarle al modelo que ejecute acciones.
- Mantén `package-lock.json` versionado y usa `npm ci`.
- Para el onboarding inicial, limita las tools a `read,grep,find,ls`.
- Usa recursos locales para que la demo viaje con el repositorio.
- Usa recursos globales para preferencias y workflows personales, no para esconder dependencias de la demo.
- La autenticación OAuth de suscripción es para uso local interactivo; la API key administrada para CI se documenta en `videos/pi-pr-evidence`.

---

## Documentación oficial consultada

- [Pi README y Quick Start](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
- [Providers y autenticación](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md)
- [Settings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md)
- [Using Pi y comandos](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md)
- [Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
- [Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Keybindings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/keybindings.md)
- [Pi Packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

La segunda demo enseña Pi como reviewer read-only de Pull Requests en GitHub Actions: [`videos/pi-pr-evidence`](../pi-pr-evidence).
