# Demo reproducible: Harness Engineering

Esta carpeta contiene una aplicación de pedidos deliberadamente incompleta y el harness que debe guiar a Claude Code o Codex para corregirla.

La demo usa **una sola carpeta, un solo estado inicial y el mismo prompt** en las dos ejecuciones:

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

Primero ocultaremos temporalmente el harness. Después restauraremos exactamente el mismo estado inicial y repetiremos la tarea con el harness disponible.

## Estructura inicial

```text
harness-engineering/
├── evaluation/evaluate.mjs           # evaluador externo a la carpeta del agente
└── demo/
    ├── AGENTS.md                     # entrada de Codex
    ├── CLAUDE.md                     # entrada de Claude Code
    ├── docs/
    │   ├── harness/workflow.md       # proceso compartido
    │   └── product/export-orders.md  # decisiones del producto
    ├── scripts/harness/
    │   ├── start.sh                  # comprueba el entorno
    │   └── verify.sh                 # ejecuta la verificación
    ├── test/export-orders.test.js    # feedback ejecutable
    └── src/                          # aplicación incorrecta
```

El evaluador está fuera de `demo/` para que el agente sin harness no encuentre accidentalmente los criterios ocultos al inspeccionar su carpeta de trabajo.

## Requisitos

- Git.
- Node.js 20 o superior.
- Claude Code o Codex.
- Una copia limpia del repositorio dedicada a la demo.
- No hay dependencias externas que instalar.

Clona el repositorio y entra en la única carpeta que usaremos:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/harness-engineering/demo
```

Comprueba que no existan cambios previos:

```bash
git status --short
```

El comando no debe mostrar nada.

## 1. Ver la aplicación inicial

```bash
npm start
```

Abre `http://localhost:3000` y usa **Exportar CSV**. La descarga parece funcionar, pero todavía no escapa valores complejos, no normaliza dinero ni fechas y no entrega todos los headers requeridos.

Detén el servidor antes de continuar.

## 2. Ocultar temporalmente el harness

Elimina estos archivos y carpetas desde `demo/`:

```bash
rm AGENTS.md CLAUDE.md
rm -rf docs/harness docs/product scripts/harness test
npm pkg delete scripts.harness:start scripts.verify
```

No elimines `src/`, `package.json` ni el evaluador externo. El agente debe recibir la aplicación incorrecta y la tarea, pero ninguna decisión del harness.

Confirma el estado:

```bash
git status --short
```

Debes ver únicamente los archivos del harness eliminados y `package.json` modificado.

## 3. Ejecutar la tarea sin harness

Abre Claude Code o Codex **dentro de `demo/`** y entrega exactamente este prompt:

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

No agregues criterios sobre el CSV. Permite que el agente inspeccione, implemente y verifique con la información disponible.

La respuesta es probabilística. En la ejecución validada para el video, Codex creó sus propias pruebas y reportó `2/2`, pero tomó decisiones distintas de las requeridas por el producto.

## 4. Evaluar el primer resultado

Cuando el agente termine, permanece en `demo/` y ejecuta:

```bash
node ../evaluation/evaluate.mjs .
```

En la ejecución usada para el video, el resultado fue:

```text
Resultado: 1/6 checks pasan
```

Otra ejecución podría obtener un número diferente. Lo importante es que ambos recorridos usan el mismo evaluador independiente.

## 5. Restaurar la misma carpeta

Cierra la sesión del agente. Después devuelve todos los archivos rastreados al estado inicial:

```bash
git restore .
```

El agente podría haber creado archivos nuevos que `git restore` no elimina. Revísalos antes de borrarlos:

```bash
git clean -nd
```

En esta copia dedicada a la demo, elimina únicamente esos archivos no rastreados:

```bash
git clean -fd
```

Comprueba nuevamente:

```bash
git status --short
```

Debe quedar limpio. Ahora tenemos la misma implementación incorrecta del comienzo, pero el harness vuelve a estar disponible.

## 6. Comprobar el harness antes de corregir

```bash
npm run harness:start
npm run verify
```

El primer comando debe mostrar:

```text
Harness ready
Product spec: docs/product/export-orders.md
Verification: npm run verify
```

`npm run verify` debe fallar. Esto es intencional: el harness está instalado, pero todavía no ha corregido la aplicación.

## 7. Repetir la misma tarea con harness

Abre una sesión nueva de Claude Code o Codex dentro de la misma carpeta `demo/` y entrega el mismo prompt:

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

El agente debe descubrir las instrucciones del proyecto, ejecutar `npm run harness:start`, leer la especificación y usar `npm run verify` como feedback antes de terminar.

No es necesario nombrar esos archivos en el prompt. Esa información pertenece al harness.

## 8. Comprobar el segundo resultado

```bash
npm run verify
node ../evaluation/evaluate.mjs .
```

En el resultado validado para esta demo:

```text
tests 4
pass 4
fail 0

Resultado: 6/6 checks pasan
```

## Repetir la demo

Para volver al estado inicial, cierra el agente y repite la restauración desde `demo/`:

```bash
git restore .
git clean -nd
git clean -fd
git status --short
```

La aplicación vuelve a quedar incorrecta y el harness vuelve a quedar instalado. No necesitas cambiar de commit, rama ni worktree.

## Permisos

La herramienta debe tener permiso para ejecutar los scripts del proyecto. El harness no evade el sandbox ni las aprobaciones de Claude Code o Codex. Si un comando está bloqueado, el comportamiento correcto es reportarlo en vez de afirmar que la verificación pasó.

No hay hooks en la demo. El agente ejecuta los scripts porque el workflow del repositorio se lo indica.
