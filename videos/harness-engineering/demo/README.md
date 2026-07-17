# Demo reproducible: harness engineering

Esta aplicación muestra pedidos y permite descargarlos como CSV. La implementación inicial parece funcionar con datos simples, pero no define cómo tratar comas, comillas, dinero, fechas ni headers de descarga.

La demo compara la misma petición sobre dos estados del repositorio:

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

La selección y el comportamiento del modelo son probabilísticos. Lo reproducible no es una respuesta literal, sino el contrato: el evaluador aplica los mismos seis criterios a ambos resultados.

## Qué contiene el harness

```text
demo/
├── AGENTS.md                         # entrada de Codex
├── CLAUDE.md                         # entrada de Claude Code
├── docs/
│   ├── harness/workflow.md           # proceso compartido
│   └── product/export-orders.md      # decisiones del producto
├── scripts/harness/
│   ├── start.sh                      # comprueba el entorno
│   └── verify.sh                     # ejecuta la verificación
├── test/export-orders.test.js        # feedback ejecutable
├── evaluation/evaluate.mjs           # evaluación independiente
└── src/                              # aplicación
```

`AGENTS.md` es la guía canónica del proyecto. `CLAUDE.md` dirige Claude Code hacia esa misma guía. Ambos agentes usan la misma documentación, los mismos scripts y los mismos tests.

No hay hooks en la demo. El agente ejecuta los scripts porque el workflow del repositorio se lo indica. Un hook podría automatizar esos momentos más adelante sin cambiar la lógica del harness.

## Requisitos

- Git.
- Node.js 20 o superior.
- Claude Code o Codex para repetir la ejecución del agente.
- No hay dependencias externas que instalar.

La herramienta debe tener permiso para ejecutar los scripts del proyecto. El harness no evade el sandbox ni las aprobaciones de Claude Code o Codex. Si un comando está bloqueado, el comportamiento correcto es reportarlo en vez de afirmar que la verificación pasó.

## Checkpoints

| Commit | Estado |
|---|---|
| `bbee3e1` | Aplicación inicial, sin harness |
| `cd2ff13` | Harness instalado, implementación todavía incorrecta |
| `1b51240` | Resultado corregido mediante el harness |

Los hashes son parte de la historia publicada de esta demo.

## 1. Probar el estado inicial

Desde la raíz de `youtube-tutorials`:

```bash
git worktree add /tmp/harness-sin-harness bbee3e1
cd /tmp/harness-sin-harness/videos/harness-engineering/demo
```

Abre Claude Code o Codex en esa carpeta y entrega exactamente el prompt de la demo. No agregues criterios sobre el CSV.

Después de que termine, evalúa el resultado usando el evaluador del checkout final:

```bash
node /ruta/al/checkout-final/videos/harness-engineering/demo/evaluation/evaluate.mjs .
```

En nuestra ejecución, Codex agregó pruebas que pasaron `2/2`, pero el evaluador independiente reportó `1/6`.

## 2. Probar el harness antes de corregir

```bash
git worktree add /tmp/harness-con-harness cd2ff13
cd /tmp/harness-con-harness/videos/harness-engineering/demo
npm run harness:start
npm run verify
```

El primer comando debe mostrar:

```text
Harness ready
Product spec: docs/product/export-orders.md
Verification: npm run verify
```

La verificación inicial debe fallar: la aplicación todavía contiene la misma implementación incorrecta.

## 3. Ejecutar la misma tarea con harness

Abre una sesión nueva de Claude Code o Codex en `/tmp/harness-con-harness/videos/harness-engineering/demo` y entrega el mismo prompt:

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

El agente debe encontrar las instrucciones del proyecto, ejecutar `npm run harness:start`, leer la especificación y ejecutar `npm run verify` antes de terminar.

No es necesario nombrar esos archivos en el prompt. Esa es información proporcionada por el harness.

## 4. Comprobar el resultado

```bash
npm run verify
node /ruta/al/checkout-final/videos/harness-engineering/demo/evaluation/evaluate.mjs .
```

En el resultado validado para esta demo:

```text
tests 4
pass 4
fail 0

Resultado: 6/6 checks pasan
```

## Ejecutar la aplicación

```bash
npm start
```

Abre `http://localhost:3000` y usa **Exportar CSV**. El navegador debe descargar `orders.csv` con las columnas, formatos y escape definidos en `docs/product/export-orders.md`.

## Restaurar o eliminar los worktrees

Ejecuta estos comandos desde el checkout principal, después de cerrar las sesiones que estén usando las carpetas:

```bash
git worktree remove /tmp/harness-sin-harness
git worktree remove /tmp/harness-con-harness
```
