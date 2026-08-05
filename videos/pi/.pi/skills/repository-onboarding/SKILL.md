---
name: repository-onboarding
description: Analiza repositorios desconocidos y crea recorridos de onboarding para desarrolladores según su rol. Úsalo cuando el usuario quiera entender la arquitectura, estructura, ejecución o convenciones de un codebase.
---

# Repository Onboarding

Tu objetivo es ayudar a un desarrollador a comprender un repositorio desconocido de manera progresiva, práctica y respaldada por evidencia.

## Entrada y alcance

- Identifica el directorio raíz del repositorio y respeta las instrucciones locales (`AGENTS.md`, `CLAUDE.md` y documentación equivalente).
- Si el usuario no indica un rol, pregúntalo cuando cambie significativamente el análisis. Si no responde, usa una perspectiva general/full stack y decláralo.
- Adapta la profundidad al objetivo del usuario; no describas todos los archivos si no son relevantes para empezar a contribuir.

## Reglas

- Trabaja inicialmente en modo de solo lectura.
- No modifiques archivos ni el estado del repositorio.
- No instales dependencias ni ejecutes comandos que descarguen software o requieran red.
- No ejecutes migraciones, despliegues, procesos destructivos ni comandos como `reset`, `clean`, `checkout` o `stash`.
- No leas, reproduzcas ni expongas valores secretos de `.env`, credenciales, claves privadas o archivos equivalentes. Puedes identificar su existencia y documentar las variables esperadas sin mostrar sus valores.
- Ignora `node_modules`, `dist`, `build`, caches y demás archivos generados, salvo que sean relevantes para una pregunta concreta.
- Cita rutas exactas para respaldar cada afirmación importante; incluye números de línea cuando sea posible.
- Distingue claramente entre **evidencia**, **inferencia** y **pregunta abierta**.
- No inventes responsabilidades basándote solamente en nombres de carpetas, archivos o funciones.
- No inventes comandos de ejecución o validación: verifica que estén documentados o definidos en scripts/configuración y marca lo que no hayas podido ejecutar.

## Proceso

### 1. Descubrimiento inicial

Inspecciona, priorizando la documentación y los archivos pequeños:

- README y documentación de contribución.
- Instrucciones del repositorio y de sus directorios padres.
- Manifiestos de dependencias.
- Estructura de directorios.
- Configuraciones y scripts.
- Entry points.
- Rutas, controladores o handlers.
- Servicios y módulos.
- Modelos, esquemas o migraciones, sin ejecutarlos.
- Tests y fixtures.
- Archivos de infraestructura y CI/CD.
- Historial Git (`log`, `show` o `blame`) cuando aporte contexto.

Registra también lo que no existe cuando su ausencia sea relevante, por ejemplo, si no hay README, tests o configuración de CI.

### 2. Detectar el proyecto

Identifica:

- Propósito aparente.
- Lenguajes y frameworks.
- Package manager.
- Aplicaciones, paquetes o servicios.
- Entry points.
- Comandos de desarrollo.
- Comandos de pruebas, lint, type-check y build.
- Dependencias externas importantes.
- Variables de entorno esperadas, sin exponer secretos.
- Integraciones, bases de datos, colas, APIs o proveedores externos.

### 3. Mapear la arquitectura

Traza las relaciones entre las capas principales y evita asumir que una estructura convencional implica una responsabilidad concreta. Busca referencias reales entre módulos, imports, rutas, configuración y tests.

Documenta:

- Punto de entrada y ciclo de arranque.
- Flujo de una operación representativa.
- Fronteras entre aplicación, dominio, infraestructura y presentación, si existen.
- Persistencia y fuentes de datos.
- Comunicación entre servicios o módulos.
- Manejo de errores, autenticación y autorización cuando sean relevantes.

### 4. Adaptar el análisis al rol

#### Backend

Prioriza APIs, rutas, handlers, servicios, dominio, persistencia, eventos, integraciones y tests.

#### Frontend

Prioriza rutas, páginas, componentes, estado, consumo de APIs, estilos, autenticación y tests de interfaz.

#### DevOps

Prioriza CI/CD, contenedores, infraestructura como código, variables, observabilidad, entornos y procedimientos de despliegue. Descríbelos sin ejecutarlos.

#### Full stack

Explica primero un flujo completo de extremo a extremo y después desglosa cada capa.

### 5. Validar de forma segura

Cuando sea necesario, ejecuta únicamente comandos de inspección no destructivos, como consultas de estructura, estado e historial Git. No alteres el entorno ni instales nada.

Para cada comando recomendado, indica:

- Si está definido en la documentación o configuración.
- Si fue ejecutado o solo inferido.
- Qué prerequisitos necesita.
- Qué riesgos o efectos secundarios podría tener.

### 6. Presentar el onboarding

Comienza con un resumen breve y después utiliza esta estructura:

# Repository onboarding

## Qué hace el proyecto

Describe el propósito, el problema que resuelve y el estado aparente del proyecto.

## Cómo está organizado

Explica los directorios y módulos relevantes, citando rutas exactas.

## Cómo ejecutar el proyecto

Incluye prerequisitos, configuración necesaria y comandos verificados. Separa comandos documentados de comandos no verificados.

## Cómo validar cambios

Incluye tests, lint, type-check, build y otras comprobaciones disponibles.

## Arquitectura principal

Explica las capas, dependencias y límites importantes.

## Flujo de ejecución importante

Traza uno o más flujos representativos desde la entrada hasta el resultado.

## Archivos que deberías leer primero

Lista los archivos en orden recomendado y explica por qué cada uno es importante.

## Convenciones detectadas

Describe convenciones confirmadas sobre nombres, estructura, errores, commits, tests, configuración y estilo.

## Preguntas abiertas

Lista información que no pudo confirmarse, decisiones pendientes y preguntas concretas para el equipo.

## Recorrido recomendado

Propón una secuencia progresiva de lectura y tareas seguras para que el desarrollador pase de una visión general a su primer cambio.

## Formato de evidencia

Usa estas etiquetas cuando corresponda:

- **Evidencia:** hecho respaldado por un archivo, script, referencia o comando ejecutado.
- **Inferencia:** conclusión razonable que todavía no está confirmada directamente.
- **Pregunta abierta:** información que falta verificar.

Termina indicando qué se verificó, qué no se pudo verificar y cuál sería el siguiente paso más seguro.
