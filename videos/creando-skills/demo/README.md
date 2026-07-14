# Demo reproducible: skill `prove`

Esta demo contiene una feature existente con un error intencional y un único skill: `prove`.

`prove` no corrige la implementación. Revisa el alcance y el diff, comprueba que los tests no fueron debilitados, ejecuta el `Verify` indicado en la spec y contrasta la evidencia con los criterios de `Done`.

## Estructura

```text
demo/
├── .claude/skills/prove/SKILL.md
├── .agents/skills/prove -> ../../.claude/skills/prove
├── specs/serializar-reservas.md
├── src/csv.js
├── test/csv.test.js
├── fixtures/
│   ├── csv.buggy.js
│   └── csv.fixed.js
└── scripts/set-demo-state.mjs
```

La fuente canónica del skill vive en `.claude/skills/prove/SKILL.md`. Codex usa exactamente el mismo archivo mediante el symlink de `.agents/skills/prove`.

## Punto de partida

La tarea T1 de `specs/serializar-reservas.md` define:

```md
- **Hacer:** implementar `toCsv(reservas)` con encabezado y escape correcto.
- **Archivos:** `src/csv.js`, `test/csv.test.js`.
- **Verify:** `npm test`.
```

`Verify` solo indica cómo comprobar la tarea. `prove` ejecuta ese comando y usa su salida como evidencia para evaluar `Done`.

Requiere Node.js 20 o superior. La demo no tiene dependencias externas.

## 1. Preparar el estado fallido

```bash
cd videos/creando-skills/demo
npm run reset
npm test
```

Resultado esperado:

```text
tests 3
pass 2
fail 1
```

El caso que falla es `escapa comas y comillas`. En este estado, el único archivo modificado respecto al repo es `src/csv.js`; los tests permanecen intactos.

## 2. Ejecutar `prove`

En Claude Code:

```text
/prove specs/serializar-reservas.md T1
```

En Codex:

```text
$prove verifica T1 de specs/serializar-reservas.md
```

El reporte debe incluir:

- `src/csv.js` está dentro del alcance de T1;
- los tests no fueron modificados;
- `npm test` termina con código distinto de cero;
- el criterio sobre comas y comillas no tiene evidencia de cumplimiento;
- veredicto final: `NO PASA`.

## 3. Llevar la feature al estado correcto

Para reproducir la corrección sin editar manualmente:

```bash
npm run restore
```

También puedes pedirle al agente que corrija T1 usando la evidencia de `prove`, sin modificar los tests.

## 4. Volver a ejecutar `prove`

Invoca nuevamente el mismo skill con la misma spec y la misma tarea.

Resultado esperado de `Verify`:

```text
tests 3
pass 3
fail 0
```

El reporte final debe confirmar que el cambio sigue dentro del alcance, los tests permanecen intactos, los criterios de `Done` tienen evidencia y el veredicto es `PASA`.

## Restaurar la demo

```bash
npm run restore
npm test
```

Esto deja `src/csv.js` en el estado versionado y los tres tests pasando.
