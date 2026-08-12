# Tutorial de Pi: de cero a skill y extensión de onboarding

Este README es el recorrido completo del primer video. La idea es empezar con Pi desde cero, entender su interfaz y sus primitivas, conectarlo con Codex y terminar construyendo un repositorio pequeño con una **skill** y una **extensión**.

La demo final queda en esta carpeta. La revisión automatizada de Pull Requests pertenece al segundo demo, [`videos/pi-pr-evidence`](../pi-pr-evidence).

## Qué vas a construir

Al terminar tendrás:

- Pi instalado y autenticado localmente con una suscripción de Codex.
- Un modelo seleccionado y un nivel de thinking configurado.
- Visibilidad del contexto cargado y del uso del context window.
- Una skill `repository-onboarding` con reglas y un formato de salida.
- Una extensión TypeScript con el comando `/onboard-test`.
- Un flujo read-only que recibe el rol del desarrollador y ejecuta la skill.

El flujo final es:

```text
/onboard-test Backend
        │
        ▼
extensión TypeScript
        │  selecciona/transmite el rol
        ▼
skill repository-onboarding
        │  define el proceso y las reglas
        ▼
Pi + herramientas read-only
        │
        ▼
onboarding con evidencia del repositorio
```

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
```

> La instalación global de Pi y el `package.json` dentro de `.pi/` son cosas distintas. El CLI se instala globalmente para poder ejecutar `pi`; el paquete local sirve para resolver tipos e imports de las extensiones de este proyecto.

---

## 2. Instalar Pi

La instalación oficial mediante npm es:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` evita ejecutar scripts de ciclo de vida durante la instalación. Pi no los necesita para su uso normal.

Comprueba que el CLI quedó disponible:

```bash
pi --version
pi --help
```

También existe el instalador oficial de `pi.dev`:

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

En el video usaremos npm porque hace explícito qué paquete se instala.

---

## 3. Qué es Pi

Pi es un **coding harness minimalista para el terminal**. El modelo no modifica un repositorio directamente: Pi le proporciona un contexto, un conjunto de herramientas y un ciclo para ejecutar esas herramientas y devolver sus resultados al modelo.

El ciclo mental es:

```text
prompt del usuario
      → modelo
      → llamada a una herramienta
      → resultado de la herramienta
      → siguiente decisión del modelo
```

Pi no intenta imponer un workflow completo. En lugar de incluir de forma obligatoria plan mode, subagentes, MCP o un sistema de permisos, permite construir esos comportamientos mediante extensiones, skills o paquetes.

### Las cuatro herramientas por defecto

En una sesión normal Pi expone inicialmente cuatro herramientas al modelo:

| Herramienta | Para qué sirve |
|---|---|
| `read` | Leer archivos o fragmentos de archivos. |
| `write` | Crear o sobrescribir archivos. |
| `edit` | Modificar archivos mediante reemplazos exactos. |
| `bash` | Ejecutar comandos del shell. |

Pi también incluye tres herramientas built-in de lectura:

```text
grep, find, ls
```

Estas no forman parte del conjunto inicial de cuatro, pero se pueden habilitar mediante `--tools`. Por eso conviene explicar la diferencia:

> **Pi tiene siete herramientas built-in, pero la sesión por defecto empieza con cuatro: `read`, `write`, `edit` y `bash`.**

Para ver el conjunto completo puedes consultar:

```bash
pi --help
```

Más adelante ejecutaremos la demo de onboarding con una allowlist read-only:

```bash
pi --tools read,grep,find,ls
```

Con ese comando el modelo no recibe `write`, `edit` ni `bash` como herramientas invocables.

---

## 4. Primera sesión interactiva

Pi trabaja sobre el directorio actual. Primero entra al repositorio que quieres explorar:

```bash
cd /ruta/al/repositorio
pi
```

Al iniciar puede aparecer una pregunta para confiar en el proyecto. Acepta la confianza únicamente si revisaste el repositorio y quieres permitir que Pi cargue sus recursos locales (`.pi`, extensiones, skills y settings).

Una primera pregunta útil es:

```text
Resume este repositorio y dime cómo ejecutar sus comprobaciones.
```

Observa el recorrido:

1. Pi muestra el prompt.
2. El modelo decide si necesita usar una herramienta.
3. La herramienta aparece en la interfaz.
4. Pi muestra el resultado.
5. El modelo continúa hasta responder.

---

## 5. Conectarse con OpenAI Codex

Para usar la suscripción de ChatGPT localmente, inicia Pi y ejecuta:

```text
/login
```

En el selector elige la opción de **ChatGPT Plus/Pro (Codex)** o el nombre equivalente que muestre tu versión de Pi. Completa el flujo OAuth en el navegador.

Después vuelve a Pi. Las credenciales quedan gestionadas por Pi en:

```text
~/.pi/agent/auth.json
```

Ese archivo contiene credenciales personales. Nunca lo subas al repositorio ni lo imprimas en logs.

Confirma el proveedor y el modelo desde la interfaz:

```text
/model
```

Para Codex local usamos una suscripción OAuth; no copiamos una API key personal al proyecto. Para CI/CD utilizaremos una API key administrada como secret, en el demo separado de revisión de Pull Requests.

### API keys como alternativa

Pi también puede usar una API key de un proveedor. Por ejemplo:

```bash
export OPENAI_API_KEY="..."
pi --model openai/<model-id>
```

La variable depende del proveedor. Pi documenta las variables soportadas en [Providers](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md).

---

## 6. Los comandos más importantes

Escribe `/` en el editor para abrir el autocompletado de comandos.

| Comando | Uso |
|---|---|
| `/login` / `/logout` | Gestionar OAuth o credenciales de proveedor. |
| `/model` | Elegir otro modelo. También se puede usar `Ctrl+L`. |
| `/settings` | Cambiar thinking, tema, transporte y otras opciones. |
| `/session` | Ver el archivo de sesión, tokens, coste y estadísticas. |
| `/resume` | Abrir una sesión anterior. |
| `/new` | Crear una sesión nueva. |
| `/tree` | Navegar por ramas de la sesión. |
| `/compact` | Resumir el contexto anterior manualmente. |
| `/reload` | Recargar context files, skills, extensiones, prompts y themes. |
| `/trust` | Guardar la decisión de confianza del proyecto. |
| `/hotkeys` | Ver todos los atajos activos. |
| `/export` | Exportar una sesión a HTML o JSONL. |
| `/quit` | Salir de Pi. |

### Atajos que conviene mostrar en el video

| Atajo o sintaxis | Uso |
|---|---|
| `@` | Buscar y adjuntar un archivo del proyecto. |
| `!comando` | Ejecutar un comando y enviar su salida al modelo. |
| `!!comando` | Ejecutarlo sin añadir su salida al contexto del modelo. |
| `Shift+Enter` | Insertar una nueva línea en el editor. |
| `Escape` | Cancelar la operación actual. |
| `Ctrl+L` | Abrir el selector de modelos. |
| `Shift+Tab` | Cambiar el nivel de thinking. |
| `Ctrl+T` | Colapsar o expandir los bloques de thinking visibles. |
| `Ctrl+O` | Colapsar o expandir la salida de herramientas. |
| `Ctrl+G` | Abrir el editor externo configurado. |
| `Ctrl+X` | Copiar el último mensaje del asistente. |
| `Alt+Enter` | Encolar un follow-up mientras Pi está trabajando. |

`!!` es especialmente útil para inspeccionar algo localmente sin gastar contexto del modelo. No es una herramienta read-only: es una orden explícita del usuario.

### Equivalentes desde el CLI

Pi también se puede controlar desde la shell:

```bash
pi                       # sesión interactiva nueva
pi -c                    # continuar la sesión más reciente
pi -r                    # elegir una sesión anterior
pi --model <modelo>      # seleccionar un modelo al iniciar
pi --thinking medium     # iniciar con un nivel de thinking
pi -p "Resume el repo"   # modo print, sin TUI interactiva
pi --no-session          # sesión efímera
pi --tools read,grep,find,ls  # herramientas read-only
pi --help                # referencia completa
```

---

## 7. Seleccionar el modelo

Dentro de Pi:

```text
/model
```

También puedes pulsar `Ctrl+L`. El selector muestra los modelos disponibles para los proveedores autenticados. Los catálogos pueden variar según la versión de Pi, la cuenta y el proveedor.

Desde la shell puedes listar modelos:

```bash
pi --list-models
```

Si necesitas refrescar los catálogos:

```bash
pi update --models
```

También puedes seleccionar un modelo al iniciar:

```bash
pi --provider openai-codex --model <model-id>
```

O usando el identificador completo:

```bash
pi --model openai-codex/<model-id>
```

No inventes el `<model-id>`: usa uno que aparezca en `/model` o `pi --list-models`.

### Configuración persistente

Pi acepta configuración global en:

```text
~/.pi/agent/settings.json
```

Y configuración por proyecto en:

```text
.pi/settings.json
```

La configuración del proyecto sobrescribe la global. Un ejemplo de valores que podrías añadir —combinándolos con tu archivo existente, no sobrescribiéndolo a ciegas— es:

```json
{
  "defaultProvider": "openai-codex",
  "defaultModel": "<model-id-visible-en-model>",
  "defaultThinkingLevel": "medium",
  "quietStartup": false,
  "tuiMode": "regular"
}
```

`defaultProvider` y `defaultModel` solo funcionan si el proveedor está autenticado y el modelo existe en tu catálogo.

---

## 8. Configurar y mostrar el thinking

El nivel de thinking se puede cambiar de tres formas:

1. Desde `/settings`.
2. Pulsando `Shift+Tab` para recorrer los niveles.
3. Al iniciar Pi:

```bash
pi --thinking high
```

Los niveles disponibles son:

```text
off, minimal, low, medium, high, xhigh, max
```

No todos los modelos soportan todos los niveles. Pi ajusta el nivel a las capacidades del modelo; un modelo que no soporta reasoning termina usando `off`.

Hay dos conceptos distintos:

- `Shift+Tab` cambia cuánto reasoning se solicita al modelo.
- `Ctrl+T` solo colapsa o expande el bloque de thinking en pantalla.

El borde del editor también cambia de color para reflejar el nivel activo. El footer muestra el nivel junto al modelo cuando el modelo soporta reasoning.

---

## 9. Entender el contexto que aparece en pantalla

Aquí conviene aclarar una confusión frecuente: Pi muestra **dos tipos de contexto**.

### 9.1 Uso del context window en el footer

El footer inferior muestra automáticamente información como:

```text
↑tokens ↓tokens ... 12.4%/128k (auto)              modelo • medium
```

El porcentaje representa el uso estimado del context window del modelo actual. También puede mostrar tokens de entrada/salida, cache, coste y el modelo seleccionado.

**No existe un setting `showContext` para activarlo**: el uso del contexto forma parte del footer interactivo por defecto. Si la terminal es muy estrecha, parte del footer puede truncarse.

`/session` muestra información más detallada de la sesión y `/compact` permite resumir contexto manualmente. La compactación automática está activada por defecto y se puede revisar en `/settings`.

### 9.2 Archivos de contexto cargados al iniciar

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
- `CLAUDE.md` en las mismas ubicaciones.

Para que este bloque sea visible, deja esta opción en `false`:

```json
{
  "quietStartup": false
}
```

Si quieres forzar el encabezado aunque exista una configuración silenciosa:

```bash
pi --verbose
```

Para enseñar el concepto, crea un archivo `AGENTS.md` en la raíz del repositorio:

```markdown
# Project Instructions

- Este proyecto es una demo educativa de Pi.
- Lee primero la documentación antes de modificar archivos.
- No expongas credenciales ni secretos.
```

Reinicia Pi o ejecuta:

```text
/reload
```

Después observa que el archivo aparece como contexto cargado.

### 9.3 No confundir los tres conceptos

| Concepto | Dónde se observa | ¿Qué lo controla? |
|---|---|---|
| Uso actual del contexto | Footer: `%/contextWindow` | Pi lo muestra automáticamente. |
| Instrucciones cargadas | Encabezado: `Context` | `AGENTS.md`, `CLAUDE.md`, `quietStartup` y `--verbose`. |
| Capacidad del modelo | `/model` y metadata del modelo | El modelo seleccionado y su `contextWindow`. |

`TUI mode` (`regular` o `fullscreen`) cambia la disposición de la interfaz, pero no es el setting que activa el uso del contexto.

---

## 10. Crear la estructura del repositorio

A partir de aquí empieza la construcción de la demo. Desde la raíz de `youtube-tutorials`:

```bash
cd /ruta/a/youtube-tutorials
mkdir -p videos/pi/.pi/extensions
mkdir -p videos/pi/.pi/skills/repository-onboarding
cd videos/pi
```

La estructura que vamos a crear es:

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

`.pi/` es la carpeta de recursos específicos del proyecto. Pi la descubre después de confiar en el proyecto.

### Dependencia local para la extensión

Crea o conserva `.pi/package.json`:

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

Después instala usando el lockfile:

```bash
npm ci --prefix .pi
```

La instalación queda en `videos/pi/.pi/node_modules/` y no crea un `node_modules` en la raíz del repositorio.

> El paquete local se usa para los tipos de TypeScript y la resolución de la extensión. El comando `pi` sigue siendo el CLI global que instalaste al principio.

---

## 11. Crear la skill `repository-onboarding`

Una **skill** es un paquete de instrucciones especializadas. No es un comando shell ni una función TypeScript. Le enseña al modelo cómo resolver una clase de problemas y cuándo debe aplicar ese procedimiento.

Crea:

```text
.pi/skills/repository-onboarding/SKILL.md
```

Una skill debe tener frontmatter con, al menos, `name` y `description`:

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

En esta demo la versión completa está en [`SKILL.md`](.pi/skills/repository-onboarding/SKILL.md). Además del esqueleto anterior define:

- Los roles `Backend`, `Frontend`, `Fullstack` y `DevOps`.
- El proceso de descubrimiento del repositorio.
- La prohibición inicial de escribir, instalar, desplegar o ejecutar acciones destructivas.
- La diferencia entre evidencia, inferencia y preguntas abiertas.
- Un formato de salida para que el onboarding sea reproducible.

### Cómo Pi descubre y usa una skill

1. Al iniciar, Pi escanea las ubicaciones de skills y añade sus nombres y descripciones al system prompt.
2. Cuando el modelo necesita la skill, lee el `SKILL.md` completo con `read`.
3. El modelo sigue las instrucciones y usa las herramientas disponibles.
4. Puedes forzar la invocación mediante:

```text
/skill:repository-onboarding Backend
```

La activación de comandos `/skill:nombre` está habilitada por defecto. También se puede cargar una skill concreta desde el CLI:

```bash
pi --skill .pi/skills/repository-onboarding/SKILL.md
```

La descripción del frontmatter es importante: es la señal que ayuda al modelo a decidir cuándo debe cargar la skill. Revisa siempre el contenido de una skill antes de usarla; una skill puede instruir al modelo para realizar acciones peligrosas.

---

## 12. Crear la extensión `onboarding.ts`

Una **extensión** es código TypeScript ejecutado por Pi. Permite añadir comandos, herramientas, eventos, atajos, UI, validaciones y otras integraciones.

Crea:

```text
.pi/extensions/onboarding.ts
```

Contenido de la extensión de esta demo:

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

### Qué hace cada parte

- `pi.registerCommand("onboard-test", ...)` crea el comando `/onboard-test`.
- `ctx.isIdle()` evita iniciar otro onboarding mientras Pi sigue procesando una tarea.
- `ctx.ui.select()` muestra un selector interactivo si no se pasó un rol.
- `ctx.ui.notify()` muestra feedback en la interfaz.
- `pi.sendUserMessage()` inyecta un mensaje de usuario real y dispara un nuevo turno del modelo.
- El mensaje le dice al modelo que use `repository-onboarding`, transmite el rol y refuerza el modo read-only.

La extensión **no contiene el conocimiento de onboarding**. Solo implementa la interacción y la orquestación mínima. La skill contiene el proceso de análisis.

Puedes probar una extensión explícitamente sin depender del autodescubrimiento:

```bash
pi -e .pi/extensions/onboarding.ts
```

En el flujo normal la extensión se carga automáticamente desde `.pi/extensions/` después de confiar en el proyecto.

---

## 13. Skill versus extensión

| | Skill | Extensión |
|---|---|---|
| Forma | `SKILL.md` con instrucciones | Módulo TypeScript |
| Propósito | Enseñar un proceso especializado al modelo | Cambiar el comportamiento de Pi |
| Se activa | Automáticamente por descripción o con `/skill:nombre` | Al cargar Pi o al invocar un comando/evento |
| Puede definir | Reglas, pasos, formato, scripts y referencias | Comandos, tools, hooks, UI, atajos y providers |
| En esta demo | Analiza el repositorio y genera onboarding | Recibe el rol y envía el kickoff |
| Riesgo | Puede instruir al modelo para ejecutar acciones | Ejecuta código con permisos del usuario |

La separación es deliberada:

```text
extensión = interacción y control
skill     = conocimiento y procedimiento
Pi        = runtime, sesión, modelo y herramientas
```

Si solo necesitas que el modelo siga un proceso, empieza por una skill. Si necesitas un selector, un comando, una confirmación, una integración externa o una regla que bloquee herramientas, añade una extensión.

---

## 14. Ejecutar la demo completa en modo read-only

Desde `videos/pi` instala las dependencias locales:

```bash
npm ci --prefix .pi
```

Inicia Pi con únicamente herramientas de lectura:

```bash
pi --tools read,grep,find,ls
```

Acepta la confianza del proyecto si Pi la solicita. Si tienes `quietStartup` activado, inicia así para ver los recursos cargados:

```bash
pi --verbose --tools read,grep,find,ls
```

En el encabezado deberías poder identificar la skill y la extensión cargadas. Luego ejecuta:

```text
/onboard-test Backend
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

La allowlist read-only es una defensa adicional. La skill también prohíbe modificar archivos e instalar dependencias, pero la restricción de herramientas hace que el límite sea visible y verificable en la demo.

---

## 15. Recargar recursos mientras desarrollas

Después de cambiar `SKILL.md` o `onboarding.ts`, puedes ejecutar:

```text
/reload
```

Pi recarga:

- Context files.
- Skills.
- Extensions.
- Prompt templates.
- Themes.
- Keybindings.

Si cambiaste settings o la decisión de confianza, reiniciar Pi suele ser más claro para una demo reproducible.

---

## 16. Solución de problemas

### `pi: command not found`

Comprueba dónde instala npm los binarios globales:

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
- Comprueba que `--no-skills` no esté siendo usado.

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

No uses `--tools read,write,edit,bash` para esta parte del video si el objetivo es demostrar onboarding read-only.

---

## 17. Seguridad y reproducibilidad

- No subas `~/.pi/agent/auth.json`.
- No pongas API keys en `README.md`, prompts, skills ni extensiones.
- Revisa el código de toda extensión: las extensiones ejecutan TypeScript con los permisos del usuario.
- Revisa también las skills: pueden indicarle al modelo que ejecute acciones.
- Mantén `package-lock.json` versionado y usa `npm ci`.
- Para el onboarding inicial, limita las herramientas a `read,grep,find,ls`.
- La autenticación OAuth de suscripción es para uso local interactivo; la API key administrada para CI se documenta en el demo de PR evidence.

---

## Estructura final

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

Este primer demo enseña:

```text
Pi
  → instalación y autenticación
  → modelo y thinking
  → contexto y sesiones
  → skill
  → extensión
  → onboarding read-only
```

La segunda demo enseña Pi como reviewer de Pull Requests en GitHub Actions: [`videos/pi-pr-evidence`](../pi-pr-evidence).

## Documentación oficial consultada

- [Pi README y Quick Start](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
- [Providers y autenticación](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md)
- [Settings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md)
- [Using Pi y comandos](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md)
- [Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
- [Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Keybindings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/keybindings.md)
