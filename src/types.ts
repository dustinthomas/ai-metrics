/**
 * Core types for AI Usage Metrics (Grok Build + future Claude Code focus)
 * Focused on agentic coding measurement: tokens, HEHS, efficiency, ROI.
 */

export interface TokenBreakdown {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
}

export interface GrokSessionUsage {
  sid: string;
  firstTs: string;
  lastTs: string;
  turnCount: number;
  total: TokenBreakdown;
  // Models observed for this sid (from associated events)
  models: string[];
  // Best effort cwd / project context
  cwds: string[];
  // Raw total tokens (prompt + completion) for quick calcs
  totalTokens: number;
}

export interface Attribution {
  sid: string;
  // Human description of the work
  task: string;
  // Linkage
  pr?: string;          // e.g. "owner/repo#123" or "PROJ-123"
  ticket?: string;
  feature?: string;
  // HEHS core
  hehsManual?: number;   // Estimated hours if done without AI
  hehsActual?: number;   // Actual human time (prompting + reviewing + iterating)
  // Quality gate
  outcome?: 'merged-clean' | 'merged-rework' | 'changes-requested' | 'reverted' | 'abandoned';
  // Notes
  notes?: string;
  taggedAt: string;
}

export interface MetricsConfig {
  burdenedHourlyRate: number; // e.g. 180 (fully loaded cost)
  // Rough $ per million tokens per model (user can override)
  modelPricing: Record<string, { promptPerM: number; completionPerM: number }>;
}

export const DEFAULT_CONFIG: MetricsConfig = {
  burdenedHourlyRate: 175,
  modelPricing: {
    'grok-build': { promptPerM: 3.0, completionPerM: 15.0 },
    'grok-composer-2.5-fast': { promptPerM: 0.5, completionPerM: 2.5 },
    'mercury-2': { promptPerM: 1.0, completionPerM: 4.0 },
    'default': { promptPerM: 2.0, completionPerM: 8.0 },
  },
};

export interface EfficiencyResult {
  hehsSaved: number;
  aiCostUsd: number;
  valueCreated: number;           // hehsSaved * rate - aiCost
  efficiency: number;             // (hehsSaved * rate) / (totalTokens / 1000)
  tokensPerHehs: number;          // totalTokens / hehsSaved (if >0)
}

export interface ReportRow {
  key: string; // pr, feature, or 'unattributed' or sid
  sessionCount: number;
  totalPrompt: number;
  totalCompletion: number;
  totalTokens: number;
  hehsManual: number;
  hehsActual: number;
  hehsSaved: number;
  estCostUsd: number;
  efficiency: number;
  quality: string;
}

export interface StoredData {
  sessions: Record<string, GrokSessionUsage>;
  attributions: Record<string, Attribution>;
  lastIngested: string | null;
  config: MetricsConfig;
}
