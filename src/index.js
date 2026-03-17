require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// ─── Routes ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/info', (req, res) => {
  res.json({
    message: 'Hello from the Tor-enabled Node.js server!',
    onion: process.env.ONION_ADDRESS || 'Not configured',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Start Server ───────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  Server is running on port ${PORT}`);
  console.log(`🌐  Local:     http://localhost:${PORT}`);
  if (process.env.ONION_ADDRESS) {
    console.log(`🧅  Onion URL: http://${process.env.ONION_ADDRESS}`);
  }
  console.log('\nPress Ctrl+C to stop.\n');
});
