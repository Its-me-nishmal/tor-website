/**
 * tor-proxy.js  —  LOCAL USE ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Tor v3 hidden service from your local machine.
 * In Docker/production, Tor is managed by scripts/start.sh instead.
 *
 * Usage:  npm run tor
 *
 * Requirements:
 *   Windows → https://www.torproject.org/download/tor/  (Expert Bundle)
 *             set TOR_PATH=C:\path\to\tor.exe in .env if not on PATH
 *   Linux   → sudo apt install tor
 *   macOS   → brew install tor
 */

require('dotenv').config();
const { spawn } = require('child_process');
const net  = require('net');
const os   = require('os');
const fs   = require('fs');
const path = require('path');

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m',
  red: '\x1b[31m', magenta: '\x1b[35m',
};
const log  = (icon, col, msg) => console.log(`  ${col}${c.bold}${icon}${c.reset}  ${msg}`);
const info = (msg)             => console.log(`     ${c.dim}${msg}${c.reset}`);
const hr   = ()                => console.log(`  ${c.dim}${'─'.repeat(54)}${c.reset}`);

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_PORT      = parseInt(process.env.PORT             || '3000', 10);
const TOR_CTRL_PORT = parseInt(process.env.TOR_CONTROL_PORT || '9051', 10);
const TOR_BINARY    = process.env.TOR_PATH || 'tor';

// ─── Temp paths ───────────────────────────────────────────────────────────────
const dataDir   = path.join(os.tmpdir(), 'tor-hello-data');
const torrcPath = path.join(os.tmpdir(), 'tor-hello.torrc');

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log('');
hr();
log('🧅', c.magenta, `${c.bold}Tor Hidden Service${c.reset}  ${c.dim}(local mode)${c.reset}`);
info(`App port  :  ${APP_PORT}`);
hr();
console.log('');

// ─── Write temp torrc ─────────────────────────────────────────────────────────
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(torrcPath, [
  `ControlPort ${TOR_CTRL_PORT}`,
  'CookieAuthentication 0',
  `DataDirectory ${dataDir}`,
  'Log notice stdout',
  'SocksPort 0',
].join('\n'));

// ─── Spawn Tor ────────────────────────────────────────────────────────────────
log('⏳', c.yellow, 'Spawning Tor… (first run ~20 seconds)');
console.log('');

const torProc = spawn(TOR_BINARY, ['-f', torrcPath], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

torProc.on('error', () => {
  log('✖', c.red, '`tor` binary not found.');
  console.log('');
  info('Windows: download Tor Expert Bundle (not Tor Browser):');
  info('  https://www.torproject.org/download/tor/');
  info('  Extract then add to .env:  TOR_PATH=C:\\tor\\tor\\tor.exe');
  info('Linux  →  sudo apt install tor');
  info('macOS  →  brew install tor');
  console.log('');
  process.exit(1);
});

// ─── Wait for bootstrap, then create onion ───────────────────────────────────
let ready = false;
const checkBootstrap = (text) => {
  if (!ready && text.includes('Bootstrapped 100%')) {
    ready = true;
    log('✔', c.green, 'Tor bootstrapped!');
    console.log('');
    createOnion();
  }
};
torProc.stdout.on('data', (d) => checkBootstrap(d.toString()));
torProc.stderr.on('data', (d) => checkBootstrap(d.toString()));

// ─── Create hidden service via Tor control protocol ──────────────────────────
function createOnion() {
  let state = 'AUTH';
  let buf   = '';

  const sock = new net.Socket();
  sock.connect(TOR_CTRL_PORT, '127.0.0.1', () => {
    sock.write('AUTHENTICATE\r\n');
  });

  sock.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\r\n');
    buf = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const code = parseInt(line.slice(0, 3), 10);

      if (state === 'AUTH') {
        if (code === 250) {
          state = 'ADD_ONION';
          sock.write(`ADD_ONION NEW:ED25519-V3 Port=80,127.0.0.1:${APP_PORT}\r\n`);
        } else {
          log('✖', c.red, `Auth failed: ${line}`); process.exit(1);
        }

      } else if (state === 'ADD_ONION') {
        if (line.includes('ServiceID=')) {
          const id   = line.split('ServiceID=')[1].trim();
          const addr = `${id}.onion`;
          state = 'DONE';

          hr();
          log('🌐', c.cyan, `${c.bold}Onion link is live!${c.reset}`);
          console.log('');
          console.log(`     ${c.green}${c.bold}http://${addr}${c.reset}`);
          console.log('');
          info('Open in Tor Browser.');
          info('Link is ephemeral — changes on restart.');
          info('Press Ctrl+C to stop.');
          hr();
          console.log('');
          // Keep sock open — closing it destroys the hidden service

        } else if (code >= 500) {
          log('✖', c.red, `Failed: ${line}`); sock.destroy(); process.exit(1);
        }
      }
    }
  });

  sock.on('error', (err) => {
    log('✖', c.red, `Control socket error: ${err.message}`);
    process.exit(1);
  });
}

// ─── Cleanup on exit ──────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('');
  log('⏹', c.yellow, 'Shutting down…');
  torProc.kill();
  try { fs.unlinkSync(torrcPath); } catch {}
  log('✔', c.green, 'Done.');
  console.log('');
  process.exit(0);
});
