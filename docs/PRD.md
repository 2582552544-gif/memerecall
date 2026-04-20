# MemeRecall PRD

## Product Thesis

Crypto loses memory.

Markets forget:

- which KOLs said buy and secretly sold
- which dead charts showed real revival before the crowd noticed
- which signals worked last time

MemeRecall builds that memory layer.

## Core Jobs

### Job 1

As a trader or operator, I want to inspect a KOL and quickly know whether their public claims match their on-chain behavior.

### Job 2

As a trader or operator, I want to inspect a token and know whether a rebound is credible revival or manipulated noise.

## MVP Outputs

- Trust Card
- Revival Timeline
- Evidence Ledger
- Alert Feed

## MVP Acceptance

- `GET /trust/:handle` returns score, factors, wallet mapping, and evidence
- `GET /revival/:contract` returns score, lifecycle stage, and timeline
- home dashboard renders summary cards and latest alerts
- KOL detail renders factor cards and evidence rows
- token detail renders revival factors and timeline
