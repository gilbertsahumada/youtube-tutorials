export const meta = {
  name: 'loop-fix',
  description: 'Un loop que arregla una feature: cada vuelta es un agente nuevo sin memoria, el estado vive en disco',
  phases: [{ title: 'Loop', detail: 'iterar hasta que la verificacion pase' }],
}

// La idea del loop: tu no escribes el prompt de cada vuelta. El loop lo escribe.
// El agente olvida todo entre vueltas; el archivo de estado es lo unico que recuerda.

const CONFIG = typeof args === 'string' ? JSON.parse(args) : args || {}
const TARGET = CONFIG.target
const MAX_VUELTAS = CONFIG.maxVueltas || 6

if (!TARGET || !TARGET.startsWith('/')) {
  throw new Error(`args.target debe ser una ruta ABSOLUTA. Recibido: ${JSON.stringify(TARGET)}`)
}

const VUELTA_SCHEMA = {
  type: 'object',
  required: ['verificacionPasa', 'resumen'],
  properties: {
    verificacionPasa: { type: 'boolean' },
    resumen: { type: 'string' },
    testsFallando: { type: 'number' },
  },
}

// Este es el prompt que el loop le escribe al agente. Es SIEMPRE el mismo:
// lo que cambia entre vueltas no es el prompt, es el estado en disco.
const PROMPT = `Tu directorio de trabajo es exactamente: ${TARGET}
Lee UNICAMENTE archivos dentro de ese directorio.

1. Lee ESTADO.md. Ahi esta lo que dejaron las vueltas anteriores de este loop.
   Tu no recuerdas nada de ellas: ese archivo es tu unica memoria.
2. Ejecuta \`npm run verify\`.
3. Si la verificacion pasa entera, escribe "LISTO" en ESTADO.md y termina.
4. Si falla, corrige EXACTAMENTE UN fallo. Uno solo, el mas simple que veas.
   Guiate por docs/product/export-orders.md. No toques los tests.
5. Vuelve a ejecutar \`npm run verify\`.
6. Reescribe ESTADO.md con: que arreglaste en esta vuelta, que sigue fallando,
   y que deberia intentar la proxima vuelta. Escribelo para alguien que no
   estuvo aqui, porque literalmente no va a estar.`

phase('Loop')

const vueltas = []

for (let i = 1; i <= MAX_VUELTAS; i++) {
  const r = await agent(PROMPT, { label: `vuelta ${i}`, phase: 'Loop', schema: VUELTA_SCHEMA })

  if (!r) {
    log(`vuelta ${i}: el agente no devolvio resultado, corto el loop`)
    break
  }

  vueltas.push({ vuelta: i, ...r })
  log(`vuelta ${i}: ${r.verificacionPasa ? 'VERDE' : `fallan ${r.testsFallando ?? '?'}`} · ${r.resumen.slice(0, 90)}`)

  // Condicion de parada verificable: no es el agente diciendo "ya esta",
  // es la verificacion del proyecto pasando.
  if (r.verificacionPasa) {
    log(`El loop se detuvo solo en la vuelta ${i}: la verificacion paso.`)
    break
  }
}

return {
  vueltasEjecutadas: vueltas.length,
  termino: vueltas.length > 0 && vueltas[vueltas.length - 1].verificacionPasa,
  vueltas,
}
