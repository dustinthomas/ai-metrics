# ai-metrics

Track real AI coding value.

Grok Build CLI first. Tokens (in/out), HEHS saved, efficiency = (HEHS × rate) / (tokens/1000), ROI.

## Install / Run

Use Docker (Node policy in many envs) or native.

See ai-metrics/README.md for full.

## Commands

ai-metrics ingest [log]
ai-metrics list [N]
ai-metrics tag <sid> --task "..." --hehs-manual X --hehs-actual Y --pr "ORG#123" --outcome merged-clean
ai-metrics report
ai-metrics template

Data: ~/.ai-metrics/data.json

## Why

Accurate hours. Incentives via personal metrics. Mgmt ROI justification.

Start easy: agentic coding. Expand later.