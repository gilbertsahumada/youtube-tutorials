import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolResultEntry, type Conversation, type Cursor, type EntryRecord } from '@earendil-works/pi-durable';
import type { App, SessionConfig } from './harness.ts';
import { context } from './harness.ts';
import { RESEARCH_TASK, messageText } from './research.ts';
import { TOPICS, type Topic } from './fixtures.ts';
import type { Event } from './events.ts';

export async function allEntries(chat: Conversation) {
  const result: EntryRecord[] = [];
  let cursor: Cursor | undefined;
  do {
    const page = await chat.entries({ order: 'ascending' }, 500, cursor, context);
    result.push(...page.items); cursor = page.next;
  } while (cursor !== undefined);
  return result;
}

export async function researchState(app: App) {
  const tasks = await app.harness.commit(tx => tx.scanTasks({ conversationId: app.root.id }, 1000), context);
  const research = tasks.items.find(t => t.kind === RESEARCH_TASK);
  const children = research ? await app.harness.commit(tx => tx.scanConversations({ ownerTaskId: research.id }, 100), context) : undefined;
  const child = children?.items[0] ? await app.harness.conversation(children.items[0].id, context) : undefined;
  return { research, child, childCount: children?.items.length ?? 0 };
}

export async function readEvents(directory: string): Promise<Event[]> {
  const content = await fs.readFile(path.join(directory, 'events.jsonl'), 'utf8').catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return ''; throw e;
  });
  return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Event);
}

export async function status(app: App, directory: string, config: SessionConfig) {
  const { research, child, childCount } = await researchState(app);
  const mainEntries = await allEntries(app.root);
  const childEntries = child ? await allEntries(child) : [];
  const topicByCall = new Map<string, Topic>();
  for (const entry of childEntries) {
    for (const message of entry.model ?? []) {
      if (message.role !== 'assistant') continue;
      for (const part of message.content) {
        if (part.type === 'toolCall' && part.name === 'search' && TOPICS.includes(part.arguments.topic as Topic)) {
          topicByCall.set(part.id, part.arguments.topic as Topic);
        }
      }
    }
  }
  const confirmed = new Set<Topic>();
  for (const entry of childEntries.filter(ToolResultEntry.is)) {
    for (const message of entry.model ?? []) {
      if (message.role === 'toolResult' && !message.isError) {
        const topic = topicByCall.get(message.toolCallId); if (topic) confirmed.add(topic);
      }
    }
  }
  const events = await readEvents(directory);
  const reportEntries = mainEntries.filter(e => e.kind === 'pi.user' && e.model?.some(m => messageText(m).startsWith('[research report]')));
  const reportId = reportEntries[0]?.id;
  return {
    pid: process.pid, provider: config.provider, model: config.model,
    rootId: app.root.id, childId: child?.id ?? null, childCount,
    researchTaskId: research?.id ?? null, researchStatus: research?.state.status ?? null,
    confirmedTopics: TOPICS.filter(t => confirmed.has(t)), gateOpen: app.gate.isOpen(),
    attempts: Object.fromEntries(TOPICS.map(topic => [topic, events.filter(e => e.event === 'tool_enter' && e.topic === topic).length])),
    reportCount: reportEntries.length,
    answersAfterReport: reportId === undefined ? [] : mainEntries.filter(e => e.id > reportId && e.kind === 'pi.assistant')
      .flatMap(e => (e.model ?? []).filter(m => m.role === 'assistant' && m.content.some(p => p.type === 'text')).map(messageText)),
    entries: [...mainEntries.map(e => ({ conversation: 'principal', entry: e })), ...childEntries.map(e => ({ conversation: 'investigador', entry: e }))],
  };
}
