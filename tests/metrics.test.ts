import { describe, it, expect } from 'vitest';
import { calculateEfficiency, filterQualityForCredit } from '../src/calculator.js';
import { GrokSessionUsage, Attribution, DEFAULT_CONFIG } from '../src/types.js';

const sampleUsage: GrokSessionUsage = {
  sid: 'test-sid-123',
  firstTs: '2026-06-01T00:00:00Z',
  lastTs: '2026-06-01T00:10:00Z',
  turnCount: 12,
  total: { promptTokens: 45000, completionTokens: 3200, reasoningTokens: 0 },
  models: ['grok-build'],
  cwds: ['/home/dustin/project'],
  totalTokens: 48200,
};

describe('calculator', () => {
  it('computes HEHS and efficiency correctly', () => {
    const attr: Attribution = {
      sid: sampleUsage.sid,
      task: 'Implement feature X',
      hehsManual: 5,
      hehsActual: 1.5,
      outcome: 'merged-clean',
      taggedAt: new Date().toISOString(),
    };

    const res = calculateEfficiency(sampleUsage, attr, DEFAULT_CONFIG);

    expect(res.hehsSaved).toBe(3.5);
    expect(res.efficiency).toBeGreaterThan(10); // (3.5 * 175) / (48200/1000) ≈ 12.7
    expect(res.valueCreated).toBeGreaterThan(0);
    expect(res.aiCostUsd).toBeGreaterThan(0);
  });

  it('returns zero saved when not attributed or no HEHS', () => {
    const res = calculateEfficiency(sampleUsage, undefined, DEFAULT_CONFIG);
    expect(res.hehsSaved).toBe(0);
  });

  it('quality gate only credits merged-clean and merged-rework', () => {
    const good: Attribution = { sid: 'x', task: 'y', outcome: 'merged-clean', taggedAt: 't' };
    const rework: Attribution = { sid: 'x', task: 'y', outcome: 'merged-rework', taggedAt: 't' };
    const bad: Attribution = { sid: 'x', task: 'y', outcome: 'reverted', taggedAt: 't' };

    expect(filterQualityForCredit(good)).toBe(true);
    expect(filterQualityForCredit(rework)).toBe(true);
    expect(filterQualityForCredit(bad)).toBe(false);
    expect(filterQualityForCredit(undefined)).toBe(false);
  });
});
