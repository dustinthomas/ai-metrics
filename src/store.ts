import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { StoredData, Attribution, GrokSessionUsage, MetricsConfig, DEFAULT_CONFIG } from './types.js';

const DEFAULT_DATA_PATH = `${process.env.HOME || process.env.USERPROFILE || '.'}/.ai-metrics/data.json`;

export async function loadData(customPath?: string): Promise<StoredData> {
  const path = customPath || DEFAULT_DATA_PATH;
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as StoredData;
    // Ensure config present
    if (!parsed.config) parsed.config = { ...DEFAULT_CONFIG };
    return parsed;
  } catch {
    // Fresh store
    return {
      sessions: {},
      attributions: {},
      lastIngested: null,
      config: { ...DEFAULT_CONFIG },
    };
  }
}

export async function saveData(data: StoredData, customPath?: string): Promise<void> {
  const path = customPath || DEFAULT_DATA_PATH;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
}

export function upsertSessions(data: StoredData, fresh: Map<string, GrokSessionUsage>): void {
  for (const [sid, usage] of fresh.entries()) {
    data.sessions[sid] = usage;
  }
}

export function setAttribution(data: StoredData, attr: Attribution): void {
  data.attributions[attr.sid] = attr;
}

export function getAttribution(data: StoredData, sid: string): Attribution | undefined {
  return data.attributions[sid];
}

export function updateConfig(data: StoredData, partial: Partial<MetricsConfig>): void {
  data.config = { ...data.config, ...partial };
}
