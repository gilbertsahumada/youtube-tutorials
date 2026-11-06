const colors = {
  key: '\u001b[96m',
  string: '\u001b[92m',
  number: '\u001b[93m',
  boolean: '\u001b[95m',
  null: '\u001b[90m',
};
const reset = '\u001b[0m';

function supportsColor(): boolean {
  if (process.env.NO_COLOR !== undefined || process.env.FORCE_COLOR === '0') return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return Boolean(process.stdout.isTTY) && process.env.TERM !== 'dumb';
}

/** Colorea la representación visible; nunca modifica el objeto ni la solicitud HTTP. */
export function formatJson(value: unknown, color = supportsColor()): string {
  const json = JSON.stringify(value, null, 2) ?? 'null';
  if (!color) return json;
  // Consumir cada string completo evita colorear números o palabras dentro de él.
  return json.replace(/"(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b/g, token => {
    const kind = token.startsWith('"') ? token.endsWith(':') ? 'key' : 'string'
      : token === 'null' ? 'null' : token === 'true' || token === 'false' ? 'boolean' : 'number';
    return `${colors[kind]}${token}${reset}`;
  });
}
