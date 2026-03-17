#!/bin/sh
# ─── Docker startup: Tor (HiddenService) + Express ────────────────────────────

PORT=${PORT:-3000}
TOR_DATA=/tmp/tor-data
HS_DIR=/tmp/tor-hidden-service

# ── Directories ────────────────────────────────────────────────────────────────
mkdir -p "$TOR_DATA" "$HS_DIR"
chmod 700 "$HS_DIR"

# ── Write torrc ────────────────────────────────────────────────────────────────
cat > /tmp/torrc << EOF
DataDirectory $TOR_DATA
HiddenServiceDir $HS_DIR
HiddenServicePort 80 127.0.0.1:$PORT
Log notice stdout
SocksPort 0
RunAsDaemon 0
EOF

echo ""
echo "  ────────────────────────────────────────────────────"
echo "  🧅  Tor Hello World — Docker"
echo "  ────────────────────────────────────────────────────"
echo ""

# ── Start Express ──────────────────────────────────────────────────────────────
echo "  ⚡  Starting Express on port $PORT..."
node src/index.js &
SERVER_PID=$!

# ── Start Tor ──────────────────────────────────────────────────────────────────
echo "  ⏳  Starting Tor..."
tor -f /tmp/torrc &

# ── Wait for Tor to write the hostname file ────────────────────────────────────
echo "  ⌛  Waiting for onion address (up to 60s)..."
i=0
while [ ! -f "$HS_DIR/hostname" ]; do
  sleep 1
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "  ✖  Timeout — Tor did not produce a hostname."
    exit 1
  fi
done

ONION=$(cat "$HS_DIR/hostname")

echo ""
echo "  ────────────────────────────────────────────────────"
echo "  🌐  Onion link is live!"
echo ""
echo "      http://$ONION"
echo ""
echo "  ────────────────────────────────────────────────────"
echo ""

# ── Register with Express so /api/info shows the address ──────────────────────
sleep 2   # give Express a moment to be fully up
node -e "
const http = require('http');
const body = JSON.stringify({ address: '$ONION' });
const req = http.request({
  host: '127.0.0.1', port: $PORT,
  path: '/internal/onion', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, () => { console.log('  ✔  Onion address registered with Express'); });
req.on('error', () => {});
req.write(body);
req.end();
"

# ── Keep container alive ───────────────────────────────────────────────────────
wait $SERVER_PID
