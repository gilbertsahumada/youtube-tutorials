/** Conserva foco y cursor cuando se renueva una vista, sin volver a desplazar la página. */
export function captureFocus() {
  const focused = document.activeElement;
  return {
    id: focused?.id,
    cursor: focused instanceof HTMLInputElement ? focused.selectionStart : null,
  };
}
export function restoreFocus({ id, cursor }, { allowNumber = false } = {}) {
  const input = id && document.getElementById(id);
  if (!input) return;
  input.focus({ preventScroll: true });
  if (
    cursor === null ||
    !(input instanceof HTMLInputElement) ||
    input.type === "datetime-local" ||
    (!allowNumber && input.type === "number")
  )
    return;
  try {
    input.setSelectionRange(cursor, cursor);
  } catch {
    /* Algunos controles no admiten selección de texto. */
  }
}
