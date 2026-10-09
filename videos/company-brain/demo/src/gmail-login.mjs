import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { loadEnv, privatePath, saveJson } from './common.mjs';

loadEnv();
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) if (!process.env[key]) throw Error(`Falta ${key}`);
const state = randomBytes(24).toString('hex');
const verifier = randomBytes(48).toString('base64url');
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const redirect = `http://127.0.0.1:${server.address().port}/callback`;
const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirect,
  response_type: 'code', scope: 'https://www.googleapis.com/auth/gmail.readonly',
  access_type: 'offline', prompt: 'consent', state,
  code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
console.log('Abre esta URL en tu navegador y autoriza SOLO la cuenta de prueba:\n\n'+url.href);
const timer = setTimeout(() => { console.error('OAuth expiró. Reintenta npm run gmail:login.'); server.close(); }, 300000);
server.on('request', async (req, res) => {
  const callback = new URL(req.url, redirect);
  if (callback.pathname !== '/callback') { res.writeHead(404).end(); return; }
  if (callback.searchParams.get('state') !== state) { res.writeHead(400).end('Estado OAuth incorrecto'); return; }
  try {
    const code = callback.searchParams.get('code');
    if (!code) throw Error('Autorización cancelada o sin código');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method:'POST', signal:AbortSignal.timeout(30000),
      body:new URLSearchParams({ client_id:process.env.GOOGLE_CLIENT_ID, client_secret:process.env.GOOGLE_CLIENT_SECRET,
        code, code_verifier:verifier, redirect_uri:redirect, grant_type:'authorization_code' })
    });
    if (!response.ok) throw Error(`OAuth respondió HTTP ${response.status}`);
    const token = await response.json();
    if (!token.refresh_token) throw Error('No se recibió refresh_token; revoca el permiso y autoriza nuevamente');
    await saveJson(privatePath('gmail-token.json'), { refresh_token:token.refresh_token });
    res.end('Gmail conectado. Puedes cerrar esta ventana.');
    console.log('Refresh token guardado localmente en .private/gmail-token.json (no se imprime ni se sube a Git).');
  } catch (error) { res.writeHead(400).end('No se pudo completar OAuth. Revisa la terminal.'); console.error(error.message); }
  finally { clearTimeout(timer); server.close(); }
});
