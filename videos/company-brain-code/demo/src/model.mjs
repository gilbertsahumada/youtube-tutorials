import {validateAnswer} from './memory.mjs';

export function requestBody(messages, env = process.env) {
  if (!env.MODEL_ID) throw Error('Falta MODEL_ID');
  return {model: env.MODEL_ID, temperature: 0, messages};
}

export async function askModel(body, context, env = process.env, api = fetch) {
  for (const key of ['MODEL_BASE_URL', 'MODEL_API_KEY']) if (!env[key] || env[key] === 'REEMPLAZAR') throw Error(`Configura ${key} en .env`);
  const url = new URL(env.MODEL_BASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('Usa un endpoint HTTPS sin credenciales, query ni fragmento en la URL');
  const response = await api(`${url.href.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: {'content-type': 'application/json', authorization: `Bearer ${env.MODEL_API_KEY}`},
    body: JSON.stringify(body)
  });
  if (!response.ok) throw Error(`El proveedor respondió HTTP ${response.status}; revisa endpoint, modelo y credenciales`);
  const result = await response.json(), text = result.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw Error('El proveedor no devolvió texto en choices[0].message.content');
  let answer;
  try { answer = JSON.parse(text); } catch { throw Error('El modelo no devolvió el JSON solicitado; revisa la respuesta con tu proveedor'); }
  return validateAnswer(answer, context);
}
