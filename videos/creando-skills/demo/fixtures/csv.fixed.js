const HEADERS = ["Fecha", "Cliente", "Servicio"];

function escapeCell(value) {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');

  return /[",\n]/.test(text) ? `"${escaped}"` : escaped;
}

export function toCsv(reservas) {
  const rows = reservas.map((reserva) =>
    [reserva.fecha, reserva.cliente, reserva.servicio]
      .map(escapeCell)
      .join(","),
  );

  return [HEADERS.join(","), ...rows].join("\n");
}
