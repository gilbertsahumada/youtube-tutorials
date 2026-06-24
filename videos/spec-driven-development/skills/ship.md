# /ship — Mensaje de commit

Escribe el mensaje de commit de los cambios en staging. Explica el **porqué**, no solo el qué.

**Uso:** `/ship`

---

1. Corre `git diff --staged` para ver los cambios.
2. Escribe un mensaje en formato conventional commits:

```
<tipo>(<scope>): <asunto>

<cuerpo: por qué era necesario este cambio, no solo qué cambió>

Refs: T<n> / #<issue>
```

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

Reglas:
- Asunto en imperativo, máx ~50 caracteres.
- El cuerpo explica **por qué** (el tú del futuro buscando en `git blame` a las 2am te lo agradece).
- Referencia la tarea de la spec (`T1`) o el issue.
- Si no puedes resumirlo en una línea, el cambio probablemente es muy grande.
