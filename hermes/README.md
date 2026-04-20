# MemeRecall Hermes Deployment

This directory deploys Hermes Agent as the orchestration layer for MemeRecall.

Hermes source is vendored into this project at:

```text
vendor/hermes-agent
```

MemeRecall exposes its own agents through API routes:

```text
GET  http://localhost:4049/agents
POST http://localhost:4049/agents/dispatch
```

Hermes should call these routes as API tools instead of reimplementing crypto logic inside Hermes.

## Start

```bash
bun run hermes:setup
bun run hermes:chat
```

`hermes:setup` installs from `vendor/hermes-agent` into the project-local `.hermes/venv`.

## Telegram Notify

1. Set Telegram credentials in `.hermes/.env`:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_HOME_CHANNEL=...
MEMERECALL_NOTIFY_DRY_RUN=false
```

2. Test a Telegram card:

```bash
bun run watch:test-telegram -- TEST --send
```

3. Create the Hermes cron job:

```bash
bun run hermes:cron:watch
```

4. Check jobs:

```bash
HERMES_HOME=.hermes .hermes/venv/bin/hermes cron list
```

## Dispatch Examples

```bash
curl -s http://localhost:4049/agents

curl -s http://localhost:4049/agents/dispatch \
  -H 'content-type: application/json' \
  -d '{"agent":"social_investment","handle":"0xWilliam888"}'
```

## Agent Boundaries

- `kol_analysis`: GMGN wallet and holdings analysis.
- `social_investment`: KOL Twitter rhythm vs wallet behavior.
- `timeline`: raw evidence timeline.

Token price monitoring and Telegram notifications should be exposed as another API agent when that module is complete.
