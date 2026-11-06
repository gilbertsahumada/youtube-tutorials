import type { Destination, JevResult, Route } from './types.ts';

export function applyPolicy(result: JevResult): Destination {
  const destinations: Record<Route, Destination> = {
    investigar_fallo: 'pendiente_de_investigacion',
    pedir_informacion: 'pendiente_de_informacion',
  };
  return destinations[result.answers.ruta.choice];
}
