/**
 * Provider install scripts — curl | bash entrypoints for Claude / Codex / Gemini
 *
 * GET /install/claude
 * GET /install/codex
 * GET /install/gemini
 */
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import {
  installScriptUrl,
  publicAppUrl,
} from '../lib/public-urls.js';

export const installRoute = new Hono();

function pairingCode(): string {
  return randomBytes(4).toString('hex');
}

function bashHeader(provider: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "═══════════════════════════════════════════"
echo "  XIOM — Installing for ${provider}"
echo "═══════════════════════════════════════════"
echo ""
`;
}

function nodeCheck(): string {
  return `
# 1. Node.js >= 20
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not found. Install Node 20+ from https://nodejs.org"
  exit 1
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node.js $NODE_MAJOR detected — XIOM requires Node >= 20"
  exit 1
fi
echo "✓ Node.js $(node -v)"
`;
}

function neo4jCheck(): string {
  return `
# 2. Neo4j CE (optional — warn if unreachable)
NEO4J_OK=0
if command -v nc >/dev/null 2>&1; then
  if nc -z -w 2 127.0.0.1 7687 2>/dev/null; then NEO4J_OK=1; fi
elif command -v curl >/dev/null 2>&1; then
  if curl -sf --max-time 2 http://127.0.0.1:7474 >/dev/null 2>&1; then NEO4J_OK=1; fi
fi
if [ "$NEO4J_OK" -eq 1 ]; then
  echo "✓ Neo4j appears reachable on localhost"
else
  echo "⚠ Neo4j CE not detected on bolt://localhost:7687"
  echo "  Desktop app will start/manage Neo4j for you, or install Neo4j Community Edition."
fi
`;
}

function desktopInstructions(): string {
  return `
# 3. Desktop app
OS="$(uname -s 2>/dev/null || echo unknown)"
echo ""
echo "Download XIOM Desktop:"
case "$OS" in
  Darwin) echo "  → https://xiom-ai.com/download/macos" ;;
  Linux)  echo "  → https://xiom-ai.com/download/linux" ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT) echo "  → https://xiom-ai.com/download/windows" ;;
  *) echo "  → https://xiom-ai.com/download" ;;
esac
echo "  Or: open the XIOM desktop app if already installed (starts MCP on 127.0.0.1:54321)"
echo ""
`;
}

function writeConfigDir(): string {
  return `
# Config directory
XIOM_HOME="\${XIOM_HOME:-$HOME/xiom}"
mkdir -p "$XIOM_HOME"
CONFIG_PATH="$XIOM_HOME/mcp-config.json"
if [ ! -f "$CONFIG_PATH" ]; then
  cat > "$CONFIG_PATH" <<'EOF'
{
  "version": "1.0",
  "mcpServerUrl": "http://127.0.0.1:54321",
  "humanId": "auto-detect-from-passport",
  "authorityLevel": "supervised",
  "surfaceId": "desktop-chat"
}
EOF
  echo "✓ Wrote $CONFIG_PATH"
else
  echo "✓ Config exists at $CONFIG_PATH"
fi
`;
}

function pairFooter(code: string): string {
  const appBase = publicAppUrl();
  return `
# 5–6. Pairing
PAIRING_CODE="${code}"
PAIR_URL="${appBase}/pair?code=\${PAIRING_CODE}"
echo ""
echo "Pairing code: $PAIRING_CODE"
echo "Open: $PAIR_URL"
if command -v open >/dev/null 2>&1; then
  open "$PAIR_URL" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$PAIR_URL" 2>/dev/null || true
elif command -v start >/dev/null 2>&1; then
  start "$PAIR_URL" 2>/dev/null || true
fi
echo ""
echo "Done. Start XIOM Desktop, then reconnect your AI provider."
echo ""
`;
}

function claudeScript(code: string): string {
  return (
    bashHeader('Claude Code') +
    nodeCheck() +
    neo4jCheck() +
    desktopInstructions() +
    writeConfigDir() +
    `
# 4. Configure Claude Code MCP
CLAUDE_DIR="\${HOME}/.claude"
mkdir -p "$CLAUDE_DIR"
CLAUDE_CFG="$CLAUDE_DIR/mcp.json"
# Merge-friendly snippet — operators can also paste into Claude Desktop settings
python3 - <<'PY' 2>/dev/null || node - <<'NODE'
const fs = require('fs');
const path = require('path');
const home = process.env.HOME || process.env.USERPROFILE || '';
const cfgPath = path.join(home, '.claude', 'mcp.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers.xiom = {
  url: 'http://127.0.0.1:54321',
  transport: 'http'
};
fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log('✓ Claude MCP config →', cfgPath);
NODE
echo "  Tip: ensure Claude Code points at http://127.0.0.1:54321 (XIOM Desktop MCP)"
` +
    pairFooter(code)
  );
}

function codexScript(code: string): string {
  return (
    bashHeader('Codex CLI') +
    nodeCheck() +
    neo4jCheck() +
    desktopInstructions() +
    writeConfigDir() +
    `
# 4. Configure Codex MCP (stdio via xiom-mcp when published, else HTTP bridge)
CODEX_DIR="\${HOME}/.codex"
mkdir -p "$CODEX_DIR"
CODEX_CFG="$CODEX_DIR/config.toml"
if ! grep -q 'xiom' "$CODEX_CFG" 2>/dev/null; then
  cat >> "$CODEX_CFG" <<'EOF'

# XIOM MCP — constitutional world model
[mcp_servers.xiom]
command = "npx"
args = ["-y", "@xiom/mcp-server"]
EOF
  echo "✓ Appended XIOM MCP to $CODEX_CFG"
else
  echo "✓ Codex config already references xiom"
fi
echo "  Alternate: point Codex at http://127.0.0.1:54321 when Desktop is running"
` +
    pairFooter(code)
  );
}

function geminiScript(code: string): string {
  return (
    bashHeader('Gemini CLI') +
    nodeCheck() +
    neo4jCheck() +
    desktopInstructions() +
    writeConfigDir() +
    `
# 4. Configure Gemini CLI MCP
GEMINI_DIR="\${HOME}/.gemini"
mkdir -p "$GEMINI_DIR"
GEMINI_CFG="$GEMINI_DIR/settings.json"
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const home = process.env.HOME || process.env.USERPROFILE || '';
const cfgPath = path.join(home, '.gemini', 'settings.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers.xiom = { httpUrl: 'http://127.0.0.1:54321/mcp' };
fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log('✓ Gemini MCP config →', cfgPath);
NODE
` +
    pairFooter(code)
  );
}

installRoute.get('/claude', (c) => {
  const script = claudeScript(pairingCode());
  return c.text(script, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'inline; filename="install-xiom-claude.sh"',
  });
});

installRoute.get('/codex', (c) => {
  const script = codexScript(pairingCode());
  return c.text(script, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'inline; filename="install-xiom-codex.sh"',
  });
});

installRoute.get('/gemini', (c) => {
  const script = geminiScript(pairingCode());
  return c.text(script, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'inline; filename="install-xiom-gemini.sh"',
  });
});

installRoute.get('/', (c) =>
  c.json({
    ok: true,
    providers: ['claude', 'codex', 'gemini'],
    usage: {
      claude: `curl -fsSL ${installScriptUrl('claude')} | bash`,
      codex: `curl -fsSL ${installScriptUrl('codex')} | bash`,
      gemini: `curl -fsSL ${installScriptUrl('gemini')} | bash`,
    },
  })
);
