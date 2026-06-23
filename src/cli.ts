#!/usr/bin/env node
/**
 * ai-metrics — Lightweight measurement tool for AI agentic coding usage.
 * Primary focus: Grok Build CLI token tracking + HEHS + efficiency/ROI.
 *
 * Start with easily measured agentic coding, then expand.
 */

import { parseGrokLog, mergeSessions } from './parser.js';
import { loadData, saveData, upsertSessions, setAttribution, getAttribution, updateConfig } from './store.js';
import { calculateEfficiency, getQualityLabel, filterQualityForCredit } from './calculator.js';
import { Attribution, GrokSessionUsage, DEFAULT_CONFIG } from './types.js';
import { resolve } from 'path';
import { homedir } from 'os';

const DEFAULT_LOG = `${homedir()}/.grok/logs/unified.jsonl`;

function formatTokens(n: number): string {
  return n.toLocaleString();
}

function printSessionRow(s: GrokSessionUsage, attr?: Attribution) {
  const eff = calculateEfficiency(s, attr, DEFAULT_CONFIG); // use default for preview
  console.log(
    `${s.sid.slice(0, 12)}...  ` +
    `turns=${s.turnCount}  ` +
    `tokens=${formatTokens(s.totalTokens)} (p=${formatTokens(s.total.promptTokens)} c=${formatTokens(s.total.completionTokens)})  ` +
    `models=${s.models.join(',')}  ` +
    (attr ? `task="${attr.task}" hehsSaved=${eff.hehsSaved.toFixed(1)} eff=${eff.efficiency}` : 'unattributed')
  );
}

async function cmdIngest(logPathArg?: string) {
  const logPath = logPathArg || DEFAULT_LOG;
  console.log(`Ingesting from ${logPath} ...`);
  const fresh = await parseGrokLog(logPath);
  const data = await loadData();
  const before = Object.keys(data.sessions).length;
  upsertSessions(data, fresh);
  data.lastIngested = new Date().toISOString();
  await saveData(data);
  const after = Object.keys(data.sessions).length;
  console.log(`Ingest complete. Sessions before=${before} now=${after} (added ${after - before}).`);
}

async function cmdList(limit = 20) {
  const data = await loadData();
  const entries = Object.values(data.sessions)
    .sort((a, b) => b.lastTs.localeCompare(a.lastTs))
    .slice(0, limit);

  console.log(`\nRecent sessions (showing ${entries.length}):\n`);
  for (const s of entries) {
    const attr = getAttribution(data, s.sid);
    printSessionRow(s, attr);
  }
  console.log('\nUse: ai-metrics tag <sid> --task "..." --hehs-manual 4 --hehs-actual 1.5 --pr "PROJ-42"');
}

async function cmdTag(args: string[]) {
  // Very simple argv parsing: ai-metrics tag <sid> --task "foo" --hehs-manual 3.5 --hehs-actual 1.25 --pr "foo#123" --outcome "merged-clean"
  const sid = args[0];
  if (!sid) {
    console.error('Usage: ai-metrics tag <sid> --task "..." [--hehs-manual N] [--hehs-actual N] [--pr PR] [--outcome merged-clean|...]');
    process.exit(1);
  }

  const data = await loadData();
  const usage = data.sessions[sid];
  if (!usage) {
    console.error(`Unknown sid ${sid}. Run ingest first or use full sid.`);
    process.exit(1);
  }

  const attr: Attribution = getAttribution(data, sid) || {
    sid,
    task: '',
    taggedAt: new Date().toISOString(),
  };

  // crude parser
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--task' || a === '-t') attr.task = args[++i] || attr.task;
    if (a === '--hehs-manual' || a === '--manual') attr.hehsManual = parseFloat(args[++i]);
    if (a === '--hehs-actual' || a === '--actual') attr.hehsActual = parseFloat(args[++i]);
    if (a === '--pr') attr.pr = args[++i];
    if (a === '--ticket') attr.ticket = args[++i];
    if (a === '--feature') attr.feature = args[++i];
    if (a === '--outcome' || a === '--quality') attr.outcome = args[++i] as any;
    if (a === '--notes') attr.notes = args[++i];
  }

  if (!attr.task) {
    console.error('task is required (use --task "description")');
    process.exit(1);
  }

  setAttribution(data, attr);
  await saveData(data);

  const eff = calculateEfficiency(usage, attr, data.config);
  console.log('Tagged successfully:');
  console.log(JSON.stringify({ ...attr, efficiency: eff }, null, 2));
}

async function cmdReport() {
  const data = await loadData();
  const sessions = Object.values(data.sessions);
  const attributions = data.attributions;

  let totalTokens = 0;
  let totalHehsSaved = 0;
  let creditedValue = 0;
  const byKey: Record<string, { tokens: number; saved: number; cost: number; count: number; quality: string }> = {};

  for (const s of sessions) {
    totalTokens += s.totalTokens;
    const attr = attributions[s.sid];
    const eff = calculateEfficiency(s, attr, data.config);

    const key = attr?.pr || attr?.feature || attr?.ticket || (attr ? 'tagged' : 'unattributed');
    if (!byKey[key]) byKey[key] = { tokens: 0, saved: 0, cost: 0, count: 0, quality: getQualityLabel(attr) };

    byKey[key].tokens += s.totalTokens;
    byKey[key].saved += eff.hehsSaved;
    byKey[key].cost += eff.aiCostUsd;
    byKey[key].count += 1;

    if (filterQualityForCredit(attr)) {
      creditedValue += eff.valueCreated;
      totalHehsSaved += eff.hehsSaved;
    }
  }

  console.log('\n=== AI Coding Impact Report (Grok) ===');
  console.log(`Total tracked tokens: ${formatTokens(totalTokens)}`);
  console.log(`Qualified HEHS saved: ${totalHehsSaved.toFixed(1)} hours`);
  console.log(`Est. value created (qualified): $${creditedValue.toFixed(2)} @ $${data.config.burdenedHourlyRate}/hr`);

  console.log('\nBreakdown by key (PR / feature / tagged):');
  const rows = Object.entries(byKey).map(([k, v]) => ({
    key: k,
    sessions: v.count,
    tokens: formatTokens(v.tokens),
    hehsSaved: v.saved.toFixed(1),
    cost: '$' + v.cost.toFixed(2),
    eff: v.tokens > 0 ? ((v.saved * data.config.burdenedHourlyRate) / (v.tokens / 1000)).toFixed(1) : '0',
  }));

  console.table(rows);

  console.log('\nTips:');
  console.log('- Only "merged-clean" and "merged-rework" outcomes contribute to credited value.');
  console.log('- Tag sessions after merge for accurate personal + management reporting.');
}

async function cmdConfig(args: string[]) {
  const data = await loadData();
  if (args.length === 0) {
    console.log('Current config:');
    console.dir(data.config);
    console.log('\nUpdate with: ai-metrics config --rate 200');
    return;
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rate' || args[i] === '--burdened-rate') {
      const rate = parseFloat(args[++i]);
      updateConfig(data, { burdenedHourlyRate: rate });
    }
  }
  await saveData(data);
  console.log('Updated. New config:');
  console.dir(data.config);
}

async function cmdTemplate() {
  console.log(`
PR / Commit tagging template (copy into PR description or commit):

AI-assisted: Grok Build | Session: <paste sid or link to dashboard/export>
Ticket: PROJ-123
Est. manual time: 4.0h
Actual human time: 1.25h   # prompting + careful review + iterations
Outcome: merged-clean
Notes: Used plan mode + 2 subagents. Good first pass on API layer.

(After merge, run: ai-metrics tag <sid> --task "..." --hehs-manual 4 --hehs-actual 1.25 --pr "PROJ-123" --outcome merged-clean)
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'help';

  try {
    switch (cmd) {
      case 'ingest':
        await cmdIngest(argv[1]);
        break;
      case 'list':
      case 'sessions':
        await cmdList(parseInt(argv[1] || '20', 10));
        break;
      case 'tag':
        await cmdTag(argv.slice(1));
        break;
      case 'report':
        await cmdReport();
        break;
      case 'config':
        await cmdConfig(argv.slice(1));
        break;
      case 'template':
      case 'tag-template':
        cmdTemplate();
        break;
      case 'help':
      default:
        console.log(`
ai-metrics — Measure Grok Build (and soon Claude Code) agentic coding impact

Commands:
  ingest [log-path]          Parse ~/.grok/logs/unified.jsonl and store token usage
  list [N]                   Show recent N sessions + attribution status
  tag <sid> --task "..."     Record HEHS + linkage (see --help in tag)
  report                     Show HEHS, tokens, efficiency, value created
  config --rate 200          Set burdened hourly rate
  template                   Print recommended PR tagging text

Examples:
  ai-metrics ingest
  ai-metrics list 30
  ai-metrics tag 019ef2... --task "Add metrics to particle UI" --hehs-manual 3 --hehs-actual 0.75 --pr "acme/app#87" --outcome merged-clean
  ai-metrics report

Data lives in ~/.ai-metrics/data.json
Start here for accurate real-world AI hours, personal incentives, and management ROI.
`);
    }
  } catch (e: any) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
}

main();
