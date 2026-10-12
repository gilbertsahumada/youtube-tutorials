# Demo ejecutable: Company Brain en código

Sigue la **[guía paso a paso](../README.md)** para preparar el entorno, elegir el modo de consulta y verificar cada resultado.

Requiere Node.js 22 y Git. No hay dependencias que instalar ni servidor local. Desde la raíz del repositorio:

```bash
cd videos/company-brain-code/demo
npm test
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run reset` | Restaura la memoria inicial; borra `workspace/` y `output/` anteriores |
| `npm run show` | Imprime el estado local, sin llamar al modelo |
| `npm run context` | Guarda contexto y mensajes para inspección, sin llamar al modelo |
| `npm run ask` | Reconstruye el contexto y consulta al LLM real configurado en `.env` |
| `npm run ingest` | Incorpora el evento ficticio y crea una propuesta; el acuerdo sigue en CSV |
| `npm run approve -- --yes --reviewer "Tu nombre"` | Aprueba el cambio local: PDF vigente, CSV histórico y tarea sin modificar |
| `npm run diff` | Compara solamente `seed/brain/` con `workspace/brain/` |
| `npm run ask:fixture` | Alternativa a `ask`: plantilla simulada para la pregunta predeterminada, sin credenciales |

El LLM solo responde consultas. La propuesta y la actualización de archivos las realiza JavaScript; la aprobación requiere tu comando explícito.

Los datos iniciales están en `seed/`, el estado activo en `workspace/` y los resultados en `output/`. Una consulta repetida reemplaza los outputs de su fase. Conserva los resultados que necesites antes de repetir o reiniciar.

Para completar el recorrido sin un LLM, sustituye las tres consultas `ask` de la guía por `ask:fixture`. No se ejecuta ninguna llamada al proveedor ni hay fallback silencioso entre modos.
