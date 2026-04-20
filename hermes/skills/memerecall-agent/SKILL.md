---
name: memerecall-agent
description: Orchestrate MemeRecall crypto agents through the local MemeRecall API. Use for KOL wallet analysis, Twitter rhythm/investment judgment, timeline evidence, token monitoring, and gene-library planning.
---

# MemeRecall Agent API Skill

Use the MemeRecall API as the source of truth.

Base URL:

```bash
${MEMERECALL_API_BASE:-http://localhost:4049}
```

## Available Agent Tools

List agents:

```bash
curl -s "${MEMERECALL_API_BASE:-http://localhost:4049}/agents"
```

Dispatch one agent:

```bash
curl -s "${MEMERECALL_API_BASE:-http://localhost:4049}/agents/dispatch" \
  -H 'content-type: application/json' \
  -d '{"agent":"social_investment","handle":"0xWilliam888"}'
```

Supported `agent` values:

- `kol_analysis`: GMGN wallet profile, holdings, PnL, style, and risk.
- `social_investment`: KOL Twitter/X signal rhythm vs wallet activity.
- `timeline`: raw evidence timeline.
- `token_watch`: selected-token price monitor and Telegram notification cycle.

## Decision Rules

- Use `social_investment` when the question is whether a KOL's calls are investable.
- Use `kol_analysis` when the question is wallet quality, PnL, style, or risk.
- Use `timeline` when the user asks for raw evidence or debugging.
- Keep token price monitoring independent from KOL analysis.
- Use `token_watch` for Telegram notify cycles. It runs the selected token watchlist and sends Telegram cards when price movement exceeds the configured threshold.
- Save useful repeated patterns into the gene library once implemented.

Run token watch through Hermes/API:

```bash
curl -s "${MEMERECALL_API_BASE:-http://localhost:4049}/agents/dispatch" \
  -H 'content-type: application/json' \
  -d '{"agent":"token_watch","dryRun":true}'
```

Add a token to watch:

```bash
curl -s "${MEMERECALL_API_BASE:-http://localhost:4049}/watchlist/add" \
  -H 'content-type: application/json' \
  -d '{"chain":"sol","address":"TOKEN_ADDRESS","thresholdPct":20,"cooldownMinutes":30}'
```

## Output Style

Return concise Chinese conclusions with evidence:

- 结论
- 证据
- 风险
- 下一步动作
