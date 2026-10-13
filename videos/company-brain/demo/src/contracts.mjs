/**
 * Contratos públicos compartidos por API, persistencia y vistas. Las fechas representan UTC.
 * Estos tipos ayudan al editor sin añadir dependencias al servidor.
 *
 * @typedef {object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} repository Repositorio con formato owner/repo.
 * @property {string} gmailAfter Fecha y hora ISO en UTC.
 * @property {string} gmailLabel Etiqueta opcional; una cadena vacía no restringe por etiqueta.
 * @property {boolean} autoEnabled
 * @property {number} pollSeconds
 *
 * @typedef {object} Email
 * @property {string} id
 * @property {string} threadId Identifica la conversación, incluso cuando llegan nuevas respuestas.
 * @property {string} from
 * @property {string} subject
 * @property {string} date Fecha y hora ISO en UTC.
 * @property {string} text Texto plano original, sin traducción ni interpretación como HTML.
 * @property {string} [hash] Versión persistida del contenido.
 * @property {boolean} [analyzed]
 *
 * @typedef {object} Issue
 * @property {number} number
 * @property {string} title
 * @property {string} body
 * @property {"open"|"closed"} state
 * @property {string} html_url
 * @property {number|null} userId
 *
 * @typedef {object} Proposal
 * @property {string} id
 * @property {string} projectId
 * @property {string} repository
 * @property {"create_issue"|"update_issue"} action
 * @property {"pending"|"approved"|"rejected"|"stale"} status
 * @property {number|null} issueNumber
 * @property {string} title
 * @property {string} body
 * @property {string} reason
 * @property {Array<{before:string, after:string}>} changes Sustituciones exactas, sin reescribir otros requisitos.
 * @property {string[]} sourceEmailIds
 * @property {string} generationKey Identifica la misma propuesta en reintentos del análisis.
 * @property {string} issueDigest Versión del conjunto de issues al analizar.
 * @property {Array<{id:string, threadId:string, from:string, subject:string, date:string, hash:string}>} sources
 * @property {Array<{emailId:string, quote:string}>} evidence Citas literales de las fuentes.
 * @property {Issue|null} issueSnapshot Versión revisada por la persona antes de aprobar.
 * @property {Issue|null} result Resultado de una publicación aprobada.
 * @property {string|null} error
 */
export {};
