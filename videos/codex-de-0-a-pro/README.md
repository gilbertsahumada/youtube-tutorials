# Cómo uso OpenAI Codex de 0 a Pro

> El setup que uso para trabajar con **Codex** (CLI y app de escritorio) con criterio de ingeniería: configuración, permisos, `AGENTS.md` y los prompts del workflow real (de un ticket a varios Pull Requests).

---

## 1. `config.toml` — tu base

Vive en `~/.codex/config.toml`.

```toml
# Modelo y razonamiento (confirma el id actual con /model)
model_reasoning_effort = "high"     # low | medium | high | xhigh

# Permisos / sandbox (default SEGURO)
approval_policy = "on-request"      # on-request | never | untrusted
sandbox_mode    = "workspace-write" # workspace-write | danger-full-access | read-only

[sandbox_workspace_write]
network_access = true               # instalar paquetes, curl, APIs

# MCP: documentación de librerías siempre actualizada dentro de Codex
[mcp_servers.context7]
command = "npx"
args    = ["-y", "@upstash/context7-mcp"]
startup_timeout_sec = 20
```

## 2. `AGENTS.md` — el contexto mínimo

Es el archivo que Codex lee al arrancar (el equivalente a `CLAUDE.md`). **Regla de oro: mínimo.** Si el agente puede inferirlo leyendo el repo (estructura, framework, scripts), NO lo escribas. Solo va lo que NO puede adivinar: reglas del equipo, flujos, integraciones, decisiones.

## 3. Permisos sin enredarte

Tres cosas distintas que la gente mezcla:

| Concepto | Qué controla | Default recomendado |
|---|---|---|
| `sandbox_mode` | Qué puede leer/escribir | `workspace-write` (escribe solo en el proyecto) |
| `network_access` | Si sale a internet | `true` (instalar paquetes, APIs) |
| `approval_policy` | Cuándo te pide permiso | `on-request` (pide al cruzar límites) |

El "skip permissions" = `approval_policy = "never"` + `sandbox_mode = "danger-full-access"`. Úsalo solo en repos de confianza, idealmente en un worktree o contenedor.

## 4. Los 4 prompts: de un ticket a un Pull Request

El agente propone, tú decides en cada paso. **Plan → implementación revisada → verificación → PR.**

1. **Pedir un PLAN** (no código todavía): "Analiza esta tarea. Quiero un plan antes de tocar código: qué archivos, cómo respeta la arquitectura (lee `AGENTS.md`), qué riesgos y qué NO vas a tocar, y cómo verificamos. Elige el cambio mínimo."
2. **Implementar y revisar el diff:** "Implementa solo lo aprobado. Mantén el comportamiento externo. Cambios quirúrgicos. Al terminar: resume archivos, corre typecheck + tests y reporta el resultado real." En la app de escritorio, deja comentarios inline en el diff y luego "aplica estos comentarios".
3. **Revisión de calidad antes de mergear:** "Actúa como revisor senior. Revisa SOLO el diff actual: correctitud, seguridad, que la lógica de negocio no se haya filtrado a la entrada o a los datos, tests. Devuelve qué arreglar antes de mergear."
4. **Commit + PR:** "Crea un commit con mensaje claro (incluye el ID del ticket). Abre una branch y prepara un PR con título, descripción, resumen por archivo y cómo probarlo."

## Atajos que aceleran esto

- `$` + nombre de skill → invoca una skill.
- `/new` y `/resume` → varias conversaciones en paralelo.
- `/compact` → cuando el contexto se llena.
- Codex en modo no interactivo → para encadenar en scripts.

---

> Por si quieres más: el pack completo (config, AGENTS.md, permisos y los 4 prompts en detalle) está como **Codex Starter Pack** en la comunidad **IA en Producción** → https://www.skool.com/ia-en-produccion-3264
