const HEADERS = ["Fecha", "Cliente", "Servicio"];

function escapeCell(value) {
  return String(value ?? "").replaceAll('"', '""');
}

export function toCsv(reservas) {
  const rows = reservas.map((reserva) =>
    [reserva.fecha, reserva.cliente, reserva.servicio]
      .map(escapeCell)
      .join(","),
  );

  return `\uFEFF${[HEADERS.join(","), ...rows].join("\n")}`;
}
