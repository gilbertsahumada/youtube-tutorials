# Demo de Pi: revisión de Pull Requests

Esta demo es independiente de [`videos/pi`](../pi), que contiene la introducción básica a Pi y el onboarding local.

Aquí Pi se ejecuta desde GitHub Actions para revisar Pull Requests que modifican esta carpeta y publicar un comentario advisory en el PR.

## Flujo

```text
Pull Request
  → checkout del head
  → diff de videos/pi-pr-evidence
  → Pi + skill pr-evidence
  → comentario Markdown en GitHub
```

El workflow está en:

```text
.github/workflows/pi-pr-evidence.yml
```

La skill está en:

```text
.pi/skills/pr-evidence/SKILL.md
```

## Estructura

```text
pi-pr-evidence/
├── README.md
└── .pi/
    ├── package.json
    ├── package-lock.json
    └── skills/
        └── pr-evidence/
            └── SKILL.md
```

## Qué revisa Pi

El agente genera un reporte con:

- Resumen del cambio.
- Evidencia con rutas reales.
- Criterios o comprobaciones relevantes.
- Riesgos.
- Preguntas abiertas.
- Limitaciones.
- Veredicto: `PASA`, `NO PASA` o `REQUIERE REVISIÓN`.

El workflow no ejecuta tests. Si se quieren incluir resultados, deben producirse en un paso determinista de CI y pasarse explícitamente como contexto al agente en una evolución posterior.

## Modo read-only

Pi recibe únicamente estas herramientas:

```text
read, grep, find, ls
```

La revisión:

- No modifica archivos.
- No ejecuta `bash`.
- No ejecuta tests.
- No despliega.
- No publica directamente en GitHub.

El workflow sí prepara el runtime de Pi con `npm ci`, pero usa el manifiesto y el lockfile de la revisión base y lo instala en `$RUNNER_TEMP/pi-runtime`, fuera del checkout del Pull Request.

### Opciones de ejecución restringida

El paso que ejecuta Pi usa estas opciones para limitar el contexto y las capacidades disponibles:

| Opción | Qué hace | Por qué se usa |
|---|---|---|
| `--print` | Ejecuta Pi sin una interfaz interactiva y escribe la respuesta final en stdout. | GitHub Actions es headless y necesita guardar el reporte en un archivo. |
| `--no-session` | Usa una sesión efímera que no se guarda. | Evita persistir el transcript de Pi; los archivos temporales existen durante el job y se eliminan al final. |
| `--no-extensions` | Desactiva el descubrimiento y la carga automática de extensiones. | Evita ejecutar extensiones del checkout del Pull Request. |
| `--no-skills` | Desactiva el descubrimiento y la carga automática de skills. | Evita que una skill modificada por el Pull Request reemplace la política confiable. |
| `--no-context-files` | Ignora `AGENTS.md` y `CLAUDE.md`. | Evita que esas instrucciones automáticas del repositorio alteren la revisión. |
| `--skill <ruta>` | Carga explícitamente la skill copiada desde `BASE_SHA`. | La política de revisión proviene de la rama base confiable. `--no-skills` no bloquea esta carga explícita. |
| `--tools read,grep,find,ls` | Reemplaza la lista de herramientas por una allowlist de lectura. | No habilita `bash`, `edit` ni `write`; Pi no puede ejecutar comandos ni modificar archivos. |

Estas opciones limitan las capacidades del agente, pero no constituyen un sandbox completo. El runner y sus archivos deben tratarse como recursos sensibles, y el contenido del Pull Request continúa siendo información no confiable.

### Credenciales del checkout

`actions/checkout` puede guardar `GITHUB_TOKEN` en `.git/config` para que pasos posteriores hagan operaciones Git autenticadas. Este workflow solo necesita leer el historial local para generar el diff, por eso usa:

```yaml
persist-credentials: false
```

Así el token no queda persistido en el checkout que Pi puede leer. Esta opción no elimina `PI_API_KEY` del proceso de Pi, porque Pi necesita esa credencial para llamar al proveedor. Tampoco afecta al comentario final: `actions/github-script` recibe su `GITHUB_TOKEN` por separado mediante `github-token`.

El comentario lo publica `actions/github-script` mediante `GITHUB_TOKEN`.

## Ejecución headless y GitHub Actions

`Headless` significa que Pi se ejecuta sin una interfaz interactiva: recibe un prompt, trabaja con las herramientas permitidas y escribe el resultado en stdout. La opción `--print` es la que permite usar Pi de esta forma.

Pi no necesita GitHub Actions para funcionar headless. También puede ejecutarse desde:

- una terminal local;
- otro CI como GitLab CI, Jenkins o CircleCI;
- un contenedor Docker;
- un servidor, una tarea programada o un script.

Usamos GitHub Actions porque este tutorial revisa Pull Requests de GitHub. Actions ya puede reaccionar a `pull_request`, obtener el diff, leer secrets y usar `GITHUB_TOKEN` para publicar el comentario. El runner es temporal, así que no hace falta mantener un servidor encendido.

## Autenticación en GitHub Actions

El runner es headless, por lo que esta demo utiliza una API key, no una suscripción OAuth interactiva.

Configura en el repositorio:

- Repository variable: `PI_MODEL`, con el formato `provider/model-id`.
- Repository secret: `PI_API_KEY`, con la API key del provider seleccionado.
- Repository variable opcional: `PI_BASE_URL`, únicamente si se utilizará un endpoint OpenAI-compatible que Pi no tenga registrado de forma nativa.

La API key no se escribe en `models.json` ni se incluye en el prompt. El workflow solo la entrega al proceso de Pi mediante `--api-key`.

### Providers nativos de Pi

Pi incluye adapters y catálogos para varios providers. Si el provider y el modelo ya están soportados por Pi, deja `PI_BASE_URL` vacío y configura únicamente, por ejemplo:

```text
PI_MODEL=provider/model-id
PI_API_KEY=<clave del provider>
```

El valor concreto de `PI_MODEL` depende del catálogo y de la autenticación del provider que elijas. Este tutorial no obliga a utilizar DashScope, Qwen ni DeepSeek.

### Providers compatibles con OpenAI

Pi también puede utilizar un endpoint que implemente suficientemente la API de OpenAI Chat Completions mediante `api: "openai-completions"`. Para un provider arbitrario, configura:

```text
PI_MODEL=my-provider/my-model
PI_BASE_URL=https://example.invalid/compatible-mode/v1
PI_API_KEY=<clave del provider>
```

Cuando `PI_BASE_URL` está definido, el workflow crea un `models.json` temporal equivalente a:

```json
{
  "providers": {
    "my-provider": {
      "baseUrl": "https://example.invalid/compatible-mode/v1",
      "api": "openai-completions",
      "models": [
        {
          "id": "my-model",
          "name": "my-provider/my-model",
          "input": ["text"]
        }
      ]
    }
  }
}
```

Esto permite cambiar el modelo y el provider mediante variables del repositorio, sin modificar el workflow ni el código de Pi. El endpoint debe soportar streaming y tool calling, no solo una solicitud de chat simple, porque Pi necesita llamar a `read`, `grep`, `find` y `ls` durante la revisión. Esta revisión usa texto; un modelo multimodal requeriría declarar también la capacidad de imágenes en su metadata.

### ¿Es obligatorio crear `models.json`?

No para todos los casos:

- Si usas un provider nativo de Pi, `PI_BASE_URL` queda vacío y Pi usa su catálogo interno. No necesitamos crear `models.json`.
- Si usas un endpoint personalizado, Pi necesita conocer su dirección, su formato y el modelo. En ese caso sí necesitamos registrar el provider en `models.json` o mediante otra configuración equivalente.

`models.json` es un mecanismo de configuración que Pi ya entiende. Lo que hicimos nosotros es generarlo automáticamente durante el workflow cuando existe `PI_BASE_URL`. Se crea en `$RUNNER_TEMP`, se le indica a Pi mediante `PI_CODING_AGENT_DIR` y se elimina al terminar. `PI_BASE_URL` es una variable que definimos para este workflow; Pi no la interpreta automáticamente por sí sola.

Si no generáramos ese archivo y usáramos, por ejemplo, `dashscope/deepseek-v4.1-flash`, Pi no sabría qué provider es `dashscope` ni a qué dirección enviar la solicitud, salvo que esa configuración ya existiera en otro `models.json` o en una extensión.

### Ejemplo de este tutorial: DashScope + DeepSeek

En este tutorial yo utilizaré DashScope como provider compatible con OpenAI y DeepSeek como modelo:

```text
PI_MODEL=dashscope/deepseek-v4.1-flash
PI_BASE_URL=https://maas.qwencloudapi.com/compatible-mode/v1
```

`https://maas.qwencloudapi.com/compatible-mode/v1` es el endpoint específico de DashScope que elegí para mi cuenta; no es un requisito de Pi ni una configuración que deban copiar quienes utilicen otro provider. El mismo flujo puede utilizar cualquier otro endpoint que cumpla el contrato compatible y tenga tool calling.

Para desarrollo local, registra esos valores en `~/.pi/agent/models.json` (o combínalos con tu archivo existente) y ejecuta:

```bash
export DASHSCOPE_API_KEY="..."
pi --model dashscope/deepseek-v4.1-flash --api-key "$DASHSCOPE_API_KEY"
```

No compartas la clave en el repositorio ni la incluyas en el prompt. Para desarrollo local también puedes utilizar una suscripción mediante `/login`; esa modalidad se explica en [`videos/pi`](../pi) y no se copia a GitHub Actions.

## Seguridad del workflow

El workflow:

- Usa `pull_request`, no `pull_request_target`.
- Solo procesa PRs del mismo repositorio en esta primera versión.
- No expone la API key a PRs provenientes de forks.
- Inyecta `PI_API_KEY` únicamente en los pasos que validan y ejecutan Pi.
- Genera, cuando se define `PI_BASE_URL`, el registro temporal del provider OpenAI-compatible sin incluir credenciales.
- No persiste `GITHUB_TOKEN` en el checkout (`persist-credentials: false`).
- Carga la skill y el runtime desde la revisión base confiable.
- Guarda los archivos temporales bajo `$RUNNER_TEMP`.
- Usa un lockfile y `npm ci`.
- Serializa las ejecuciones del mismo PR.
- Actualiza únicamente el comentario creado por `github-actions[bot]`.
- Publica un comentario advisory, no un bloqueo de merge.

## Bootstrap

Cuando se introduce esta demo por primera vez, la rama base todavía no contiene la skill ni el package de `pi-pr-evidence`. En ese caso el workflow omite la revisión automática y deja una explicación en el Step Summary.

Después de fusionar la demo, los siguientes PRs que modifiquen `videos/pi-pr-evidence/**` podrán ejecutar el análisis real. Si `PI_MODEL` o `PI_API_KEY` no están configurados, el workflow omite la revisión y explica el motivo en el Step Summary, pero no marca el CI como fallido. La condición de confianza para PRs del mismo repositorio sigue requiriendo protección de ramas, revisión de cambios en workflows y environments protegidos cuando la API key sea sensible.

## Probar el workflow

1. Configura `PI_MODEL` y `PI_API_KEY`; añade `PI_BASE_URL` si utilizarás un endpoint OpenAI-compatible personalizado.
2. Crea una rama desde `main`.
3. Modifica un archivo dentro de `videos/pi-pr-evidence/**`.
4. Abre un Pull Request.
5. Espera el job `Pi PR evidence review`.
6. Revisa el comentario generado o actualizado por Pi.

Este flujo corresponde al segundo video: Pi como reviewer read-only integrado en GitHub Actions.
