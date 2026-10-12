export async function readResponse(response) {
  let result;
  try { result = await response.json(); }
  catch { throw Error('El servidor devolvió una respuesta vacía o inválida. Reinicia la demo y recarga la página.'); }
  if (!result || typeof result !== 'object') throw Error('El servidor devolvió una respuesta vacía o inválida. Reinicia la demo y recarga la página.');
  if (!response.ok) throw Object.assign(Error(result.error || 'No se pudo completar la operación.'), { payload: result });
  return result;
}
