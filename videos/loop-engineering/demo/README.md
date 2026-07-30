# Demo del ciclo de un PR

El recorrido canónico, los prompts y las salidas verificadas están en
[`../README.md`](../README.md).

Desde esta carpeta:

```bash
npm run demo
npm run verify
```

Estado inicial registrado:

```text
tests 4
pass 1
fail 3
```

La solución mínima validada termina con:

```text
tests 4
pass 4
fail 0
```

Para restaurar cambios locales antes de hacer commit:

```bash
npm run demo:reset
```
