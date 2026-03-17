require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store for the onion address (set by tor-proxy.js at runtime)
let onionAddress = null;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// ─── Routes ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Called internally by tor-proxy.js once the onion address is known
app.post('/internal/onion', (req, res) => {
  const { address } = req.body;
  if (address) {
    onionAddress = address;
    console.log(`\n🧅  Onion address registered: http://${onionAddress}\n`);
  }
  res.json({ ok: true });
});

app.get('/api/info', (req, res) => {
  res.json({
    message: 'Hello from the Tor-enabled Node.js server!',
    onion: onionAddress ? `http://${onionAddress}` : 'Connecting to Tor…',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Start Server ───────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  Server is running on port ${PORT}`);
  console.log(`🌐  Local:     http://localhost:${PORT}`);
  console.log('\nPress Ctrl+C to stop.\n');
});
