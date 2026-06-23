import { readFile } from 'fs/promises';
import { GrokSessionUsage, TokenBreakdown } from './types.js';

interface RawEvent {
  ts: string;
  msg: string;
  sid?: string;
  ctx?: Record<string, any>;
}

/**
 * Parse Grok unified.jsonl for per-sid token usage.
 * Aggregates prompt/completion/reasoning across all turns for a sid.
 * Collects models and cwds on a best-effort basis.
 */
export async function parseGrokLog(logPath: string): Promise<Map<string, GrokSessionUsage>> {
  const content = await readFile(logPath, 'utf8');
  const lines = content.trim().split('\n');

  const bySid = new Map<string, {
    firstTs: string;
    lastTs: string;
    turns: number;
    prompt: number;
    completion: number;
    reasoning: number;
    models: Set<string>;
    cwds: Set<string>;
  }>();

  const modelHints = new Map<string, string>(); // sid -> model

  for (const line of lines) {
    if (!line.trim()) continue;
    let evt: RawEvent;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }

    const sid = evt.sid;
    if (!sid) continue;

    const ctx = evt.ctx || {};
    const msg = evt.msg || '';
    const ts = evt.ts || '';

    // Token events
    if (msg === 'shell.turn.inference_done') {
      const rec = bySid.get(sid) || {
        firstTs: ts,
        lastTs: ts,
        turns: 0,
        prompt: 0,
        completion: 0,
        reasoning: 0,
        models: new Set<string>(),
        cwds: new Set<string>(),
      };

      rec.turns += 1;
      rec.prompt += Number(ctx.prompt_tokens || 0);
      rec.completion += Number(ctx.completion_tokens || 0);
      rec.reasoning += Number(ctx.reasoning_tokens || 0);

      if (ts < rec.firstTs) rec.firstTs = ts;
      if (ts > rec.lastTs) rec.lastTs = ts;

      if (ctx.cwd) rec.cwds.add(String(ctx.cwd));
      if (ctx.git_root) rec.cwds.add(String(ctx.git_root));

      bySid.set(sid, rec);
    }

    // Model resolution events (best effort)
    if (msg.includes('model resolved') || msg === 'model changed' || msg.includes('subagent model')) {
      const model = ctx.current_model_id || ctx.effective_model || ctx.model || ctx.child_model;
      if (model && typeof model === 'string') {
        modelHints.set(sid, model);
        const rec = bySid.get(sid);
        if (rec) rec.models.add(model);
      }
    }

    // Also harvest models from any ctx that has them (including build + inference)
    const anyModel = ctx.current_model_id || ctx.effective_model || ctx.model || ctx.child_model;
    if (anyModel && typeof anyModel === 'string') {
      const rec = bySid.get(sid);
      if (rec) rec.models.add(anyModel);
    }

    // Build request often precedes inference on same sid
    if (msg === 'shell.turn.build_request_done') {
      const m = ctx.current_model_id || ctx.effective_model || ctx.global_model_id;
      if (m && typeof m === 'string') {
        const rec = bySid.get(sid);
        if (rec) rec.models.add(m);
      }
    }

    if (ctx.cwd) {
      const rec = bySid.get(sid);
      if (rec) rec.cwds.add(String(ctx.cwd));
    }
  }

  // Convert to final shape
  const result = new Map<string, GrokSessionUsage>();
  for (const [sid, raw] of bySid.entries()) {
    const total: TokenBreakdown = {
      promptTokens: raw.prompt,
      completionTokens: raw.completion,
      reasoningTokens: raw.reasoning,
    };
    const totalTokens = raw.prompt + raw.completion + raw.reasoning;

    // Merge hints if better
    const modelsArr = Array.from(raw.models);
    if (modelHints.has(sid) && !modelsArr.includes(modelHints.get(sid)!)) {
      modelsArr.push(modelHints.get(sid)!);
    }

    result.set(sid, {
      sid,
      firstTs: raw.firstTs,
      lastTs: raw.lastTs,
      turnCount: raw.turns,
      total,
      models: modelsArr.length ? modelsArr : ['unknown'],
      cwds: Array.from(raw.cwds),
      totalTokens,
    });
  }

  return result;
}

export function mergeSessions(existing: Map<string, GrokSessionUsage>, fresh: Map<string, GrokSessionUsage>): Map<string, GrokSessionUsage> {
  const merged = new Map(existing);
  for (const [sid, usage] of fresh.entries()) {
    const prev = merged.get(sid);
    if (!prev) {
      merged.set(sid, usage);
    } else {
      // Sum (in case of partial previous ingest)
      const t = {
        promptTokens: prev.total.promptTokens + usage.total.promptTokens,
        completionTokens: prev.total.completionTokens + usage.total.completionTokens,
        reasoningTokens: prev.total.reasoningTokens + usage.total.reasoningTokens,
      };
      merged.set(sid, {
        ...usage,
        total: t,
        totalTokens: t.promptTokens + t.completionTokens + t.reasoningTokens,
        turnCount: Math.max(prev.turnCount, usage.turnCount),
        firstTs: prev.firstTs < usage.firstTs ? prev.firstTs : usage.firstTs,
        lastTs: prev.lastTs > usage.lastTs ? prev.lastTs : usage.lastTs,
        models: Array.from(new Set([...prev.models, ...usage.models])),
        cwds: Array.from(new Set([...prev.cwds, ...usage.cwds])),
      });
    }
  }
  return merged;
}
