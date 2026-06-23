import { GrokSessionUsage, Attribution, MetricsConfig, EfficiencyResult } from './types.js';

export function calculateEfficiency(
  usage: GrokSessionUsage,
  attr: Attribution | undefined,
  config: MetricsConfig
): EfficiencyResult {
  const hehsManual = attr?.hehsManual ?? 0;
  const hehsActual = attr?.hehsActual ?? 0;
  const hehsSaved = Math.max(0, hehsManual - hehsActual);

  // Cost estimation (very rough)
  let aiCostUsd = 0;
  const pricing = config.modelPricing;
  const fallback = pricing['default'] || { promptPerM: 2, completionPerM: 8 };

  // For now, split tokens evenly-ish or use total. Better: use totals and average price.
  // Simple: use default pricing on total tokens / 2 for rough prompt vs completion.
  const p = usage.total.promptTokens;
  const c = usage.total.completionTokens;
  const avgPromptPrice = pricing['grok-build']?.promptPerM ?? fallback.promptPerM;
  const avgCompPrice = pricing['grok-build']?.completionPerM ?? fallback.completionPerM;

  aiCostUsd = (p / 1_000_000) * avgPromptPrice + (c / 1_000_000) * avgCompPrice;

  // If specific models known we could weight, but this is MVP conservative
  const valueCreated = (hehsSaved * config.burdenedHourlyRate) - aiCostUsd;

  const tokensK = usage.totalTokens / 1000;
  const efficiency = tokensK > 0 ? (hehsSaved * config.burdenedHourlyRate) / tokensK : 0;

  const tokensPerHehs = hehsSaved > 0 ? usage.totalTokens / hehsSaved : 0;

  return {
    hehsSaved,
    aiCostUsd: Math.round(aiCostUsd * 10000) / 10000,
    valueCreated: Math.round(valueCreated * 100) / 100,
    efficiency: Math.round(efficiency * 100) / 100,
    tokensPerHehs: Math.round(tokensPerHehs),
  };
}

export function getQualityLabel(attr?: Attribution): string {
  if (!attr) return 'unattributed';
  if (!attr.outcome) return 'tagged';
  return attr.outcome;
}

export function filterQualityForCredit(attr?: Attribution): boolean {
  if (!attr) return false;
  const good = ['merged-clean', 'merged-rework'];
  return !!attr.outcome && good.includes(attr.outcome);
}
