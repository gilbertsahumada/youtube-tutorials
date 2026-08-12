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

### Configuración de GitHub Actions

Configura una **repository variable** llamada `PI_MODEL` con un modelo en formato `provider/model-id`, por ejemplo el modelo que tengas registrado y autenticado en Pi.

Configura también un **repository secret** llamado `PI_API_KEY` con la API key correspondiente.

El primer workflow procesa Pull Requests del mismo repositorio. Los Pull Requests desde forks quedan fuera para no exponer la API key a código no confiable. El workflow es advisory: no bloquea el merge.

> El comentario se actualiza en cada nuevo commit del PR en lugar de crear comentarios duplicados. La ruta `videos/pi/**` limita el coste de la demo; para revisar todo el repositorio se puede ampliar el filtro `paths` del workflow.
