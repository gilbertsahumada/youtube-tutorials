import { locales, readLanguage, saveLanguage, translate, localize } from './i18n.js';
import { readResponse } from './http.js';

let browserStorage;
try { browserStorage = window.localStorage; } catch { /* Optional preference storage. */ }
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const notice = document.querySelector('#notice');
const state = { language: readLanguage(browserStorage), page: 'decisions', workspace: null, proposals: [], config: null, events: [], busy: false, analyzed: false, monitoring: false, mailbox: [], ambiguous: [], editing: null, projectDraft: {}, filterDraft: { kind: 'email' }, bootError: null };
let token, monitor, authPoll, noticeTimer, reviewedWorkspace;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const date = value => value ? new Intl.DateTimeFormat(locales[state.language], { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).format(new Date(value)) : '';
const dateMarkup = value => `<span data-date="${escape(value)}">${date(value)}</span>`;
const url = value => { try { const parsed = new URL(value); return parsed.protocol === 'https:' ? parsed.href : '#'; } catch { return '#'; } };
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-.5 3-2 .9-2.5-1L2 10l2.5 2L4 14l-2 1 2 4 3-1 2 1 .5 3h5l.5-3 2-1 3 1 2-4-2-1-.5-2 2.5-2-2-4-2.5 1-2-.9-.5-3Z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
  book: '<path d="M12 6c-3-3-7-3-10-1v15c3-2 7-2 10 1 3-3 7-3 10-1V5c-3-2-7-2-10 1Zm0 0v15"/>',
  link: '<path d="m10 14 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0-1 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',
  file: '<path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-7-7Zm0 0v7h7M8 14h8M8 18h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="m12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7l9-4Z"/><path d="m8 12 3 3 5-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const brand = '<span class="brand-symbol"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 13 27 19 16 28Z" fill="none" stroke="#b9c4ff" stroke-width="2"/><g fill="white"><circle cx="12" cy="13" r="3.5"/><circle cx="27" cy="19" r="3.5"/><circle cx="16" cy="28" r="3.5"/></g></svg></span>';
const gmail = '<span class="source-icon gmail"><svg viewBox="0 0 24 20" aria-hidden="true"><path d="M2 18V3l10 7L22 3v15" fill="none" stroke="#4285f4" stroke-width="3.5"/><path d="m2 3 10 7L22 3" fill="none" stroke="#ea4335" stroke-width="3.5"/><path d="M22 6v12" stroke="#34a853" stroke-width="3.5"/><path d="M2 6v12" stroke="#c5221f" stroke-width="3.5"/></svg></span>';
const github = `<span class="source-icon github"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.58 9.58 0 0 1 5 0c1.9-1.3 2.74-1.03 2.74-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg></span>`;

const project = () => state.config?.project || state.workspace?.project;
const projectName = () => project()?.name || 'Company Brain';
const projectId = () => state.config?.project?.id;
const configPath = () => `/api/config?projectId=${encodeURIComponent(projectId() || '')}`;
async function refresh(id = projectId()) {
  const response = await fetch(`/api/bootstrap?projectId=${encodeURIComponent(id || '')}`);
  const result = await readResponse(response).catch(error => {
    if (error.payload?.config) return error.payload;
    throw error;
  });
  if (!result.config) throw Error(result.error || 'No se pudo cargar tu contexto.');
  token = result.token; state.config = result.config; state.workspace = result.workspace;
  state.proposals = result.proposals || []; state.events = result.events || result.config.events || [];
  state.analyzed = Boolean(result.workspace?.analysis); state.bootError = result.error || null;
}

async function request(path, body) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Company-Brain-Token': token || '', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return readResponse(response);
}
function toast(message, error = false) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.className = `notice${error ? ' error' : ''}`;
  notice.hidden = false;
  applyLanguage(notice);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, error ? 11000 : 5000);
}
async function operate(action) {
  if (state.busy) return false;
  state.busy = true;
  render();
  let success = false;
  try { await action(); success = true; }
  catch (error) { toast(error.message, true); }
  finally { state.busy = false; render(); }
  return success;
}
function nav(page, name, symbol, count) {
  return `<button class="nav-item ${state.page === page ? 'active' : ''}" data-page="${page}" ${state.page === page ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${name}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</button>`;
}
function shell(content) {
  const names = { decisions: 'Centro de decisiones', sources: 'Fuentes de contexto', activity: 'Actividad', settings: 'Conexiones', projects: 'Proyectos y filtros' };
  return `<header class="topbar"><a class="brand" href="/">${brand}<span>Company Brain</span></a><span class="top-divider"></span><span class="top-tag">Demo interactiva</span><div class="top-actions"><button class="text-button" data-action="guide" aria-label="Cómo funciona">${icon('book')}<span>Cómo funciona</span></button><button class="icon-button" data-page="settings" aria-label="Ver conexiones">${icon('settings')}</button><button class="language-button" data-action="language" data-source aria-label="Switch to English" title="Switch to English" lang="en">EN</button></div></header>
  <div class="layout"><aside class="sidebar"><div class="workspace-label">Tu espacio de trabajo</div><nav aria-label="Navegación principal">${nav('projects', 'Proyectos y filtros', 'file')}${nav('decisions', 'Centro de decisiones', 'grid')}${nav('sources', 'Fuentes de contexto', 'layers', state.workspace?.requestEmail ? 3 : state.workspace?.initialEmail ? 2 : '')}${nav('activity', 'Actividad', 'activity', state.events.length || '')}</nav>${project() ? `<div class="sidebar-project"><span class="workspace-label">Proyecto conectado</span><div class="project-link">${icon('file')}<div><strong data-source>${escape(projectName())}</strong><span data-source>${escape(project()?.requirement)}</span></div><span class="project-dot"></span></div></div>` : ''}<div class="sidebar-bottom"><div class="connection-note-sidebar">${icon('link')}<div><strong>Datos de tus cuentas</strong><p>Credenciales desde el entorno.</p></div></div><button class="nav-item" data-page="settings">${icon('settings')}<span>Conexiones</span></button><a class="tutorial-link" href="https://youtu.be/uB21nWjsx50" target="_blank" rel="noopener noreferrer">Ver el video del tutorial ${icon('external')}</a></div></aside>
  <main id="main"><div class="workspace-toolbar"><div class="breadcrumb">${escape(names[state.page])}${state.config?.ready ? `<span>/</span><strong data-source>${escape(projectName())}</strong>` : ''}</div>${state.config?.projects?.length ? `<label class="project-switch"><span>Proyecto</span><select id="workspace-project" aria-label="Proyecto activo" ${state.busy ? 'disabled' : ''}>${state.config.projects.map(item => `<option data-source value="${escape(item.id)}" ${item.id === projectId() ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}</select></label>` : ''}<span class="pill ${state.config?.environmentReady ? 'success' : 'error-pill'}">${state.config?.environmentReady ? 'Entorno listo' : 'Entorno incompleto'}</span></div>${content}<footer class="main-footer"><span>${icon('shield')} Tú decides. Company Brain aporta el contexto.</span><span>Demo de IA en Producción</span></footer></main></div>`;
}
function configurationError() {
  if (state.config?.environmentReady && !state.config?.ready) return `<section class="setup-empty">${brainDrawing()}<h1>${project() ? 'Define quién participa en este proyecto.' : 'Crea tu primer proyecto.'}</h1><p>${project() ? 'Añade correos o dominios para encontrar sus acuerdos y solicitudes.' : 'Vincula una tarea de GitHub y elige los correos que forman parte de su contexto.'}</p><button class="button primary" data-page="projects">${icon('plus')}Proyectos y filtros</button></section>`;
  const missing = state.config?.missing || [];
  const errors = state.config?.errors || [];
  const title = missing.length ? 'Faltan variables de entorno.' : errors.length ? 'Revisa las variables de entorno.' : 'No se pudo cargar tu contexto.';
  return `<section class="environment-error" role="alert"><span class="error-symbol">${icon('settings')}</span><span class="error-kicker">Configuración requerida</span><h1>${title}</h1><p>Completa las variables en el entorno o en <code>demo/.env</code> y reinicia el servidor.</p>${missing.length ? `<div class="missing-variables" aria-label="Variables faltantes">${missing.map(key => `<code>${escape(key)}</code>`).join('')}</div>` : ''}${errors.length ? `<ul class="environment-validation">${errors.map(error => `<li><code>${escape(error.field)}</code><span>${escape(error.message)}</span></li>`).join('')}</ul>` : ''}${state.bootError && !missing.length && !errors.length ? `<p class="negative">${escape(state.bootError)}</p>` : ''}<div class="error-actions"><button class="button primary" data-action="reload">${icon('reset')}Reintentar</button>${state.page !== 'settings' ? '<button class="button secondary" data-page="settings">Ver conexiones</button>' : ''}</div><span class="small-note">Las credenciales se leen en el servidor.</span></section>`;
}
function highlight(text, quote) {
  if (!quote || !text?.includes(quote)) return escape(text);
  const position = text.indexOf(quote);
  return escape(text.slice(0, position)) + `<mark>${escape(quote)}</mark>` + escape(text.slice(position + quote.length));
}
function sourceHeader(type, title, dateValue, badge = '') {
  return `<div class="source-header">${type === 'gmail' ? gmail : github}<div><strong>${title}</strong><span>${type === 'gmail' ? dateMarkup(dateValue) : escape(dateValue)}</span></div>${badge ? `<span class="pill ${badge === 'Nuevo' ? 'new' : 'neutral'}">${badge}</span>` : ''}</div>`;
}
function emailCard(email, initial = false) {
  const quote = initial ? state.workspace.analysis?.initialEvidence : state.workspace.analysis?.requestEvidence;
  return `<article class="source-card ${initial ? 'agreement-card' : 'request-card'}">${sourceHeader('gmail', initial ? 'Acuerdo inicial' : 'Nueva solicitud', email.date, initial ? 'Contexto' : 'Nuevo')}<div class="email-meta"><span class="client-avatar">${escape(email.from.slice(0, 1).toUpperCase())}</span><div><strong>Remitente</strong><span data-source>${escape(email.from)}</span></div></div><h3 data-source>${escape(email.subject)}</h3><p class="email-text" data-source>${highlight(email.text, quote)}</p><div class="source-bottom">${icon('link')}<span data-source>${escape(projectName())}</span><button class="icon-button small" data-action="${initial ? 'initial-detail' : 'request-detail'}" aria-label="Ver ${initial ? 'acuerdo inicial completo' : 'solicitud completa'}">${icon('external')}</button></div></article>`;
}
function issueCard(issue) {
  const format = issue.body.match(/^Formato actual: (\w+)/m)?.[1] || '—';
  const description = issue.body.match(/^Aceptación:\s*(.*)$/m)?.[1] || issue.body.split(/\n\s*\n/).find(part => !/^(Proyecto|Entrega|Requisito|Formato actual):/m.test(part)) || issue.body;
  return `<article class="source-card issue-card">${sourceHeader('github', 'Tarea en curso', `Issue #${issue.number}`, issue.state === 'open' ? 'Abierto' : 'Cerrado')}<h3 data-source>${escape(issue.title)}</h3><p data-source>${escape(description)}</p><div class="format-row"><span>Formato actual</span><strong class="format-chip">${escape(format)}</strong></div><div class="source-bottom">${icon('file')}<span data-source>${escape(project()?.delivery)} · ${escape(project()?.requirement)}</span><button class="icon-button small" data-action="issue-detail" aria-label="Ver tarea completa">${icon('external')}</button></div></article>`;
}
function brainDrawing() {
  return `<svg class="brain-drawing" viewBox="0 0 200 135" fill="none" aria-hidden="true"><path d="M35 40 95 65 165 30M35 100l60-35 65 38M95 65v-40" stroke="#ced4ec" stroke-width="1.5" stroke-dasharray="4 5"/><circle cx="95" cy="65" r="32" fill="#f1f2fb" stroke="#d8dcf3"/><circle cx="95" cy="65" r="23" fill="#5962cc"/><path d="m87 57 16 6-12 14Z" stroke="white" stroke-width="1.5"/><circle cx="87" cy="57" r="3" fill="white"/><circle cx="103" cy="63" r="3" fill="white"/><circle cx="91" cy="77" r="3" fill="white"/><g fill="white" stroke="#d8deeb"><rect x="17" y="23" width="36" height="34" rx="10"/><rect x="17" y="83" width="36" height="34" rx="10"/><rect x="146" y="13" width="36" height="34" rx="10"/><rect x="142" y="85" width="36" height="34" rx="10"/><circle cx="95" cy="22" r="10"/></g><path d="m27 34 8 6 8-6m-16 0v13h16V34M27 94h16m-16 6h12M156 24l6 6 10-10m-18 76h14m-14 6h10" stroke="#9ca9c4" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}
function proposal() {
  const w = state.workspace;
  const plan = w.plan;
  if (!plan || plan.action !== 'comment') return `<section class="proposal-card empty-proposal"><div class="brain-label">${brand}<span>Company Brain</span></div>${brainDrawing()}<h3>${state.busy ? 'Conectando las piezas…' : plan?.action === 'skip' ? 'No hace falta proponer un cambio' : 'El contexto está listo.'}</h3><p>${state.busy ? 'Revisando el acuerdo, la tarea y la nueva solicitud.' : plan?.action === 'skip' ? escape(plan.reason) : 'Busca solicitudes en Gmail para contrastarlas con el acuerdo y la tarea.'}</p><button class="button primary" data-action="analyze" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="loader"></span>' : icon('sparkle')}${state.busy ? 'Analizando…' : 'Buscar solicitudes'}</button><span class="small-note">Consulta Gmail, GitHub y tu modelo</span></section>`;
  const done = Boolean(w.published);
  return `<section class="proposal-card ready-proposal"><div class="brain-label">${brand}<span>Company Brain</span><span class="analysis-check">${icon('check')}</span></div><div class="proposal-status">${icon(done ? 'check' : 'clock')} ${done ? 'Comentario publicado' : 'Necesita tu revisión'}</div><h3>Una nueva prioridad para la entrega.</h3><p>El cliente solicita ${escape(plan.toFormat)}, pero la tarea sigue planificada en ${escape(plan.fromFormat)}.</p><div class="change-comparison"><div><span>Plan actual</span><strong>${escape(plan.fromFormat)}</strong></div>${icon('arrow')}<div class="proposed-format"><span>Propuesta</span><strong>${escape(plan.toFormat)}</strong></div></div><div class="proposal-reason"><strong>Por qué revisarlo</strong><p data-source>${escape(w.analysis.rationale)}</p></div><div class="evidence-count">${icon('check')} Contraste de los dos correos y la tarea</div><button class="button primary full" data-action="review">${icon('book')}${done ? 'Ver comentario' : 'Revisar propuesta'}</button><p class="review-note">${icon('shield')} ${done ? 'La tarea conserva su alcance original.' : 'El alcance cambia cuando tú lo decides.'}</p></section>`;
}
function pipeline() {
  return `<section class="pipeline" aria-label="Recorrido de la solicitud"><div class="pipeline-title"><h2>La conexión, paso a paso</h2><span>Tu contexto, en una sola vista</span></div><ol class="pipeline-steps"><li class="complete"><span class="step-dot">${icon('check')}</span><div><strong>Contexto reunido</strong><span>Correo inicial + tarea</span></div></li><li class="complete"><span class="step-dot">${icon('check')}</span><div><strong>Solicitud recibida</strong><span>Una nueva prioridad</span></div></li><li class="${state.analyzed ? 'complete' : 'current'}"><span class="step-dot">${state.analyzed ? icon('check') : '3'}</span><div><strong>Propuesta con evidencia</strong><span>${state.analyzed ? 'Fuentes contrastadas' : 'Lista para analizar'}</span></div></li><li class="${state.workspace.published ? 'complete' : ''}"><span class="step-dot">${state.workspace.published ? icon('check') : '4'}</span><div><strong>Revisión humana</strong><span>Tú decides qué hacer</span></div></li></ol></section>`;
}
function decisions() {
  const w = state.workspace;
  const pendingCount = state.proposals.length;
  if (!state.config.gmailConnected || !state.config.baseline) return `<div class="page-heading"><div><h1>Conecta el contexto de tu equipo.</h1><p>Empieza por tus fuentes y captura el acuerdo inicial.</p></div></div><section class="setup-empty">${brainDrawing()}<h2>Tu Company Brain empieza con un acuerdo.</h2><p>Autoriza Gmail y selecciona el correo que define el alcance de la tarea configurada en GitHub.</p><button class="button primary" data-page="settings">${icon('link')}Ver conexiones</button></section>`;
  if (!w?.initialEmail) return `<div class="page-heading"><div><h1>El acuerdo inicial está guardado.</h1><p>Busca nuevas solicitudes para reunir el contexto actual.</p></div><button class="button primary" data-action="analyze" ${state.busy ? 'disabled' : ''}>${icon('sparkle')}Buscar solicitudes</button></div>`;
  return `<section class="page-heading"><div><div class="project-kicker"><span class="project-dot"></span><span data-source>${escape(projectName())}</span><span class="soft-divider">/</span><span data-source>${escape(project()?.delivery)}</span></div><h1>Del correo a una decisión.</h1><p>Lo que se conversa y lo que se construye, con el mismo contexto.</p></div><div class="heading-actions"><button class="button primary" data-action="${w.plan?.action === 'comment' ? 'review' : 'analyze'}" ${state.busy ? 'disabled' : ''}>${icon(w.plan?.action === 'comment' ? 'book' : 'sparkle')}${state.busy ? 'Analizando…' : w.plan?.action === 'comment' ? w.published ? 'Ver comentario' : 'Revisar propuesta' : 'Buscar solicitudes'}</button><button class="button secondary" data-action="monitor" ${state.busy ? 'disabled' : ''}>${icon(state.monitoring ? 'pause' : 'activity')}${state.monitoring ? 'Detener observación' : 'Observar Gmail'}</button></div></section>
  <div class="context-strip"><span>${icon('layers')}<strong>${w.requestEmail ? '3' : '2'}</strong> fuentes de contexto</span><span>${icon('clock')}<strong>${pendingCount}</strong> ${pendingCount === 1 ? 'propuesta pendiente' : 'propuestas pendientes'}</span><span>${icon('shield')}Revisión humana en cada cambio</span><span class="data-label live-label">${state.monitoring ? 'Observando Gmail' : 'Cuentas reales'}</span></div>
  <div class="live-actions"><button class="text-button" data-action="analyze" ${state.busy ? 'disabled' : ''}>${icon('reset')}${state.busy ? 'Buscando solicitudes…' : 'Buscar nuevas solicitudes'}</button>${state.proposals.length > 1 ? `<label>Solicitud <select id="proposal-select">${state.proposals.map((entry, index) => `<option data-source value="${index}" ${entry.requestEmail.id === w.requestEmail?.id ? 'selected' : ''}>${escape(entry.requestEmail.subject)}</option>`).join('')}</select></label>` : ''}</div>
  <div class="decision-board"><section class="board-column"><div class="column-heading"><span class="column-symbol">${icon('layers')}</span><h2>Lo que sabemos</h2><span class="column-count">2</span></div>${emailCard(w.initialEmail, true)}${issueCard(w.issue)}</section><section class="board-column"><div class="column-heading"><span class="column-symbol request-symbol">${icon('activity')}</span><h2>Lo que cambió</h2><span class="column-count">${w.requestEmail ? '1' : '0'}</span></div>${w.requestEmail ? emailCard(w.requestEmail) : '<div class="source-card waiting-mail"><h3>Esperando una nueva solicitud</h3><p>Busca nuevos mensajes con la etiqueta y los filtros de este proyecto.</p></div>'}<div class="connection-note">${icon('link')}<p>${state.analyzed && w.analysis?.changeRequested ? 'Mismo proyecto, misma entrega.<br><strong>Una prioridad diferente.</strong>' : 'Cada solicitud se compara con<br>el acuerdo y la tarea existentes.'}</p></div></section><section class="board-column proposal-column"><div class="column-heading"><span class="column-symbol brain-symbol">${icon('sparkle')}</span><h2>Lo que propone el Brain</h2></div>${proposal()}</section></div>${w.requestEmail ? pipeline() : ''}
  <div class="principle-note">${icon('shield')}<p><strong>Una solicitud no es una aprobación.</strong> La propuesta deja evidencia; el equipo decide si cambia la tarea.</p><button class="text-button" data-action="guide">Entender el recorrido ${icon('chevron')}</button></div>`;
}
function sources() {
  const w = state.workspace;
  return `<div class="page-heading"><div><h1>Las fuentes detrás de la propuesta.</h1><p>Todo el contexto que Company Brain utiliza para este caso.</p></div><button class="button secondary" data-page="settings">${icon('settings')}Ver conexiones</button></div><div class="source-list">${w?.initialEmail ? `<article class="source-list-row">${gmail}<div><span class="muted">Acuerdo inicial</span><h2 data-source>${escape(w.initialEmail.subject)}</h2><p><span data-source>${escape(w.initialEmail.from)}</span> · ${dateMarkup(w.initialEmail.date)}</p></div><span class="pill neutral">Gmail</span><button class="button secondary" data-action="initial-detail">Ver correo</button></article>` : ''}${w?.requestEmail ? `<article class="source-list-row">${gmail}<div><span class="muted">Nueva solicitud</span><h2 data-source>${escape(w.requestEmail.subject)}</h2><p><span data-source>${escape(w.requestEmail.from)}</span> · ${dateMarkup(w.requestEmail.date)}</p></div><span class="pill new">Nuevo</span><button class="button secondary" data-action="request-detail">Ver correo</button></article>` : ''}${w?.issue ? `<article class="source-list-row">${github}<div><span class="muted">Tarea existente</span><h2 data-source>${escape(w.issue.title)}</h2><p>Issue #${w.issue.number} · <span data-source>${escape(projectName())}</span></p></div><span class="pill neutral">GitHub</span><button class="button secondary" data-action="issue-detail">Ver tarea</button></article>` : '<div class="source-card"><h2>Captura el acuerdo inicial para reunir tus fuentes.</h2><p>Gmail aporta los acuerdos y las solicitudes. GitHub aporta el trabajo existente.</p><button class="button primary" data-page="settings">Ver conexiones</button></div>'}</div><div class="info-panel">${icon('shield')}<div><h3>El contexto siempre tiene una fuente.</h3><p>La propuesta cita extractos de los correos. El análisis valida que correspondan al mismo proyecto y a la misma entrega.</p></div></div>`;
}
function activities() {
  return `<div class="page-heading"><div><h1>Un recorrido que puedes seguir.</h1><p>Consultas, propuestas y revisiones de este proyecto.</p></div><span class="pill neutral">Cuentas reales</span></div><section class="activity-list">${state.events.length ? state.events.map(event => `<article class="activity-row"><span class="activity-dot">${icon('check')}</span><div><h2>${escape(event.title)}</h2><p>${escape(event.detail)}</p></div><time datetime="${escape(event.date)}">${new Intl.DateTimeFormat(locales[state.language], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(event.date))}</time></article>`).join('') : `<div class="setup-empty">${icon('activity')}<h2>Aquí verás cada paso.</h2><p>Analiza la solicitud para ver cómo se conecta el contexto.</p><button class="button primary" data-page="decisions">Ir al centro de decisiones</button></div>`}</section>`;
}
function projectOptions(selected) {
  return state.config.projects.map(item => `<option data-source value="${escape(item.id)}" ${item.id === selected ? 'selected' : ''}>${escape(item.name)}</option>`).join('');
}
function projects() {
  const items = state.config.projects || [], filters = state.config.filters || [];
  const draft = state.projectDraft, edited = items.find(item => item.id === state.editing);
  const field = (name, label, placeholder, type = 'text') => `<label><span>${label}</span><input name="${name}" type="${type}" value="${escape(draft[name] || '')}" placeholder="${placeholder}" required ${name === 'name' ? 'maxlength="120"' : name === 'repository' ? 'maxlength="200"' : name === 'issueNumber' ? 'min="1" step="1"' : 'pattern="[a-z0-9][a-z0-9_-]{0,79}" maxlength="80"'} ${edited && (name === 'id' || (edited.captured && name !== 'name')) ? 'readonly' : ''}></label>`;
  return `<div class="page-heading"><div><h1>El contexto empieza con las personas.</h1><p>Organiza tus proyectos y elige qué correos forman parte de cada uno.</p></div><span class="pill neutral">Guardado local</span></div>
  <div class="project-panels"><section class="settings-section project-editor"><div class="settings-title"><span class="source-icon model-icon">${icon('file')}</span><div><h2>${edited ? 'Editar proyecto' : 'Nuevo proyecto'}</h2><p>Cada proyecto conecta sus correos con una tarea de GitHub.</p></div></div><form id="project-form" class="project-form"><div class="form-grid">${field('name', 'Nombre del proyecto', 'Nombre de tu proyecto')}${field('id', 'Referencia del proyecto', 'Identificador del proyecto')}${field('repository', 'Repositorio de GitHub', 'owner/repo')}${field('issueNumber', 'Número del issue', 'Número de la tarea', 'number')}${field('delivery', 'Referencia de la entrega', 'Identificador de la entrega')}${field('requirement', 'Referencia del requisito', 'Identificador del requisito')}</div><p class="form-hint">Usa las mismas referencias en el issue y los correos. Este tutorial compara cambios entre CSV y PDF.</p>${edited?.captured ? '<p class="form-hint">El acuerdo capturado conserva su tarea y sus referencias. Para otro alcance, crea un proyecto.</p>' : ''}<div class="form-actions"><button class="button primary" type="submit" ${state.busy ? 'disabled' : ''}>${icon('check')}${edited ? 'Guardar cambios' : 'Crear proyecto'}</button>${edited ? '<button class="button secondary" type="button" data-action="cancel-project">Cancelar</button>' : ''}</div></form></section>
  <section class="settings-section filter-editor"><div class="settings-title"><span class="source-icon model-icon">${icon('link')}</span><div><h2>Correos y dominios</h2><p>Añade un filtro y asígnalo a un proyecto.</p></div></div>${items.length ? `<form id="filter-form" class="filter-form"><label><span>Proyecto</span><select name="projectId">${projectOptions(state.filterDraft.projectId || projectId())}</select></label><label><span>Filtrar por</span><select name="kind" id="filter-kind"><option value="email" ${state.filterDraft.kind === 'email' ? 'selected' : ''}>Correo exacto</option><option value="domain" ${state.filterDraft.kind === 'domain' ? 'selected' : ''}>Dominio completo</option></select></label><label><span>${state.filterDraft.kind === 'domain' ? 'Dominio' : 'Correo electrónico'}</span><input name="value" type="${state.filterDraft.kind === 'domain' ? 'text' : 'email'}" value="${escape(state.filterDraft.value || '')}" placeholder="${state.filterDraft.kind === 'domain' ? 'empresa.com' : 'persona@empresa.com'}" maxlength="254" required autocomplete="off"></label><button class="button primary" type="submit" ${state.busy ? 'disabled' : ''}>${icon('plus')}Guardar filtro</button></form>` : '<div class="empty-inline"><h3>Primero crea un proyecto.</h3><p>Después podrás añadir los correos o dominios de sus participantes.</p></div>'}<p class="form-hint">El correo exacto tiene prioridad sobre el dominio. Añade los subdominios por separado.</p><p class="form-hint">Si un correo coincide con varios proyectos, tú eliges a cuál asignarlo en Conexiones.</p></section></div>
  <section class="settings-section project-list"><div class="settings-title"><div><h2>Tus proyectos</h2><p>Elige un proyecto para capturar su acuerdo y revisar sus solicitudes.</p></div></div>${items.length ? items.map(item => `<article class="saved-project ${item.id === projectId() ? 'selected-project' : ''}"><div class="saved-project-heading"><div><h3 data-source>${escape(item.name)}</h3><p><span data-source>${escape(item.repository)}</span> · Issue #${item.issueNumber}</p>${item.imported ? '<p class="form-hint">Importado de la configuración anterior.</p>' : ''}</div><span class="pill ${item.captured ? 'success' : 'neutral'}">${item.captured ? 'Contexto guardado' : 'Pendiente de captura'}</span></div><div class="saved-filters">${filters.filter(rule => rule.projectId === item.id).map(rule => `<span class="filter-chip"><span>${rule.kind === 'domain' ? 'Dominio' : 'Correo exacto'}</span><strong data-source>${escape(rule.value)}</strong><button class="icon-button small" data-remove-filter="${rule.id}" data-project="${escape(item.id)}" aria-label="Eliminar filtro" ${state.busy ? 'disabled' : ''}>${icon('close')}</button></span>`).join('') || '<span class="muted">Todavía no hay filtros para este proyecto.</span>'}</div><div class="form-actions"><button class="button secondary" data-select-project="${escape(item.id)}" ${state.busy ? 'disabled' : ''}>${icon('arrow')}${item.id === projectId() ? 'Abrir proyecto' : 'Seleccionar proyecto'}</button><button class="text-button" data-edit-project="${escape(item.id)}" ${state.busy ? 'disabled' : ''}>Editar</button></div></article>`).join('') : '<div class="empty-inline"><h3>Todavía no hay proyectos.</h3><p>Crea el primero con el formulario de arriba.</p></div>'}</section>`;
}
function ambiguousMail() {
  if (!state.ambiguous.length) return '';
  return `<div class="ambiguous-list"><h3>Correos por asignar</h3><p>Estos correos coinciden con varios proyectos. Elige su destino antes de capturar o analizar.</p>${state.ambiguous.map(email => `<form class="assignment-form" data-mail-id="${escape(email.id)}"><div><strong data-source>${escape(email.subject)}</strong><span data-source>${escape(email.from)}</span></div><label><span>Asignar a</span><select name="projectId" required><option value="">Selecciona un proyecto</option>${email.projects.map(item => `<option data-source value="${escape(item.id)}">${escape(item.name)}</option>`).join('')}</select></label><button class="button secondary" type="submit" ${state.busy ? 'disabled' : ''}>Asignar correo</button></form>`).join('')}</div>`;
}
function settings() {
  const config = state.config, baseline = config.baseline, ready = config.ready;
  return `<div class="page-heading"><div><h1>El estado de tus conexiones.</h1><p>Las credenciales se leen desde el entorno al iniciar el servidor.</p></div></div>${!ready || state.bootError ? configurationError() : ''}<div class="setup-intro">${icon('shield')}<p>Para cambiar credenciales, actualiza el entorno y reinicia el servidor. Los proyectos y sus filtros se gestionan en Proyectos y filtros.</p></div>
  <section class="settings-section"><div class="settings-title">${gmail}<div><h2>Gmail</h2><p>El acuerdo inicial y las nuevas solicitudes.</p></div><span class="pill ${config.gmailConnected ? 'success' : 'neutral'}">${config.gmailConnected ? 'Lectura autorizada' : 'Pendiente de autorización'}</span></div><p class="connection-description">Autoriza la cuenta receptora usando las credenciales cargadas en el servidor.</p><div class="settings-actions"><button class="button secondary" data-action="gmail-login" ${!config.environmentReady || state.busy ? 'disabled' : ''}>${icon('link')}Conectar Gmail</button></div><div id="oauth-status" class="oauth-status" aria-live="polite"></div></section>
  <section class="settings-section"><div class="settings-title">${github}<div><h2>GitHub</h2><p>La tarea existente y el destino de la propuesta.</p></div><span class="pill ${config.connections.github ? 'success' : 'neutral'}">${config.connections.github ? 'Proyecto configurado' : 'Selecciona un proyecto'}</span></div>${config.connections.github ? `<p class="connection-description"><span data-source>${escape(config.repository)}</span> · Issue #${escape(config.issueNumber)}</p>` : ''}<div class="settings-actions"><button class="button secondary" data-action="github-check" ${!config.environmentReady || state.busy ? 'disabled' : ''}>${icon('check')}Comprobar acceso</button></div></section>
  <section class="settings-section"><div class="settings-title"><span class="source-icon model-icon">${icon('sparkle')}</span><div><h2>Modelo de IA</h2><p>Un proveedor compatible con Chat Completions.</p></div><span class="pill ${config.connections.model ? 'success' : 'neutral'}">${config.connections.model ? 'Variables cargadas' : 'Variables pendientes'}</span></div><p class="connection-description">La URL, el modelo y la clave se leen exclusivamente en el servidor.</p></section>
  <section class="settings-section baseline-section"><div class="settings-title"><span class="source-icon model-icon">${icon('layers')}</span><div><h2>Captura el acuerdo inicial</h2><p>Selecciona el correo real que define el alcance de la tarea.</p></div>${baseline ? '<span class="pill success">Contexto guardado</span>' : ''}</div>${baseline ? `<div class="baseline-saved">${icon('check')}<div><strong data-source>${escape(baseline.initialEmail.subject)}</strong><p>Acuerdo ${escape(baseline.initialFormat)} · Issue #${baseline.issueNumber}. Este contexto se conserva para comparar nuevas solicitudes.</p></div><button class="button primary" data-action="open-live" ${!ready || !config.gmailConnected || state.busy ? 'disabled' : ''}>Buscar solicitudes</button></div>` : ''}<button class="button secondary" data-action="inbox" ${!ready || !config.gmailConnected || state.busy ? 'disabled' : ''}>${icon('reset')}Cargar correos</button>${ambiguousMail()}${!baseline ? `<div id="inbox-list" class="inbox-list">${state.mailbox.map(email => `<button class="inbox-item" data-capture="${escape(email.id)}" ${state.busy ? 'disabled' : ''}>${gmail}<div><strong data-source>${escape(email.subject)}</strong><span><span data-source>${escape(email.from)}</span> · ${dateMarkup(email.date)}</span></div><span>Capturar acuerdo ${icon('chevron')}</span></button>`).join('')}</div>` : ''}</section>`;
}
function render() {
  if (!state.config) return;
  const pages = { decisions, sources, activity: activities, settings, projects };
  const blocked = (!state.config.ready || state.bootError) && !['settings', 'projects'].includes(state.page);
  app.innerHTML = shell(blocked ? configurationError() : pages[state.page]());
  if (state.page === 'settings') renderOAuth();
  applyLanguage();
}
function applyLanguage(root = document.body) {
  localize(root, state.language);
  document.documentElement.lang = state.language;
  document.title = `Company Brain · ${translate('Centro de decisiones', state.language)}`;
  document.querySelector('meta[name="description"]').content = translate('Conecta correos y tareas para convertir nuevas solicitudes en propuestas con contexto. Demo interactiva de Company Brain.', state.language);
  for (const element of root.querySelectorAll('[data-date]')) element.textContent = date(element.dataset.date);
  for (const element of root.querySelectorAll('time[datetime]')) element.textContent = new Intl.DateTimeFormat(locales[state.language], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(element.dateTime));
  const button = document.querySelector('[data-action="language"]');
  if (button) {
    const label = state.language === 'es' ? 'Switch to English' : 'Cambiar a español';
    button.textContent = state.language === 'es' ? 'EN' : 'ES';
    button.lang = state.language === 'es' ? 'en' : 'es';
    button.setAttribute('aria-label', label);
    button.title = label;
  }
}
function openDialog(title, content, wide = false) {
  dialog.className = wide ? 'wide-dialog' : '';
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="Cerrar">${icon('close')}</button></div>${content}`;
  applyLanguage(dialog);
  if (!dialog.open) dialog.showModal();
}
function renderOAuth() {
  const area = document.querySelector('#oauth-status');
  if (!area) return;
  const auth = state.config.oauth;
  area.innerHTML = auth.status === 'waiting' ? `<p>Autoriza la <strong>cuenta receptora</strong>. Al terminar vuelve a esta pantalla.</p><a class="button primary" href="${escape(url(auth.url))}" target="_blank" rel="noopener noreferrer">Abrir autorización de Google ${icon('external')}</a>` : auth.status === 'connected' ? '<p class="positive">Gmail conectado. Ya puedes cargar los correos.</p>' : auth.status === 'error' ? `<p class="negative">${escape(auth.message)}</p>` : auth.status === 'starting' ? '<p>Preparando la autorización…</p>' : '';
  applyLanguage(area);
}
async function analyze() {
  return operate(async () => {
    const result = await request('/api/run', { projectId: projectId() });
    state.workspace = result.workspace;
    state.proposals = result.proposals;
    state.analyzed = Boolean(result.workspace?.analysis);
    state.ambiguous = result.ambiguous || [];
    state.events = result.events;
    state.config = await request(configPath());
    state.bootError = null;
    if (state.ambiguous.length) toast('Hay correos por asignar. Revisa Conexiones.');
    else if (!result.workspace?.requestEmail) toast('No hay nuevas solicitudes con los filtros configurados.');
    else if (result.workspace.plan?.action === 'skip') toast(result.workspace.plan.reason);
  });
}
function commentMarkup(body) {
  const text = body.replace(/^<!--.*?-->\n\n/, '').replace(/&#64;/g, '@').replace(/&#58;/g, ':').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const inline = text => escape(text).replace(/(?<!\\)\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(?<!\\)`([^`]+)`/g, '<code>$1</code>');
  return text.split('\n').filter(Boolean).map(line => {
    if (line.startsWith('### ')) return `<h4>${inline(line.slice(4))}</h4>`;
    if (line.startsWith('## ')) return `<h3>${inline(line.slice(3))}</h3>`;
    if (line.startsWith('> ')) return `<blockquote class="comment-quote">${inline(line.slice(2))}</blockquote>`;
    return `<p>${inline(line)}</p>`;
  }).join('');
}
function review(w = state.workspace) {
  if (!w?.plan?.body) return;
  reviewedWorkspace = w;
  openDialog('Propuesta para el issue', `<div class="review-summary"><span class="pill pending">Issue #${w.issue.number}</span><h3>Proponer ${escape(w.plan.toFormat)} en lugar de ${escape(w.plan.fromFormat)}</h3><p>El comentario reúne la evidencia y pide revisar el alcance. Publicarlo conserva la tarea actual.</p></div><details class="comment-details"><summary>Ver el comentario completo</summary><div class="comment-preview" data-source>${commentMarkup(w.plan.body)}</div></details><div class="review-evidence"><h3>Evidencia del acuerdo inicial</h3><blockquote data-source>${escape(w.analysis.initialEvidence)}</blockquote><h3>Evidencia de la nueva solicitud</h3><blockquote data-source>${escape(w.analysis.requestEvidence)}</blockquote></div><div class="dialog-info">${icon('shield')}<p>La propuesta sigue pendiente de revisión humana. La decisión de cambiar el issue se toma en GitHub.</p></div><div class="dialog-actions"><button class="button secondary" data-action="copy-comment">${icon('copy')}Copiar comentario</button>${w.published ? `<a class="button primary" href="${escape(url(w.published.url))}" target="_blank" rel="noopener noreferrer">Ver en GitHub ${icon('external')}</a>` : `<button class="button primary" data-action="publish" ${state.busy ? 'disabled' : ''}>${icon('external')}Publicar comentario en GitHub</button>`}</div>`, true);
}
function guide() {
  openDialog('De información dispersa a una propuesta clara.', `<p class="dialog-lead">Company Brain conecta tus correos de Gmail con la tarea configurada en GitHub.</p><ol class="guide-steps"><li><span>1</span><div><h3>Define tu proyecto y sus participantes.</h3><p>Vincula una tarea y añade correos o dominios en Proyectos y filtros. Después captura el acuerdo inicial en Conexiones.</p></div></li><li><span>2</span><div><h3>Conecta la nueva solicitud.</h3><p>Company Brain contrasta los correos con la tarea y prepara una propuesta con evidencia.</p></div></li><li><span>3</span><div><h3>Revisa y decide.</h3><p>La propuesta puede publicarse como comentario. El equipo decide si modifica el alcance.</p></div></li></ol><div class="dialog-actions"><button class="button primary" data-action="close-dialog">Continuar</button><button class="button secondary" data-action="go-settings">Ver conexiones</button></div>`);
}
function detail(kind) {
  const w = state.workspace;
  const value = kind === 'issue' ? w?.issue : kind === 'initial' ? w?.initialEmail : w?.requestEmail;
  if (!value) return;
  openDialog(kind === 'issue' ? `Tarea en GitHub · Issue #${value.number}` : kind === 'initial' ? 'Correo del acuerdo inicial' : 'Correo de la nueva solicitud', `<div class="source-detail"><h3 data-source>${escape(value.title || value.subject)}</h3>${value.from ? `<p class="muted"><span data-source>${escape(value.from)}</span> · ${dateMarkup(value.date)}</p>` : ''}<pre>${escape(value.body || value.text)}</pre><a class="button secondary" href="${escape(url(kind === 'issue' ? value.html_url : `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(value.id)}`))}" target="_blank" rel="noopener noreferrer">Abrir en ${kind === 'issue' ? 'GitHub' : 'Gmail'} ${icon('external')}</a></div>`);
}
function stopMonitoring() { clearInterval(monitor); state.monitoring = false; }
async function dispatch(action) {
  if (action === 'language') { state.language = state.language === 'es' ? 'en' : 'es'; saveLanguage(browserStorage, state.language); applyLanguage(); return; }
  if (action === 'reload') { location.reload(); return; }
  if (action === 'close-dialog') { dialog.close(); return; }
  if (action === 'guide') { guide(); return; }
  if (action === 'review') { review(); return; }
  if (action.endsWith('-detail')) { detail(action.split('-')[0]); return; }
  if (action === 'go-settings') { dialog.close(); state.page = 'settings'; render(); return; }
  if (action === 'copy-comment') { await copy(reviewedWorkspace.plan.body); return; }
  if (state.busy) return;
  if (action === 'cancel-project') { state.editing = null; state.projectDraft = {}; render(); return; }
  if (!state.config?.environmentReady) return;
  if (!state.config.ready && !['gmail-login', 'github-check'].includes(action)) return;
  if (action === 'analyze') { await analyze(); return; }
  if (action === 'publish') {
    const reviewed = reviewedWorkspace;
    const button = dialog.querySelector('[data-action="publish"]');
    if (button) { button.disabled = true; button.textContent = translate('Publicando comentario…', state.language); }
    await operate(async () => {
      reviewed.published = await request('/api/publish', { key: reviewed.plan.key, projectId: reviewed.project.id });
      state.proposals = state.proposals.filter(entry => entry.plan.key !== reviewed.plan.key);
      state.config = await request(configPath()); state.events = state.config.events;
      toast('Comentario publicado. La tarea sigue pendiente de tu decisión.');
    });
    review(reviewed);
    return;
  }
  if (action === 'github-check') { await operate(async () => { const actor = await request('/api/github/check', {}); toast(`GitHub conectado como ${actor.login}.`); }); return; }
  if (action === 'inbox') { await operate(async () => { await loadInbox(); }); return; }
  if (action === 'open-live') { state.page = 'decisions'; await analyze(); return; }
  if (action === 'gmail-login') {
    const started = await operate(async () => { state.config.oauth = await request('/api/gmail/login', {}); });
    if (!started) return;
    clearInterval(authPoll);
    authPoll = setInterval(async () => {
      try {
        state.config = await request(configPath()); renderOAuth();
        if (['connected', 'error'].includes(state.config.oauth.status)) { clearInterval(authPoll); render(); }
      } catch (error) { clearInterval(authPoll); toast(error.message, true); }
    }, 1500);
    return;
  }
  if (action === 'monitor') {
    if (state.monitoring) { stopMonitoring(); render(); return; }
    state.monitoring = true;
    if (!await analyze()) { stopMonitoring(); render(); return; }
    monitor = setInterval(async () => { if (!state.busy && !dialog.open) await analyze(); }, 30000);
    render(); toast('Observando Gmail cada 30 segundos. Las propuestas esperan tu revisión.');
  }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado.'); }
  catch { toast('Selecciona el texto y cópialo con el teclado.', true); }
}
async function loadInbox() {
  const result = await request('/api/inbox', { projectId: projectId() });
  state.mailbox = result.emails; state.ambiguous = result.ambiguous;
  if (!state.mailbox.length && !state.ambiguous.length) toast('No aparecen correos. Comprueba cuenta, etiqueta, filtros y fecha.', true);
}
async function selectProject(id, open = false) {
  stopMonitoring();
  await operate(async () => {
    await request('/api/projects/select', { projectId: id });
    state.filterDraft.projectId = id;
    await refresh(id); state.mailbox = []; state.ambiguous = [];
    if (open) state.page = state.config.ready && state.config.baseline ? 'decisions' : 'settings';
  });
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action], [data-page], [data-capture], [data-select-project], [data-edit-project], [data-remove-filter]');
  if (!button || button.disabled) return;
  try {
    if (button.dataset.action) await dispatch(button.dataset.action);
    else if (button.dataset.page) { if (state.busy) return; stopMonitoring(); state.page = button.dataset.page; render(); window.scrollTo(0, 0); }
    else if (state.busy) return;
    else if (button.dataset.selectProject) await selectProject(button.dataset.selectProject, true);
    else if (button.dataset.editProject) {
      const item = state.config.projects.find(item => item.id === button.dataset.editProject);
      state.editing = item.id;
      state.projectDraft = Object.fromEntries(['id', 'name', 'repository', 'issueNumber', 'delivery', 'requirement'].map(key => [key, item[key]]));
      render(); document.querySelector('#project-form input').focus();
    }
    else if (button.dataset.removeFilter) await operate(async () => {
      await request('/api/filters/remove', { id: Number(button.dataset.removeFilter), projectId: button.dataset.project });
      await refresh(); state.mailbox = []; state.ambiguous = []; toast('Filtro eliminado.');
    });
    else if (button.dataset.capture) await operate(async () => {
      await request('/api/baseline', { id: button.dataset.capture, projectId: projectId() });
      await refresh(); state.mailbox = []; state.ambiguous = []; state.page = 'decisions';
      toast('Acuerdo capturado. Ya puedes buscar nuevas solicitudes.');
    });
  } catch (error) { toast(error.message, true); }
});
document.addEventListener('input', event => {
  if (event.target.closest('#project-form')) state.projectDraft[event.target.name] = event.target.value;
  if (event.target.closest('#filter-form')) state.filterDraft[event.target.name] = event.target.value;
});
document.addEventListener('change', async event => {
  if (event.target.id === 'proposal-select') { state.workspace = state.proposals[Number(event.target.value)]; state.analyzed = true; render(); }
  if (event.target.id === 'workspace-project') await selectProject(event.target.value);
  if (event.target.id === 'filter-kind') { state.filterDraft.kind = event.target.value; state.filterDraft.value = ''; render(); document.querySelector('#filter-kind').focus(); }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!form.matches('#project-form, #filter-form, .assignment-form')) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  // A field named "id" shadows form.id in browsers.
  const formKind = form.getAttribute('id');
  const emailId = form.dataset.mailId;
  stopMonitoring();
  await operate(async () => {
    if (formKind === 'project-form') {
      const editing = Boolean(state.editing);
      if (!state.editing && state.config.projects.some(item => item.id === values.id)) throw Error('Esa referencia ya existe. Edita el proyecto guardado o elige otra.');
      const saved = await request('/api/projects', { ...values, issueNumber: Number(values.issueNumber) });
      state.editing = null; state.projectDraft = {}; state.filterDraft.projectId = saved.id;
      await refresh(saved.id); state.mailbox = []; state.ambiguous = []; toast(editing ? 'Cambios guardados.' : 'Proyecto guardado. Añade sus correos o dominios.');
    } else if (formKind === 'filter-form') {
      await request('/api/filters', values); state.filterDraft.value = '';
      await refresh(); state.mailbox = []; state.ambiguous = []; toast('Filtro guardado.');
    } else {
      await request('/api/inbox/assign', { id: emailId, projectId: values.projectId });
      await loadInbox(); toast('Correo asignado al proyecto.');
    }
  });
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
window.addEventListener('pagehide', () => { stopMonitoring(); clearInterval(authPoll); });
applyLanguage();
try { await refresh(); render(); }
catch (error) {
  state.config = { ready: false, environmentReady: false, projects: [], filters: [], missing: [], errors: [], connections: {}, oauth: { status: 'idle' } };
  state.workspace = null; state.bootError = error.message; render();
}
