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
- No instala dependencias en el checkout del PR.
- No ejecuta `bash`.
- No ejecuta tests.
- No despliega.
- No publica directamente en GitHub.

El comentario lo publica `actions/github-script` mediante `GITHUB_TOKEN`.

## Autenticación en GitHub Actions

El runner es headless, por lo que esta demo utiliza una API key, no una suscripción OAuth interactiva.

Configura en el repositorio:

- Repository variable: `PI_MODEL`.
- Repository secret: `PI_API_KEY`.

`PI_MODEL` debe tener el formato:

```text
provider/model-id
```

Ejemplos conceptuales:

```text
anthropic/<model-id>
openai/<model-id>
google/<model-id>
openrouter/<model-id>
```

La API key debe corresponder al proveedor seleccionado. No compartas la clave en el repositorio ni la incluyas en el prompt.

Para desarrollo local, Pi también puede utilizar una suscripción mediante `/login`. Esa modalidad se explica en [`videos/pi`](../pi) y no se copia a GitHub Actions.

## Seguridad del workflow

El workflow:

- Usa `pull_request`, no `pull_request_target`.
- Solo procesa PRs del mismo repositorio en esta primera versión.
- No expone la API key a PRs provenientes de forks.
- Carga la skill y el runtime desde la revisión base confiable.
- Guarda los archivos temporales bajo `$RUNNER_TEMP`.
- Usa un lockfile y `npm ci`.
- Serializa las ejecuciones del mismo PR.
- Actualiza únicamente el comentario creado por `github-actions[bot]`.
- Publica un comentario advisory, no un bloqueo de merge.

## Bootstrap

Cuando se introduce esta demo por primera vez, la rama base todavía no contiene la skill ni el package de `pi-pr-evidence`. En ese caso el workflow omite la revisión automática y deja una explicación en el Step Summary.

Después de fusionar la demo, los siguientes PRs que modifiquen `videos/pi-pr-evidence/**` podrán ejecutar el análisis real.

## Probar el workflow

1. Configura `PI_MODEL` y `PI_API_KEY` en la configuración del repositorio.
2. Crea una rama desde `main`.
3. Modifica un archivo dentro de `videos/pi-pr-evidence/**`.
4. Abre un Pull Request.
5. Espera el job `Pi PR evidence review`.
6. Revisa el comentario generado o actualizado por Pi.

Este flujo corresponde al segundo video: Pi como reviewer read-only integrado en GitHub Actions.
