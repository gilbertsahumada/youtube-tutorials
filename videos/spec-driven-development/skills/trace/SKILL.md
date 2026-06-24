---
name: trace
description: Dibuja en ASCII el diagrama de secuencia y el diagrama de flujo de una parte del código que ya existe, para entender cómo funciona antes de modificarla. Úsala cuando el usuario quiera entender un flujo, función o feature existente, o antes de hacer scope sobre código heredado.
---

# Trace: código existente → diagramas

Lees el código que el usuario señala (una función, un endpoint, un feature) y reconstruyes su comportamiento real en dos diagramas ASCII. **No inventas:** lo que dibujas tiene que estar en el código. Si algo no se ve en el código (una rama que nunca se ejecuta, un caso que no se maneja), lo dices en vez de adivinarlo.

Pasos:

1. **Encuentra el punto de entrada.** Dónde empieza el flujo (el handler, la ruta, la función pública). Si el usuario no lo dio, pregúntale o búscalo.
2. **Sigue las llamadas reales.** Qué le llama a qué, en qué orden, qué datos pasan. Anota los archivos y funciones de verdad (no genéricos).
3. **Dibuja dos diagramas:**

SECUENCIA. Por defecto la versión **comprimida** (lista ordenada); la **completa** con lifelines solo si el usuario la pide.

Comprimida (default):
```
SECUENCIA (orden temporal ↓)
1. Entrada → ComponenteA: llamada()
2. ComponenteA → ComponenteB: otra()
3. ComponenteB → ComponenteA: dato
4. ComponenteA → Entrada: respuesta
```
Completa (solo si la piden) — un lifeline vertical (`│`) por participante real, tiempo hacia ABAJO; llamadas flecha sólida (`──▶`), retornos punteada (`◀ ─ ─`):
```
Entrada     ComponenteA    ComponenteB
  │              │              │
  │  llamada()   │              │
  │─────────────▶│              │
  │              │  otra()      │
  │              │─────────────▶│
  │              │◀ ─ dato ─ ─  │
  │◀─ respuesta ─│              │
  ▼              ▼              ▼
```
FLUJO (las decisiones y ramas reales del código):
```
 entrada
    │
    ▼
 ¿condición real? ──no──▶ rama que toma
    │ sí
    ▼
 acción ──▶ resultado
```

4. **Marca lo que falta o huele mal.** Casos que el código NO maneja, ramas muertas, decisiones implícitas. Esto es lo más valioso: lo que el diagrama revela que el código olvidó.

Cierra preguntando si el flujo dibujado es el que el usuario esperaba. Si no coincide, ya tienes el insumo para un `scope` de la corrección.
