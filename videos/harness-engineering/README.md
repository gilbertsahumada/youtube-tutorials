# Harness Engineering con Claude Code y Codex

> El modelo propone decisiones. El harness le entrega el contexto, las instrucciones, las herramientas y el feedback necesarios para trabajar dentro de un proyecto real.

En este tutorial construiremos un harness dentro de un repositorio. Funcionará tanto con Claude Code como con Codex y no dependerá de hooks, plugins ni un framework de agentes.

La prueba será concreta: le daremos exactamente la misma tarea al mismo modelo, primero sin harness y después con harness.

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

## Qué es Harness Engineering

Un modelo por sí solo recibe una entrada y genera una salida. Claude Code y Codex agregan una primera capa alrededor del modelo: pueden leer archivos, editar código, ejecutar comandos y mantener una conversación.

Pero esas herramientas todavía necesitan entender cómo se trabaja en **este** proyecto:

- dónde están las decisiones de producto;
- qué proceso deben seguir antes de editar;
- qué comandos pueden utilizar;
- cómo comprobar si el resultado es correcto.

Ese entorno específico del repositorio es el harness.

```text
Modelo
  └── Claude Code o Codex
        └── Harness del repositorio
              ├── Contexto
              ├── Instrucciones
              ├── Herramientas
              └── Feedback
```

Harness Engineering es diseñar y mantener ese sistema para que el agente tenga mejores condiciones de trabajo. No consiste en escribir un prompt enorme ni en intentar controlar cada respuesta del modelo.

## Las cuatro piezas

### 1. Contexto

El contexto contiene las decisiones que el agente no debería inventar: especificaciones, arquitectura, convenciones y límites del producto.

En la demo, la especificación [`export-orders.md`](demo/docs/product/export-orders.md) define el nombre del archivo, las columnas, el formato de fechas y dinero, el escape de CSV y lo que queda fuera de alcance.

### 2. Instrucciones

Las instrucciones indican cómo trabajar con ese contexto. El proyecto usa [`AGENTS.md`](demo/AGENTS.md) como entrada canónica y [`CLAUDE.md`](demo/CLAUDE.md) para dirigir Claude Code al mismo flujo.

Ambas herramientas terminan leyendo [`workflow.md`](demo/docs/harness/workflow.md), que define este ciclo:

```text
preparar → leer la especificación → implementar → verificar → corregir
```

### 3. Herramientas

Las herramientas convierten acciones frecuentes en comandos conocidos por el proyecto:

- [`start.sh`](demo/scripts/harness/start.sh) comprueba que el entorno esté listo y muestra dónde están la especificación y la verificación.
- [`verify.sh`](demo/scripts/harness/verify.sh) ejecuta el contrato de verificación del repositorio.

Los scripts no sustituyen al agente. Le entregan una interfaz estable que también puede usar una persona o un pipeline de CI.

### 4. Feedback

El feedback le permite comparar su implementación con un resultado observable. En esta demo, [`export-orders.test.js`](demo/test/export-orders.test.js) comprueba cuatro comportamientos definidos por el producto.

Sin ese feedback, el agente solo puede revisar su propio código y afirmar que parece correcto. Con él, puede detectar un fallo, corregirlo y volver a ejecutar la prueba.

## La demo

La aplicación muestra una lista de pedidos y tiene un botón **Exportar CSV**. La implementación inicial funciona con datos simples, pero no define qué hacer con:

- nombres que contienen comas o comillas;
- totales que necesitan dos decimales;
- fechas que deben normalizarse en UTC;
- nombre y tipo de contenido de la descarga;
- saltos de línea y retorno de carro dentro de un valor.

El prompt tampoco incluye esas decisiones. Esa omisión es intencional: en un proyecto real, no deberíamos repetir todo el conocimiento del producto en cada petición.

## Primera ejecución: sin harness

En el primer checkpoint solo existen la aplicación y la tarea. El agente debe decidir por su cuenta qué significa que la exportación esté "lista para usar".

En la ejecución grabada, Codex hizo algo razonable:

1. Inspeccionó el código existente.
2. Mejoró la función de exportación.
3. Creó sus propias pruebas.
4. Ejecutó esas pruebas y obtuvo `2/2`.
5. Reportó que la tarea estaba lista.

El problema es que esas pruebas validaban las mismas suposiciones que el agente acababa de tomar. Un evaluador independiente, que sí conocía las seis decisiones del producto, obtuvo:

```text
Resultado: 1/6 checks pasan
```

Esto no demuestra que el modelo sea malo. Demuestra que una petición ambigua permite soluciones distintas y que el autoreporte no reemplaza un criterio externo.

La salida exacta del modelo es probabilística. Lo que se mantiene constante en la comparación es la tarea y el evaluador de seis criterios.

## Construcción del harness

El segundo checkpoint conserva la misma implementación incorrecta y agrega el entorno de trabajo:

```text
demo/
├── AGENTS.md
├── CLAUDE.md
├── docs/
│   ├── harness/workflow.md
│   └── product/export-orders.md
├── scripts/harness/
│   ├── start.sh
│   └── verify.sh
├── test/export-orders.test.js
└── src/
```

### Paso 1: conectar ambos agentes

[`AGENTS.md`](demo/AGENTS.md) contiene las instrucciones del proyecto para Codex:

```markdown
Before changing code:

1. Run `npm run harness:start`.
2. Read `docs/harness/workflow.md`.
3. Read the product specification named by the task.

Before declaring the task complete:

1. Run `npm run verify`.
2. If verification fails, fix the implementation and run it again.
3. Report the real verification output and any remaining limitation.
```

[`CLAUDE.md`](demo/CLAUDE.md) apunta a esas mismas instrucciones. No mantenemos dos procesos diferentes: Claude Code y Codex comparten el harness del repositorio.

### Paso 2: sacar decisiones del prompt

La especificación [`export-orders.md`](demo/docs/product/export-orders.md) convierte "lista para usar" en decisiones observables:

```text
Archivo: orders.csv
Columnas: id, customer, total, status, created_at
Total: exactamente dos decimales
Fecha: YYYY-MM-DD en UTC
CSV: escapar comas, comillas y saltos de línea
```

El prompt puede seguir siendo corto porque el conocimiento duradero vive junto al código.

### Paso 3: ofrecer comandos estables

Antes de editar, el agente ejecuta:

```bash
npm run harness:start
```

Antes de declarar éxito, ejecuta:

```bash
npm run verify
```

El primer comando orienta. El segundo devuelve feedback ejecutable. Si la implementación no cumple la especificación, la verificación falla.

### Paso 4: cerrar el ciclo de feedback

El workflow no le pide al agente que "revise bien". Le indica una secuencia verificable:

1. Leer las decisiones del producto.
2. Hacer el cambio mínimo necesario.
3. Ejecutar la verificación.
4. Usar el error para corregir la implementación.
5. No declarar éxito hasta obtener una salida real.

## Segunda ejecución: el mismo prompt con harness

Abrimos una sesión nueva en el checkpoint con harness y repetimos, sin agregar instrucciones:

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

Esta vez el agente encontró las instrucciones del repositorio, leyó la especificación, ejecutó la verificación, corrigió la implementación y volvió a comprobarla.

La verificación interna reportó:

```text
tests 4
pass 4
fail 0
```

Después aplicamos el mismo evaluador independiente de la primera ejecución:

```text
Resultado: 6/6 checks pasan
```

El agente solo necesitó modificar los dos archivos de implementación relacionados con la tarea. No fue necesario incluir las reglas del CSV en el prompt ni crear pruebas improvisadas durante la ejecución.

## Claude Code y Codex

El harness no depende de una sola herramienta:

- Codex descubre [`AGENTS.md`](demo/AGENTS.md).
- Claude Code descubre [`CLAUDE.md`](demo/CLAUDE.md).
- Ambos leen la misma especificación y el mismo workflow.
- Ambos ejecutan los mismos scripts y reciben el mismo feedback.

La demo también fue validada con Claude Code. Su implementación pasó `4/4` pruebas internas y `6/6` criterios externos.

Los permisos siguen perteneciendo a cada herramienta. Si el entorno bloquea la ejecución de un script, el comportamiento correcto es informarlo; el harness no evade sandboxes ni aprobaciones. Para grabar el flujo completo, autoriza los scripts del repositorio cuando la herramienta lo solicite.

## ¿Y los hooks?

No usamos hooks en esta demo.

Un hook podría ejecutar automáticamente `harness:start` al iniciar una sesión o `verify` antes de terminar. Eso reduce pasos manuales, pero no define las decisiones del producto, el workflow ni las pruebas.

```text
Harness = sistema de contexto, instrucciones, herramientas y feedback
Hook    = conexión opcional a un momento del ciclo de la herramienta
```

Primero conviene construir comandos explícitos y comprobar que el flujo funciona. Después se puede automatizar su ejecución si aporta valor.

## Qué no garantiza

Un harness mejora las condiciones de trabajo, pero no vuelve determinista al modelo:

- las pruebas solo cubren los comportamientos que alguien definió;
- una especificación desactualizada puede guiar al agente hacia una solución incorrecta;
- el modelo todavía puede interpretar mal una instrucción;
- los scripts y documentos también necesitan mantenimiento;
- para un script pequeño y descartable, este nivel de estructura puede ser innecesario.

La ventaja es que los errores dejan de depender únicamente de la interpretación del prompt. El proyecto conserva criterios que pueden leer y ejecutar agentes, personas y CI.

## Reproducir la comparación

La carpeta [`demo/`](demo) contiene la aplicación completa y tres checkpoints:

| Commit | Estado |
|---|---|
| `bbee3e1` | Aplicación inicial, sin harness |
| `cd2ff13` | Harness instalado, implementación todavía incorrecta |
| `1b51240` | Resultado corregido mediante el harness |

La guía [`demo/README.md`](demo/README.md) incluye los requisitos, los comandos para crear cada worktree, el prompt exacto y la forma de ejecutar el evaluador independiente.

## Idea central

Harness Engineering no consiste en esperar que el agente acierte por casualidad ni en reemplazar el desarrollo tradicional. Consiste en convertir el conocimiento y las comprobaciones de un proyecto en un entorno que el agente pueda descubrir, usar y verificar.

En este ejemplo usamos archivos Markdown, scripts de shell y tests. En otro entorno, las mismas cuatro piezas podrían implementarse con CI, contenedores, observabilidad, permisos, herramientas propias o un harness construido con código y un SDK de IA. Esa será la siguiente capa; primero necesitábamos demostrar el principio dentro de Claude Code y Codex.
