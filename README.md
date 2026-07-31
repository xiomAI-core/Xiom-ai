# XIOM — Your Personal AI Operating System

> **Stop prompt-chasing. Own the control layer.**

XIOM is a constitutional governance layer for personal AI — featuring persistent memory,
real-time policy enforcement, auditable cryptographic receipts, and Base L2 blockchain payments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude / GPT / Any LLM                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ agent actions
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  XIOM Guardian Pipeline                         │
│            Policy · Scope · Cost · Privacy Rules               │
└────────┬────────────────────────────────────────────────────────┘
         │
    ┌────▼────┐      ┌──────────────┐      ┌─────────────────┐
    │  World  │      │   Receipts   │      │   MCP Server    │
    │  Model  │      │   Base L2    │      │   JSON-RPC      │
    │  Neo4j  │      │  Anchored    │      │   Tools API     │
    └─────────┘      └──────────────┘      └─────────────────┘
         │
    ┌────▼──────────────────────────────────────────────────────┐
    │               PostgreSQL (Drizzle ORM)                    │
    │          Users · Receipts · Rules · Revenue               │
    └───────────────────────────────────────────────────────────┘
```

### Four Pillars

| Pillar | Description |
|---|---|
| **Persistent Memory** | Neo4j world model stores context, preferences, and relationships across all sessions and agents |
| **Policy Enforcement** | Guardian pipeline intercepts every agent action, evaluating constitutional rules in real-time |
| **Cryptographic Receipts** | Every AI decision produces a tamper-proof receipt anchored on Base L2 |
| **x402 Payments** | Agent-native HTTP 402 micropayments with USDC on Base — no subscription lock-in |

---

## Repository Structure

```
xiom/
├── apps/
│   ├── web/          # Marketing website (odei.ai-inspired, pure HTML/CSS/JS)
│   ├── app/          # app.xiom-ai.com — Next.js 15 App Router dashboard
│   ├── desktop/      # Tauri 2.x desktop application (React + Rust)
│   └── api/          # api.xiom-ai.com — Hono.js REST API
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── world-model/  # Neo4j schema, Cypher helpers
│   ├── guardian/     # Constitutional enforcement pipeline
│   ├── mcp-server/   # MCP JSON-RPC tool definitions
│   ├── x402/         # x402 USDC payment protocol helpers
│   ├── blockchain/   # viem/wagmi Base L2 helpers + ABIs
│   └── db/           # PostgreSQL Drizzle ORM schema + migrations
├── contracts/        # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── BidWall.sol
│   │   ├── AgentPassport.sol
│   │   └── interfaces/
│   └── test/
├── .github/workflows/ # CI/CD pipelines
└── scripts/           # Utility scripts
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 22 | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Neo4j Community | 5.x | [neo4j.com/download](https://neo4j.com/download/) |
| PostgreSQL | 16+ | [postgresql.org](https://www.postgresql.org/download/) |
| Rust | stable | [rustup.rs](https://rustup.rs) |
| Foundry | nightly | `curl -L https://foundry.paradigm.xyz \| bash` |
| Tauri CLI | 2.x | `cargo install tauri-cli --version "^2"` |

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/xiom-ai/xiom.git
cd xiom
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Start all services in development

```bash
# Marketing + launch app + API (recommended for local work)
pnpm dev:all
```

Or start every workspace (including packages):

```bash
pnpm dev
```

On first run, if workspace packages fail to resolve, build once:

```bash
pnpm build
```

### 5. Open the apps

| App | URL |
|---|---|
| Marketing | http://localhost:3000 |
| Dashboard | http://localhost:3002 |
| API | http://localhost:3001 |
| Desktop | `pnpm desktop` or `pnpm tauri dev` (from `apps/desktop/`) |

---

## Package Scripts

| Command | Description |
|---|---|
| `pnpm dev:all` | Start marketing (`:3000`), launch app (`:3002`), and API (`:3001`) |
| `pnpm dev` | Start all apps in parallel (Turborepo) |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run all test suites |
| `pnpm lint` | Lint all workspaces |
| `pnpm type-check` | TypeScript check across all workspaces |
| `pnpm clean` | Remove all build artifacts |

---

## Database Setup

### PostgreSQL

```bash
createdb xiom
pnpm --filter @xiom/db db:push
```

### Neo4j

Start Neo4j Community Edition and set the bolt URL in `.env`.
The world model schema is applied automatically on first API startup.

---

## Smart Contracts

```bash
cd contracts
forge build
forge test -vvv
forge test --gas-report

# Deploy to Base (set XIOM_SIGNER_PRIVATE_KEY in .env)
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

---

## Desktop App

```bash
cd apps/desktop
pnpm tauri dev        # Development
pnpm tauri build      # Production build
```

Requires: Rust stable, platform WebView (WebKit2GTK on Linux, WebView2 on Windows).

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service health check |
| GET | `/token/info` | $XIOM token metadata |
| POST | `/api/intake` | User onboarding |
| GET | `/api/worldmodel` | World model graph |
| POST | `/api/mcp/v1` | MCP JSON-RPC endpoint |
| POST | `/api/v2/guardrail/enforce` | Policy enforcement |
| GET | `/api/v2/memory` | Persistent memories |
| GET | `/.well-known/x402.json` | x402 payment info |
| GET | `/.well-known/agent.json` | Agent discovery |

---

## $XIOM Token

The XIOM utility token powers the ecosystem:

- **Governance** — vote on constitutional policy templates and protocol upgrades
- **Staking** — stake to unlock higher Guardian policy tiers and reduced fees
- **Revenue Share** — protocol revenue distributed to stakers via BidWall
- **Agent Access** — pay for premium MCP tools and cross-agent capabilities

**Contract:** Base Mainnet · USDC payments · x402 protocol

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feat/my-feature`
5. Open a Pull Request against `main`

Please ensure:
- `pnpm lint` passes
- `pnpm type-check` passes
- `forge test` passes (for contract changes)
- New features include tests

---

## License

MIT © 2026 XIOM

---

*Built with ❤️ on Base L2 · Governed by constitution, not prompt.*
