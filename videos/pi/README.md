# Demo de Pi: skill y extensión de onboarding

Esta demo muestra cómo una extensión de Pi recibe el rol del desarrollador y delega el análisis del repositorio a una skill especializada.

La extensión registra `/onboard-test`. El comando acepta un rol como argumento o muestra un selector, y después envía al agente las instrucciones para usar `repository-onboarding`.

## Estructura

```text
pi/
├── README.md
└── .pi/
    ├── package.json
    ├── extensions/
    │   └── onboarding.ts
    └── skills/
        └── repository-onboarding/
            └── SKILL.md
```

`.pi/` es una carpeta oculta: Pi la usa para descubrir los recursos específicos del proyecto.

## Requisitos

- Pi instalado y autenticado con un proveedor de modelos.
- Node.js 22.19 o superior si quieres instalar la dependencia local para el editor/TypeScript.
- Un terminal interactivo.

## Preparar la demo

Desde la raíz del repositorio:

```bash
cd videos/pi
npm install --prefix .pi
```

La instalación queda dentro de `.pi/`; no se crea un `node_modules` en la raíz del repositorio.

## Ejecutar la demo

Inicia Pi desde esta carpeta:

```bash
cd videos/pi
pi
```

Si Pi solicita confiar en el proyecto, acepta la confianza para cargar `.pi/`.

Después ejecuta:

```text
/onboard-test Backend
```

También puedes ejecutar `/onboard-test` sin argumentos para elegir el rol desde el selector.

## Resultado esperado

1. La extensión comprueba que Pi esté idle.
2. Se utiliza el rol indicado o seleccionado.
3. Pi muestra una notificación de inicio.
4. La extensión envía un mensaje al agente para usar `repository-onboarding`.
5. La skill analiza el contenido de `videos/pi` en modo de solo lectura y genera un onboarding con evidencia y rutas reales.

Para probar otro rol:

```text
/onboard-test Frontend
/onboard-test DevOps
/onboard-test Fullstack
```

Esta demo no contiene una aplicación backend. El rol `Backend` sirve para observar cómo la extensión transmite el contexto del desarrollador a la skill.

## Revisión de Pull Requests con Pi

El workflow [`pi-pr-evidence.yml`](../../.github/workflows/pi-pr-evidence.yml) añade un primer caso de uso de CI: cuando un Pull Request modifica `videos/pi/**`, GitHub Actions genera el diff, ejecuta Pi en modo read-only y publica o actualiza un comentario advisory en el PR.

El flujo es:

```text
Pull Request
  → checkout del head
  → diff de videos/pi
  → Pi + pr-evidence
  → comentario Markdown
```

La skill está en:

```text
.pi/skills/pr-evidence/SKILL.md
```

El agente solo recibe estas herramientas:

```text
read, grep, find, ls
```

No ejecuta tests, no modifica archivos y no instala dependencias. Por eso el comentario distingue entre evidencia encontrada, riesgos, preguntas abiertas y limitaciones.

### Autenticación: API key o suscripción

Pi separa el **runtime** del **proveedor y la autenticación**. La misma skill puede ejecutarse usando una API key o una suscripción compatible.

| Modalidad | Cómo se autentica | Mejor uso |
|---|---|---|
| API key | Variable de entorno, `/login` o `--api-key` | CI/CD y GitHub Actions |
| Suscripción | `/login` mediante OAuth | Desarrollo local interactivo |

#### Opción A: suscripción local

Inicia Pi desde `videos/pi` y ejecuta:

```bash
cd videos/pi
pi
```

Dentro de Pi:

```text
/login
```

Selecciona el proveedor de suscripción disponible. Pi documenta logins para Claude Pro/Max, ChatGPT Plus/Pro mediante Codex y GitHub Copilot; también existen otros proveedores con OAuth según la versión instalada.

Después puedes seleccionar el modelo con `/model` y ejecutar la demo:

```text
/onboard-test Backend
```

Pi guarda las credenciales OAuth en:

```text
~/.pi/agent/auth.json
```

Los tokens pueden refrescarse automáticamente según el proveedor. Este archivo es personal y nunca debe subirse al repositorio ni imprimirse en logs.

#### Opción B: API key local

Por ejemplo, con el proveedor correspondiente:

```bash
export ANTHROPIC_API_KEY="..."
cd videos/pi
pi --model anthropic/<model-id>
```

También se puede ejecutar `/login` y elegir un proveedor de API key. La documentación de Pi contiene la variable específica de cada proveedor, como `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` u `OPENROUTER_API_KEY`.

#### Qué ocurre en GitHub Actions

El workflow [`pi-pr-evidence.yml`](../../.github/workflows/pi-pr-evidence.yml) utiliza **API-key auth** porque el runner es headless:

```yaml
PI_MODEL: ${{ vars.PI_MODEL }}
PI_API_KEY: ${{ secrets.PI_API_KEY }}
```

Y Pi se inicia con:

```bash
pi --model "$PI_MODEL" --api-key "$PI_API_KEY"
```

La variable `PI_MODEL` debe tener el formato `provider/model-id`, y `PI_API_KEY` debe corresponder a ese proveedor.

Una suscripción no se activa automáticamente en Actions: `/login` es un flujo de autenticación interactivo y las credenciales OAuth normalmente viven en el `auth.json` del usuario. Técnicamente se podría diseñar una integración headless con credenciales OAuth almacenadas de forma segura, si el proveedor lo permite, pero no se recomienda copiar credenciales personales de suscripción a un runner ni usar ese mecanismo como base de este MVP.

Para CI/CD recomendamos una API key, una cuenta técnica o una credencial administrada por la organización. Para el video, la distinción es:

```text
suscripción OAuth → demo local interactiva
API key           → revisión automatizada en GitHub Actions
```

El primer workflow procesa Pull Requests del mismo repositorio. Los Pull Requests desde forks quedan fuera para no exponer la API key a código no confiable. El workflow es advisory: no bloquea el merge.

> El comentario se actualiza en cada nuevo commit del PR en lugar de crear comentarios duplicados. La ruta `videos/pi/**` limita el coste de la demo; para revisar todo el repositorio se puede ampliar el filtro `paths` del workflow.
