# Demo reproducible del video

Esta demo parte con una feature ya implementada: un serializador CSV. El objetivo del video no es construir la feature, sino crear el skill `prove` para verificarla con evidencia real.

La spec indica cómo comprobar la tarea:

```md
### T1: Nombre de la tarea
- **Verify:** `comando o check`
```

En `specs/serializar-reservas.md`, T1 dice `Verify: npm test`. El skill revisa primero el alcance y el diff, ejecuta ese comando y contrasta la salida con los criterios de `Done`. Si una tarea no tiene `Verify`, dice que no pudo verificarla en vez de inventar uno.

Requiere Node.js 20 o superior. No instala dependencias.

## Preparar la grabación

```bash
cd videos/creando-skills/demo
npm run reset
npm test
```

El estado `buggy` deja un fallo intencional en el escape de campos con comas y comillas. El resultado esperado es dos tests pasando y uno fallando.

Para volver al estado correcto:

```bash
npm run restore
npm test
```

El estado `fixed` deja los tres tests pasando.

## Archivos que se muestran

- `specs/serializar-reservas.md`: tarea T1 y comando `Verify`.
- `src/csv.js`: implementación que se verifica.
- `test/csv.test.js`: tres casos observables.
- `fixtures/`: estados reproducibles antes y después de la corrección.

La versión terminada vive en `.claude/skills/prove/SKILL.md`. Para usar la misma fuente con Codex, el repo incluye este symlink:

```bash
mkdir -p .agents/skills
ln -s ../../.claude/skills/prove .agents/skills/prove
```

Para grabar la creación desde cero, elimina temporalmente `.claude/skills/prove` y `.agents/skills/prove`; luego recréalos en cámara con el contenido versionado en el commit final.
