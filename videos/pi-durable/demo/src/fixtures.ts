// Datos de ejemplo de Viena. No son horarios, precios ni pronósticos actuales.
export const TOPICS = ['weather', 'museums', 'trains'] as const;
export type Topic = (typeof TOPICS)[number];
export const FIXTURES: Record<Topic, string> = {
  weather: 'Datos simulados: sábado soleado, 24 °C; domingo, lluvia por la tarde.',
  museums: 'Datos simulados: Kunsthistorisches Museum y Belvedere. Reservar la mañana para museos.',
  trains: 'Datos simulados: tren directo Salzburgo-Viena, 2 h 22 min; alternativa con un trasbordo, 3 h.',
};
export const TRIP = '[viaje] Planifica tres días en Viena. Delega en research la consulta de clima, museos y trenes en background. No inventes reservas ni precios.';
export const STEER = 'Prioriza trenes directos y evita trasbordos.';
