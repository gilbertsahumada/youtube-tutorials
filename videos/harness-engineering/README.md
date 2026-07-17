# Harness engineering con Claude Code y Codex

> Un modelo genera decisiones. Un harness organiza el contexto, las reglas, las herramientas y el feedback que necesita para trabajar dentro de un proyecto real.

Esta demo usa la misma tarea y el mismo modelo en dos versiones de una aplicación de pedidos:

```text
Completa la exportación de pedidos a CSV para que esté lista para usar.
Al terminar, verifica que funcione.
```

Sin harness, el agente debe inventar decisiones que el prompt no define. En la ejecución usada para validar esta demo creó sus propios tests y reportó `2/2`, pero solo cumplió `1/6` criterios del producto.

Con harness, el repositorio le entrega:

- un punto de entrada para Claude Code y Codex;
- una especificación de producto;
- un workflow corto;
- un script que comprueba el entorno;
- un comando de verificación ejecutable.

Con el mismo prompt, el agente modificó únicamente los dos archivos necesarios y cumplió `6/6` criterios externos.

La comparación completa, los checkpoints y los comandos para repetirla están en [`demo/`](demo).

Los hooks no son necesarios para esta demo. Podrían automatizar los scripts de inicio y verificación, pero no son el harness: son una forma opcional de conectarlo al ciclo de cada herramienta.
