export const meta = {
  name: 'review-graph',
  description: 'Revisa una feature con 3 lentes en paralelo y verifica cada hallazgo de forma adversarial',
  phases: [
    { title: 'Buscar', detail: '3 revisores en paralelo, cada uno con una lente distinta' },
    { title: 'Verificar', detail: 'un refutador por hallazgo: solo sobrevive lo que no se puede refutar' },
  ],
}

// Nodo = unidad de trabajo. Arista = quien alimenta y quien vigila a quien.
// Regla de diseno: el codigo controla el enrutamiento predecible; el modelo solo juzga.

// `args` puede llegar como objeto o como string JSON segun quien invoque el workflow.
// Si no lo normalizas, `args.target` queda undefined y todo el grafo revisa otra cosa.
const CONFIG = typeof args === 'string' ? JSON.parse(args) : args || {}
const TARGET = CONFIG.target

// Fallar rapido y fuerte. Un objetivo relativo como "demo" convierte el control de alcance
// de mas abajo en un colador: `"/otro/proyecto/demos/x.js".includes("demo")` es true.
// Es preferible que el workflow no arranque a que entregue hallazgos sobre el repo equivocado.
if (!TARGET || !TARGET.startsWith('/')) {
  throw new Error(
    `args.target debe ser una ruta ABSOLUTA al directorio a revisar. Recibido: ${JSON.stringify(TARGET)}`,
  )
}

// Los nodos no respetan un limite solo porque se lo pidas en el prompt: hay que imponerlo.
const ALCANCE = `ALCANCE OBLIGATORIO
Tu directorio de trabajo es exactamente: ${TARGET}

- Lee UNICAMENTE archivos dentro de ese directorio.
- NO uses busqueda global ni salgas a directorios padres o hermanos.
- En el mundo hay muchos archivos llamados csv.js o server.js: si el que abres no esta bajo
  la ruta de arriba, es de otro proyecto y no es el tuyo.
- Todo path que reportes debe empezar por esa ruta.`

const LENTES = [
  {
    key: 'spec',
    prompt: `Lee docs/product/export-orders.md y compara la implementacion en src/ contra esa especificacion.
Reporta SOLO incumplimientos concretos de la spec.`,
  },
  {
    key: 'csv',
    prompt: `Ignora la documentacion. Analiza la serializacion CSV en src/csv.js con criterio de robustez:
escape de comas, comillas, saltos de linea y retorno de carro; formato de numeros y fechas.
Reporta SOLO defectos de serializacion que puedas ubicar en el codigo.`,
  },
  {
    key: 'http',
    prompt: `Analiza src/server.js con criterio de contrato HTTP de descarga:
Content-Type, Content-Disposition, nombre del archivo, codificacion.
Reporta SOLO defectos del contrato HTTP.`,
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'description'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          description: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reason'],
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
}

phase('Buscar')

const rondas = await parallel(
  LENTES.map((lente) => () =>
    agent(
      `${ALCANCE}

NO modifiques ningun archivo: esto es una revision.

${lente.prompt}

Cada hallazgo debe ser concreto y ubicable en un archivo. No reportes mejoras de estilo ni sugerencias generales.`,
      { label: `finder:${lente.key}`, phase: 'Buscar', schema: FINDINGS_SCHEMA },
    ),
  ),
)

// Dedup y control de alcance: esto es codigo normal, no un agente.
// Enrutamiento predecible = codigo. Un hallazgo sobre otro repositorio no entra al grafo.
const vistos = new Set()
const hallazgos = []
let fueraDeAlcance = 0
for (let i = 0; i < rondas.length; i++) {
  const ronda = rondas[i]
  if (!ronda || !ronda.findings) continue
  for (const f of ronda.findings) {
    if (!f.file || !f.file.includes(TARGET)) {
      fueraDeAlcance++
      continue
    }
    const clave = `${f.file}::${f.title.toLowerCase().slice(0, 40)}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    hallazgos.push({ ...f, lente: LENTES[i].key })
  }
}

if (fueraDeAlcance > 0) {
  log(`${fueraDeAlcance} hallazgos descartados por apuntar fuera del directorio objetivo`)
}
log(`${hallazgos.length} hallazgos unicos tras dedup (de ${rondas.filter(Boolean).length} lentes)`)

phase('Verificar')

// La arista que define el grafo: el que crea nunca es el que aprueba.
const juzgados = await parallel(
  hallazgos.map((h) => () =>
    agent(
      `${ALCANCE}

NO modifiques ningun archivo.

Tu unico trabajo es REFUTAR este hallazgo reportado por otro revisor:

Titulo: ${h.title}
Archivo: ${h.file}
Descripcion: ${h.description}

Lee el codigo real y comprueba si el problema existe de verdad. Marca refuted=true si el hallazgo
es falso, ya esta resuelto en el codigo, o no se puede reproducir. Ante la duda, refuta.`,
      { label: `refuta:${h.title.slice(0, 30)}`, phase: 'Verificar', schema: VERDICT_SCHEMA },
    ).then((v) => ({ hallazgo: h, verdict: v })),
  ),
)

const confirmados = juzgados.filter((j) => j && j.verdict && !j.verdict.refuted)
const refutados = juzgados.filter((j) => j && j.verdict && j.verdict.refuted)

log(`confirmados: ${confirmados.length} · refutados: ${refutados.length}`)

return {
  total: hallazgos.length,
  confirmados: confirmados.map((j) => ({
    titulo: j.hallazgo.title,
    archivo: j.hallazgo.file,
    lente: j.hallazgo.lente,
    descripcion: j.hallazgo.description,
  })),
  refutados: refutados.map((j) => ({
    titulo: j.hallazgo.title,
    lente: j.hallazgo.lente,
    porque: j.verdict.reason,
  })),
}
