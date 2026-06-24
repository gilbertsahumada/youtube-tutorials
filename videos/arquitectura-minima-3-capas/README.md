# La mejor arquitectura para vibecoding: 3 capas

> Compañero del video. El modelo mental de 3 capas para que la IA no destroce tu app cuando crece, y los prompts para ordenar un proyecto vibecodeado.

> Comunidad (gratis) → https://www.skool.com/ia-en-produccion-3264

---

## El problema

Generar código con IA no es el problema. El problema es que **si partes sin arquitectura, la IA copia ese desorden cada vez más rápido**, por todo tu proyecto. Lo que necesitas no es una arquitectura enterprise: es la más básica que existe, y por eso mismo la mejor para construir con IA porque escala sin volverse un caos.

## El modelo: 3 capas

Son tres responsabilidades, no tres carpetas:

- **Entrada** — recibe la petición y responde. En Next.js: route handlers, Server Actions, el fetch de un Server Component.
- **Negocio** — decide las reglas. Funciones normales de TypeScript (carpeta `business/`).
- **Datos** — lee y guarda. Un repositorio (carpeta `data/`): Prisma, Supabase, Drizzle.

Una sola regla que lo sostiene todo: **la entrada llama al negocio, el negocio llama a los datos, y nunca al revés.**

`shared/` (schemas, tipos, errores, helpers de auth) **no es una cuarta capa**: es soporte que usan las tres.

> **El truco para saber si quedó limpio:** tu caso de uso (el del negocio) no debería mencionar `req`, `res` ni SQL. Si los menciona, todavía tienes responsabilidades mezcladas.

### El caso, trazado

Alguien quiere **reservar una hora**. La entrada (route handler o Server Action) recibe el request y valida. Llama al negocio, que decide si la reserva se puede crear. El negocio llama a la capa de datos, la única que habla con la base de datos: consulta disponibilidad y guarda. La respuesta vuelve por el mismo camino. Cada cosa en su lugar.

## La estructura (por capas)

```text
src/
  app/
    api/bookings/route.ts          # ENTRADA: recibe el request y responde
  business/
    create-booking.ts              # NEGOCIO: la regla (un archivo por caso de uso)
  data/
    bookings-repository.ts         # DATOS: lee/escribe (Prisma, Supabase, Drizzle)
  shared/
    schemas/booking.schema.ts      # validación reutilizable
    auth/get-current-user.ts       # helper transversal
    errors/app-error.ts            # error común
```

La carpeta de negocio la verás llamada de mil formas (business, services, domain, use-cases): es lo mismo. Lo que importa es que ahí solo viven las reglas, sin HTTP ni SQL. Y esto es organizar **por capas** (lo más simple para que la IA no se pierda); la alternativa es **por feature**, que conviene cuando la app crece mucho.

## Los prompts: de vibecoding a mantenible

El proceso es: diagnosticar → planear → implementar → revisar. Sobre **un** archivo representativo, no toda la app de golpe.

### 1. Diagnosticar (no toca código)

```text
Analiza este route handler o Server Action.
No modifiques código todavía.

Identifica responsabilidades mezcladas usando estas 3 capas:
1. Entrada / Presentación / HTTP
2. Negocio / casos de uso
3. Datos / acceso a DB o integraciones

Marca qué cosas deberían ir a shared (schemas, auth, errores, tipos, utilidades).

Devuelve: qué hace hoy, qué está mezclado, qué riesgos hay si el proyecto crece,
y una propuesta de separación mínima sin sobreingeniería.
```

### 2. Planear (en plan mode, sin implementar)

```text
Con base en el diagnóstico, propón un refactor en 3 capas para esta parte.
No implementes todavía. Mantén el contrato externo (rutas, payloads, responses).

Define: archivos a crear/modificar, qué queda en entrada / negocio / datos / shared,
riesgos, y los checks para verificar que no rompimos comportamiento.
Elige el cambio mínimo. Evita abstracciones innecesarias.
```

### 3. Implementar

```text
Implementa solo el refactor aprobado.
Mantén el comportamiento externo. Cambios quirúrgicos: no refactorices nada no relacionado.

Al terminar: resume los archivos modificados, qué responsabilidad quedó en cada capa,
corre los checks y reporta el resultado real, y lista lo que no pudiste verificar.
```

### 4. Revisar (el que te evita engañarte)

```text
Revisa el resultado del refactor. Evalúa si ahora:
- entrada: recibe input, llama al caso de uso y responde
- negocio: contiene las reglas
- datos: solo lee/escribe
- shared: solo piezas reutilizables

Marca qué quedó bien, qué sigue mezclado, y qué NO conviene tocar por ahora.
```

> Ojo: aunque le des instrucciones detalladas, el agente a veces **mueve** código sin cambiar la responsabilidad (deja una query donde no va). Por eso siempre revisas: nosotros seguimos siendo los ingenieros que aplican el criterio.

## Que la IA mantenga la estructura

Una vez ordenado, deja la regla en tu `CLAUDE.md` / `AGENTS.md` (se carga sola cada sesión) o crea un skill para que cada nuevo endpoint siga las 3 capas. No sirve de mucho ordenar una vez si después cada prompt vuelve a mezclar.

## Cuándo aplicarlo

Si es una demo de una tarde, no armes todo esto. Pero si la app va a tener usuarios, mostrarse, venderse o mantenerse, esta arquitectura deja de ser teoría y es higiene básica.

---

*¿Tienes una app vibecodeada para ordenar? Súbela al thread de la comunidad. → https://www.skool.com/ia-en-produccion-3264*
