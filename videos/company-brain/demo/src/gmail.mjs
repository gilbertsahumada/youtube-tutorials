import { privatePath, readJson } from './common.mjs';

export function mailbox(header) {
  if ((header.match(/</g) || []).length > 1) throw Error('Remitente ambiguo');
  const match = header.match(/<([^<>]+)>\s*$/);
  const address = (match ? match[1] : header).trim().toLowerCase();
  if (!/^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(address)) throw Error('Remitente ambiguo');
  return address;
}
export function plainText(payload) {
  if (payload.mimeType === 'text/plain' && payload.body?.data) return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  return (payload.parts || []).filter(p => !p.filename).map(plainText).filter(Boolean).join('\n');
}
export async function gmailClient() {
  const token = await readJson(privatePath('gmail-token.json'));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST', signal:AbortSignal.timeout(30000),
    body:new URLSearchParams({ client_id:process.env.GOOGLE_CLIENT_ID || '', client_secret:process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token:token.refresh_token, grant_type:'refresh_token' })
  });
  if (!response.ok) throw Error(`Refresh OAuth: HTTP ${response.status}. Reautoriza Gmail si el token expiró.`);
  const { access_token } = await response.json();
  return async (path, params = {}) => {
    const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`);
    url.search = new URLSearchParams(params).toString();
    const res = await fetch(url, { headers:{authorization:`Bearer ${access_token}`}, signal:AbortSignal.timeout(30000) });
    if (!res.ok) throw Error(`Gmail respondió HTTP ${res.status}`);
    return res.json();
  };
}
export async function getEmails() {
  const api = await gmailClient();
  const labels = await api('labels');
  const label = labels.labels?.find(x => x.name === process.env.GMAIL_LABEL);
  if (!label) throw Error('No existe GMAIL_LABEL. Créala manualmente en Gmail.');
  const after = Date.parse(process.env.GMAIL_AFTER);
  if (!Number.isFinite(after)) throw Error('Define GMAIL_AFTER como fecha ISO válida');
  const ids = [];
  let pageToken = '';
  do {
    const page = await api('messages', { labelIds:label.id, q:`after:${Math.floor(after / 1000)}`, maxResults:'100', ...(pageToken ? {pageToken} : {}) });
    ids.push(...(page.messages || [])); pageToken = page.nextPageToken || '';
    if (ids.length > 500) throw Error('Más de 500 correos: usa una etiqueta y ventana temporal más acotadas');
  } while (pageToken);
  const emails = [];
  for (const { id } of ids) {
    const mail = await api(`messages/${encodeURIComponent(id)}`, {format:'full'});
    const header = name => mail.payload.headers.find(x => x.name.toLowerCase() === name)?.value || '';
    let from;
    try { from = mailbox(header('from')); } catch { continue; }
    if (from !== process.env.APPROVED_SENDER.toLowerCase()) continue;
    const text = plainText(mail.payload);
    if (!text || text.length > 20000 || Number(mail.internalDate) <= after) continue;
    emails.push({ id, from, subject:header('subject'), date:new Date(Number(mail.internalDate)).toISOString(), text });
  }
  return emails.sort((a,b) => Date.parse(a.date) - Date.parse(b.date));
}
