# XIOM — Full Project Context

**Audience:** Claude / content assistants generating tweets, threads, replies, and investor-facing posts.  
**Rule:** Treat this document as ground truth. Prefer concrete product language over hype. Never invent shipped features that are not listed as live. When uncertain, say “in progress” or “coming.”

---

## 1. One-liner & positioning

| | |
|--|--|
| **Name** | XIOM |
| **Tagline** | Stop prompt-chasing. Own the control layer. |
| **Category** | Personal AI Operating System / constitutional governance layer for AI agents |
| **Not** | Another chatbot, another prompt pack, another wrapper UI |
| **Is** | Infrastructure that sits between you and any LLM/agent — memory, policy, audit, payments |

**Core claim:** Everyone has the same models. Advantage isn’t prompting — it’s owning context, rules, continuity, and control.

---

## 2. Problem XIOM solves

### The trap

- Same models as everyone → **0 moat**
- Prompts anyone can learn → **0 moat**
- Context stuck in your head / vendor UI → **lost on switch**
- Infinite loop: *Re-explain → Generate → Copy → Paste → Verify → Repeat*
- Costs: **time tax**, **attention tax**, **failure tax** (missed follow-ups, drift)

### What users don’t own today

1. **Context** — history lives in ChatGPT/Claude UI
2. **Rules** — “never spend >$500 without asking” isn’t enforceable across sessions
3. **Continuity** — session amnesia; re-brief every time
4. **Audit** — black-box decisions
5. **Control** — platform lock-in

### Product framing

> Assistants are an interface. **XIOM is infrastructure.**  
> AI agents do tasks. **XIOM governs outcomes.**

---

## 3. Solution — Four pillars

1. **Persistent Memory (World Model)**  
   Neo4j knowledge graph: goals, preferences, entities, relationships across sessions and agents.

2. **Policy Enforcement (Guardian)**  
   Constitutional pipeline intercepts agent actions — policy, scope, cost, privacy rules in real time.

3. **Cryptographic Receipts**  
   Tamper-evident records of AI decisions (anchored on-chain for auditability).

4. **x402 Payments**  
   Agent-native HTTP 402 micropayments. Current product direction: **USDG on Robinhood Chain** (chainId `4663`). Older docs may mention Base/USDC — prefer Robinhood Chain / USDG for public posts unless corrected.

**Sigma idea (marketing science):**  
`σ = P(h+XIOM) − max(P_h, P_AI)` — human + XIOM should outperform either alone before autonomy expands.

---

## 4. Agency levels (L1–L5) — differentiation

| Level | Name | What it is |
|-------|------|------------|
| L1 | Informational AI | Search / Q&A |
| L2 | Reactive AI | Chat assistants |
| L3 | Mixed-initiative | Alerts + suggestions |
| L4 | Delegated / Agentic | Tools, loops, task execution |
| **L5** | **Symbiotic AI** | **Persistent memory + policy update + audit + partnership** |

**XIOM’s claim:** Most of the market is racing to L4 agents. XIOM targets **L5** — symbiotic, governed, continuous.

**What XIOM addresses (6 gaps):**

1. **Initiative** — goal-triggered actions *within policy*
2. **Transparency** — Intent + Context + Policy → Action (auditable)
3. **Execution** — outcomes with verification
4. **Adaptation** — versioned policies + feedback
5. **Control** — local-first, exportable, authority tiers
6. **Continuity** — constitutional memory + drift detection

---

## 5. Product surfaces (what exists)

### A) Marketing site (HUD)

- **Live:** https://xiom-marketing.vercel.app/
- Immersive intro (typewriter → YES/NO) → dashboard with globe
- Sections: Intro, Problem, Product, Agency Levels, Science, Memory, Roadmap, Connect, Download Desktop, Privacy, Research
- CTAs: **Launch App**, **API Docs**, **Download Desktop**
- Docs: https://xiom-marketing.vercel.app/docs/ (Scalar OpenAPI UI)

### B) Launch App (onboarding / create agent)

- **Live:** https://xiom-ai-app.vercel.app/
- Wizard: path (new/existing) → AI provider → details → consent → submit
- Providers: Claude Code, Codex, Gemini, Grok, Custom
- After submit: intake status page with provisioning progress, checklist, pairing code, bootstrap command, CTAs (Desktop / Pair / Docs)
- **Note:** Full backend API persistence may still use demo/fallback when `api.xiom-ai.com` isn’t live; UX still completes for demos.

### C) Desktop (Tauri)

- Local MCP host, Neo4j management, pairs with AI provider
- Releases: GitHub `desktop-v*` — Windows `.exe`/`.msi`, macOS `.dmg`
- Direct download from marketing Download Desktop section
- Linux AppImage: not published yet

### D) API (Hono)

- Intended: `https://api.xiom-ai.com`
- Routes: health, intake, worldmodel, MCP, agent-access (x402), install scripts, OpenAPI `/docs`
- **Status:** designed & coded; production API hosting/DB still a launch dependency

### E) Smart contracts (Foundry)

- BidWall, AgentPassport, and related contracts
- Chain direction: **Robinhood Chain** (4663), USDG, Blockscout

---

## 6. Architecture

```
Claude / GPT / Codex / Gemini / any agent
        ↓ actions
XIOM Guardian (policy · scope · cost · privacy)
        ↓
World Model (Neo4j)  ·  Receipts (chain)  ·  MCP (JSON-RPC tools)
        ↓
PostgreSQL (users, receipts, rules, revenue)
```

**Monorepo:** https://github.com/xiomAI-core/Xiom-ai

```
apps/web, apps/app, apps/desktop, apps/api
packages: types, world-model, guardian, mcp-server, x402, blockchain, db
contracts/ (Solidity + Foundry)
```

**Local ports:** marketing `:3000`, API `:3001`, launch app `:3002`, desktop Tauri `:1420`

---

## 7. Use cases (tweet-friendly)

1. **Founder / operator** — agent that remembers goals, blockers, last decisions; won’t email investors without policy
2. **Engineer** — Claude Code / Codex with durable project memory + spend/scope guards
3. **Creator / solopreneur** — stop re-explaining brand voice and calendar constraints every session
4. **Power user** — local-first world model; export anytime; not locked to one chat UI
5. **Agent builders** — MCP + x402 access plans; governed tool execution
6. **Privacy-conscious** — local-first, no selling behavioral data, audit trail, sovereign export

---

## 8. Privacy commitments (safe to post)

- Local-first world model by default
- No selling/sharing behavioral data
- Full provenance on facts
- Revocable delete
- Audit trail of actions
- Sovereign JSON export (GDPR-style portability)

**Revenue model (stated):** subscriptions + x402 protocol fees — **not** ads on user data.

---

## 9. Competitive differentiation

| Them | XIOM |
|------|------|
| Better prompts / RAG chat | Control layer under any model |
| Another agent that “does tasks” | Governs *whether* and *how* tasks run |
| Memory as chat history | Constitutional World Model graph |
| Trust the vendor | Local-first + export + receipts |
| Subscription-only SaaS | Also agent-native x402 micropayments |
| L4 race | L5 symbiotic stack |

**Avoid:** claiming “we’re the only AI company” or “fully production API for everyone” if backend isn’t live yet.

---

## 10. Brand voice for X / Claude

**Tone:** Precise, confident, slightly technical, anti-hype. Short sentences. Prefer diagrams-in-words over buzzwords.

**Do:**

- Talk about *control, memory, policy, continuity, ownership*
- Contrast assistants vs infrastructure
- Use L4 vs L5 framing sparingly but clearly
- Point to live demos: marketing, launch app, docs, desktop downloads

**Don’t:**

- Overpromise AGI / “replaces you”
- Fake user counts or revenue
- Pretend custom domains (`xiom-ai.com`) are live if still on Vercel
- Attack competitors by name harshly — contrast categories instead

**Handles / links (current demo stack):**

- Marketing: https://xiom-marketing.vercel.app/
- App: https://xiom-ai-app.vercel.app/
- Docs: https://xiom-marketing.vercel.app/docs/
- GitHub: https://github.com/xiomAI-core/Xiom-ai
- Releases: https://github.com/xiomAI-core/Xiom-ai/releases
- Planned: `xiom-ai.com`, `app.xiom-ai.com`, `api.xiom-ai.com`

**Suggested X handle context:** `@xiom_ai` (as used on site)

---

## 11. Content pillars (what to post regularly)

1. **Problem** — prompt loop, no moat, session amnesia
2. **Thesis** — own the control layer
3. **L5 taxonomy** — why agents ≠ symbiotic OS
4. **Memory** — world model vs chat history
5. **Guardian** — policy before action
6. **Privacy / local-first**
7. **Build in public** — desktop releases, docs, HUD marketing, create-agent flow
8. **Science / axioms** — sigma gate, human+AI > either alone
9. **Chain / x402** — agent payments (label as protocol direction when not fully live)
10. **CTAs** — try marketing YES flow, create agent, download desktop

---

## 12. Example thread seeds (expand these)

1. “Everyone has the same AI. If your edge is prompting, you have no edge.”
2. “Assistants are an interface. XIOM is infrastructure.”
3. “L4 agents do tasks. L5 systems govern outcomes.”
4. “Your context shouldn’t live in someone else’s chat UI.”
5. “Stop re-explaining yourself every morning.”
6. “Policy that isn’t enforced is just a vibe.”
7. “We didn’t build another agent. We built the layer agents answer to.”

---

## 13. Honest ship status (keep posts accurate)

| Area | Status |
|------|--------|
| Marketing HUD | Live on Vercel |
| API docs (static Scalar) | Live on marketing `/docs` |
| Launch app + create-agent UX | Live; demo intake fallback if API down |
| Desktop installers | Published on GitHub Releases |
| Production API + DB | Not fully live for all users |
| Custom domains | Planned / not required for demos |
| Linux desktop | Coming soon |

---

## 14. Instructions for Claude when writing posts

1. Stay consistent with this context.
2. Prefer product truths over future tense unless labeled “roadmap.”
3. Include 0–2 links max per tweet; threads can deepen.
4. End some posts with a sharp question or CTA (try the YES flow / create agent).
5. For replies: educate with L4/L5 or “control layer” frame; don’t spam links.
6. If asked “is it live?” — yes for marketing, app, docs, desktop downloads; API backend still rolling out.

---

## 15. Repository map (for technical threads)

```
xiom/
├── apps/
│   ├── web/          # Marketing (HTML/CSS/JS HUD)
│   ├── app/          # Launch / create-agent (Next.js 15)
│   ├── desktop/      # Tauri 2 desktop (React + Rust)
│   └── api/          # Hono REST + MCP + OpenAPI
├── packages/
│   ├── types/
│   ├── world-model/  # Neo4j schema
│   ├── guardian/     # Constitutional enforcement
│   ├── mcp-server/   # MCP JSON-RPC tools
│   ├── x402/         # Micropayment helpers
│   ├── blockchain/   # Chain helpers + ABIs
│   └── db/           # PostgreSQL Drizzle schema
├── contracts/        # Foundry / Solidity
└── .github/workflows/
```

---

*Document generated for XIOM content & Claude context. Keep updated as ship status changes.*
