import { appendFileSync } from 'node:fs';
import path from 'node:path';

export type Event = { time: string; event: string; pid: number; [key: string]: unknown };
export type Emit = (event: string, data?: Record<string, unknown>) => void;
export function createEvents(directory: string): Emit {
  return (event, data = {}) => {
    const item: Event = { time: new Date().toISOString(), event, pid: process.pid, ...data };
    appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify(item) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(item));
  };
}
