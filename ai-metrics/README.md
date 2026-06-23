# ai-metrics (Grok-first)

Lightweight application to measure real-world impact of agentic AI coding tools (starting with Grok Build CLI).

## Goals
1. Accurate translation of AI tokens/sessions into Human-Equivalent Hours Saved (HEHS).
2. Personal metrics to incentivize effective + efficient AI usage.
3. Management justification via ROI, cost vs. value, trends.

Start with the easily instrumented case: **agentic coding** (Grok sessions → tokens in/out → attributions → HEHS).

Later: broader AI use cases, Claude Code ingestion, OTel streams, team aggregation.

## Quick Start (in this repo)

Requires Docker for Node/TS (per workspace policy).

```bash
# 1. Ingest token usage from your Grok logs
docker run --rm -v $(pwd):/app -v /app/node_modules -v $HOME/.grok:/root/.grok:ro grok-benchmark \
  node dist/src/cli.js ingest

# 2. See recent sessions
docker run --rm ... node dist/src/cli.js list 20

# 3. After finishing + merging a PR, tag it
docker run ... node dist/src/cli.js tag <full-sid> \
  --task "Add X feature" \
  --hehs-manual 4.0 \
  --hehs-actual 1.25 \
  --pr "myorg/repo#87" \
  --outcome merged-clean

# 4. View impact
docker run ... node dist/src/cli.js report

# PR / commit template
node dist/src/cli.js template   # or docker equiv
```

Data file: `~/.ai-metrics/data.json` (JSON, portable, easy to ETL into Postgres/Julia later).

## Core Metrics
- **Tokens**: prompt + completion (+ reasoning when present) from `~/.grok/logs/unified.jsonl` (shell.turn.inference_done events)
- **HEHS saved** = manual estimate − actual human time
- **Efficiency** = (HEHS × burdened hourly rate) / (totalTokens / 1000)
- **Value** = (HEHS × rate) − approx AI cost
- Quality gate: only credit `merged-clean` / `merged-rework`

See the long user prompt (this conversation start) for full formulas and rollout advice.

## Extending
- Claude Code: add importers for Admin Analytics API exports or CSV.
- OTel: add receiver for `grok` OTel metrics when enabled.
- Team mode: central Postgres + ingestion endpoint or shared file + sync.
- UI: simple web dashboard (Julia? or add later).
- Auto attribution hints: git branch, last commit message, session cwd matching open PRs.

## Files
- src/types.ts, parser.ts (Grok log), store.ts (json file), calculator.ts, cli.ts
- tests/metrics.test.ts
- Run: `docker run ... npm test`, `npm run typecheck` (inside docker)

This is the concrete starting implementation derived directly from the provided measurement breakdown.
