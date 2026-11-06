import { randomUUID } from 'node:crypto';
import type { Interface } from 'node:readline/promises';
import type { Report, RunRecord } from '../domain/types.ts';
import { buildRequest } from '../domain/request.ts';
import { loadDataset } from '../infra/datasets.ts';
import { createJevClient } from '../infra/jev-client.ts';
import { saveRun } from '../infra/run-store.ts';
import { processReport } from '../services/process-report.ts';
import { runBatch } from '../services/batch.ts';
import { showCases, showHelp, showProgress, showRequest, showResult, showSummary } from './output.ts';
import { formatJson } from './json.ts';

export class Session {
  private config: { apiKey: string; model: string };
  private manual: Report[];
  private impact = false;
  private last: RunRecord[] = [];

  constructor(config: { apiKey: string; model: string }, manual: Report[]) {
    this.config = config;
    this.manual = manual;
  }

  private find(id: string): Report {
    const report = this.manual.find(item => item.id === id);
    if (!report) throw new Error(`No existe el caso ${id}. Usa casos para ver las opciones.`);
    return report;
  }

  private async send(reports: Report[], concurrency: number, batch: boolean) {
    // Sin clave no arrancamos un lote ni publicamos tiempos de fallos locales como velocidad de Jev.
    const client = createJevClient({ apiKey: this.config.apiKey });
    console.log(`\nAPI real · ${reports.length} reportes · concurrencia ${concurrency} · ${this.config.model} · ${this.impact ? 'Choice + Score' : 'Choice'}`);
    if (!batch) {
      // El recorrido manual imprime cada entrada inmediatamente antes de enviarla.
      const records: RunRecord[] = [];
      const started = performance.now();
      for (const report of reports) {
        showRequest(report, buildRequest(report, this.config.model, this.impact));
        const record = await processReport(report, this.config.model, this.impact, client);
        records.push(record);
        showResult(record);
      }
      const { summarize } = await import('../services/metrics.ts');
      const summary = summarize(records, performance.now() - started);
      this.last = records;
      const path = await saveRun(records, summary, 1);
      console.log(`\nRegistro: ${path}`);
      if (records.some(record => record.error)) process.exitCode = 1;
      if (records.length > 1) {
        console.table(records.map(record => ({ id: record.report.id, ruta: record.result?.answers.ruta.choice ?? 'error',
          impacto: record.result?.answers.impacto?.score ?? '—', destino: record.destination, ms: record.elapsedMs.toFixed(0), modelo: record.result?.model ?? '—' })));
      }
      return;
    }
    showRequest(reports[0], buildRequest(reports[0], this.config.model, this.impact));
    console.log('Primera solicitud mostrada arriba. El resto está en data/batch-100.json; preguntas y modelo son compartidos.');
    const { records, summary } = await runBatch(reports, concurrency,
      report => processReport(report, this.config.model, this.impact, client), showProgress);
    this.last = records;
    const path = await saveRun(records, summary, concurrency);
    showSummary(summary, concurrency);
    console.log(`Registro con todos los resultados: ${path}`);
    if (summary.failures) process.exitCode = 1;
  }

  async execute(tokens: string[], readline?: Interface): Promise<boolean> {
    const impactFlag = tokens.includes('--impacto');
    const args = tokens.filter(token => token !== '--impacto');
    if (impactFlag) this.impact = true;
    const [command = 'ayuda', ...rest] = args;
    switch (command) {
      case 'salir': return false;
      case 'ayuda': case '--help': showHelp(); break;
      case 'casos': showCases(this.manual); break;
      case 'preguntas': console.log(formatJson(buildRequest(this.manual[0], this.config.model, this.impact).questions)); break;
      case 'ver': {
        if (rest.length !== 1) throw new Error('Uso: ver 1');
        const report = this.find(rest[0]);
        showRequest(report, buildRequest(report, this.config.model, this.impact));
        break;
      }
      case 'impacto':
        if (rest.length !== 1 || !['si', 'no'].includes(rest[0])) throw new Error('Uso: impacto si | impacto no');
        this.impact = rest[0] === 'si';
        console.log(`Preguntas activas: ${this.impact ? 'Choice + Score' : 'Choice'}`);
        break;
      case 'enviar': {
        const ids = rest.flatMap(token => token.split(',')).filter(Boolean);
        if (!ids.length) throw new Error('Uso: enviar 1 2 3');
        await this.send(ids.map(id => this.find(id)), 1, false);
        break;
      }
      case 'comparar': await this.send([this.find('1'), this.find('2')], 1, false); break;
      case 'nuevo': {
        if (!readline) throw new Error('Usa npm start y el comando nuevo para escribir un reporte.');
        const message = (await readline.question('Mensaje del reporte: ')).trim();
        const context = (await readline.question('Contexto del proyecto: ')).trim();
        if (!message || !context) throw new Error('Mensaje y contexto deben tener contenido.');
        await this.send([{ id: `manual-${randomUUID()}`, message, context }], 1, false);
        break;
      }
      case 'datos': {
        const dataset = await loadDataset('batch-100');
        console.log(`${dataset.length} reportes sintéticos en data/batch-100.json. Muestra de los primeros cinco:`);
        showCases(dataset.slice(0, 5));
        break;
      }
      case 'lote': {
        let count = 100;
        let concurrency = 8;
        if (rest.some(token => token.startsWith('--'))) {
          if (rest.length % 2 !== 0) throw new Error('Uso: lote --cantidad 100 --concurrencia 8');
          for (let i = 0; i < rest.length; i += 2) {
            const flag = rest[i];
            if (!/^\d+$/.test(rest[i + 1])) throw new Error('Cantidad y concurrencia deben ser enteros positivos.');
            if (flag === '--cantidad') count = Number(rest[i + 1]);
            else if (flag === '--concurrencia') concurrency = Number(rest[i + 1]);
            else throw new Error(`Opción desconocida: ${flag}`);
          }
        } else {
          if (rest.length > 2 || rest.some(value => !/^\d+$/.test(value))) throw new Error('Uso: lote 100 8');
          count = Number(rest[0] ?? 100);
          concurrency = Number(rest[1] ?? 8);
        }
        if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Cantidad entre 1 y 100.');
        if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Concurrencia entre 1 y 32.');
        const dataset = await loadDataset('batch-100');
        await this.send(dataset.slice(0, count), concurrency, true);
        break;
      }
      case 'ultimo': console.log(this.last.length ? formatJson(this.last) : 'Todavía no hay una ejecución en esta sesión.'); break;
      default:
        if (/^[123]$/.test(command) && !rest.length) await this.send([this.find(command)], 1, false);
        else throw new Error('Comando desconocido. Escribe ayuda.');
    }
    return true;
  }
}
