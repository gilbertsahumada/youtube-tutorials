// Las citas se publican como texto, conservando los mismos escapes y saltos de línea.
export function safeText(text) {
  return (
    String(text)
      // eslint-disable-next-line no-control-regex -- Eliminamos controles conservando saltos de línea de las citas.
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/[\\`*_{}[\]()#!|]/g, "\\$&")
      .replace(/@/g, "&#64;")
      .replace(/:/g, "&#58;")
  );
}
