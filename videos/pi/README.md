# Demo de Pi: skill y extensión de onboarding

Esta es la demo básica de Pi. Muestra cómo una extensión recibe el rol del desarrollador y delega el análisis del repositorio a una skill especializada.

La extensión registra `/onboard-test`. El comando acepta un rol como argumento o muestra un selector, y después envía al agente las instrucciones para usar `repository-onboarding`.

> Esta carpeta es la demo local del primer video. No contiene el reviewer de Pull Requests ni el workflow de GitHub Actions. Esa demo está separada en [`videos/pi-pr-evidence`](../pi-pr-evidence).

## Estructura

```text
pi/
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

`.pi/` es una carpeta oculta: Pi la usa para descubrir los recursos específicos del proyecto.

## Requisitos

- Pi instalado y autenticado con un proveedor de modelos.
- Node.js 22.19 o superior si quieres instalar la dependencia local para el editor/TypeScript.
- Un terminal interactivo.

## Autenticación local

Pi permite utilizar una suscripción mediante OAuth o una API key.

### Suscripción

Inicia Pi y ejecuta `/login`:

```bash
cd videos/pi
pi
```

Dentro de Pi:

```text
/login
```

Selecciona el proveedor disponible y, si es necesario, el modelo con `/model`.

Pi guarda las credenciales OAuth en:

```text
~/.pi/agent/auth.json
```

Este archivo es personal: no lo subas al repositorio ni lo imprimas en logs.

### API key

También puedes configurar la credencial mediante la variable de entorno del proveedor:

```bash
export ANTHROPIC_API_KEY="..."
cd videos/pi
pi --model anthropic/<model-id>
```

Pi admite otros proveedores, como OpenAI, Google Gemini y OpenRouter. Consulta `pi --list-models` para ver los modelos disponibles en tu instalación.

## Preparar la demo

Desde la raíz del repositorio:

```bash
cd videos/pi
npm ci --prefix .pi
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

## Alcance de este video

Esta demo enseña el ciclo básico:

```text
Pi
  → extensión
  → skill
  → análisis del repositorio
  → onboarding
```

La revisión automatizada de Pull Requests, la autenticación por API key en GitHub Actions y los comentarios en GitHub se explican en el segundo demo, [`pi-pr-evidence`](../pi-pr-evidence).
