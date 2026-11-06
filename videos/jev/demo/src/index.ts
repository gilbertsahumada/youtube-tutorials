import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadConfig } from './config.ts';
import { loadDataset } from './infra/datasets.ts';
import { Session } from './cli/session.ts';
import { showCases, showHelp } from './cli/output.ts';

async function main() {
  const config = loadConfig();
  const manual = await loadDataset('manual');
  const session = new Session(config, manual);
  const args = process.argv.slice(2);
  if (args.length) { await session.execute(args); return; }

  showHelp();
  showCases(manual);
  console.log(`Modelo solicitado: ${config.model}. Clave ${config.apiKey ? 'configurada' : 'pendiente: puedes inspeccionar datos y preguntas'}.`);
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      let line: string;
      try { line = await terminal.question('\njev> '); }
      catch { break; }
      const tokens = line.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) continue;
      try { if (!await session.execute(tokens, terminal)) break; }
      catch (error) { console.error((error as Error).message); }
    }
  } finally { terminal.close(); }
}

main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
