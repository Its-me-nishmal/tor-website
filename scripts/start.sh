#!/bin/sh
# ─── Docker startup: Tor + Express + Onion service ────────────────────────────

set -e

DIM='\033[2m'
BOLD='\033[1m'
GREEN='\033[32m'
MAGENTA='\033[35m'
YELLOW='\033[33m'
RESET='\033[0m'

echo ""
echo "  ${DIM}──────────────────────────────────────────────────${RESET}"
echo "  ${MAGENTA}${BOLD}🧅  Tor Hello World${RESET}"
echo "  ${DIM}──────────────────────────────────────────────────${RESET}"
echo ""

# ── 1. Start Tor daemon ─────────────────────────────────────────────────────
echo "  ${YELLOW}⏳  Starting Tor daemon...${RESET}"
mkdir -p /tmp/tor-data
tor \
  --ControlPort 9051 \
  --CookieAuthentication 0 \
  --DataDirectory /tmp/tor-data \
  --Log "notice stdout" \
  --SocksPort 0 &
TOR_PID=$!

# ── 2. Start Express server ─────────────────────────────────────────────────
echo "  ${GREEN}⚡  Starting Express server on port ${PORT:-3000}...${RESET}"
node src/index.js &
SERVER_PID=$!

# ── 3. Run tor-proxy (connects once Tor is ready, prints .onion link) ────────
TOR_PRESTARTED=1 node src/tor-proxy.js &

# ── Keep container alive via Express process ─────────────────────────────────
wait $SERVER_PID
