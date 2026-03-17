/**
 * tor-proxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Tor v3 hidden service and prints the .onion link.
 * Zero external dependencies — uses only Node built-ins.
 *
 * Two modes:
 *
 *   🐳 Docker mode (TOR_PRESTARTED=1):
 *      Tor is already running (started by scripts/start.sh).
 *      This script polls the control port until ready, then creates the service.
 *      Used automatically by the Docker container.
 *
 *   💻 Local mode (default):
 *      Spawns the `tor` binary itself, waits for bootstrap, then creates service.
 *      Usage:  npm run tor
 *      Requirements:
 *        Windows → https://www.torproject.org/download/tor/ (Expert Bundle)
 *                  Set TOR_PATH=C:\path\to\tor.exe in .env if not in PATH
 *        Linux   → sudo apt install tor
 *        macOS   → brew install tor
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
const DOCKER_MODE   = process.env.TOR_PRESTARTED === '1';

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log('');
hr();
log('🧅', c.magenta, `${c.bold}Tor Hidden Service${c.reset}  ${c.dim}(${DOCKER_MODE ? 'docker' : 'local'} mode)${c.reset}`);
info(`App port  :  ${APP_PORT}`);
info(`Tor ctrl  :  127.0.0.1:${TOR_CTRL_PORT}`);
hr();
console.log('');

// ─── Entry point ──────────────────────────────────────────────────────────────
if (DOCKER_MODE) {
  // Tor already running — just wait for control port to be ready
  log('⏳', c.yellow, 'Waiting for Tor control port…');
  pollControlPort();
} else {
  // Local mode — spawn Tor ourselves
  startLocalTor();
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCKER MODE: poll until Tor control port accepts connections
// ═══════════════════════════════════════════════════════════════════════════════
function pollControlPort(attempts = 0) {
  const MAX = 30; // 30 × 2s = 60s timeout
  if (attempts >= MAX) {
    log('✖', c.red, 'Timed out waiting for Tor to start.');
    process.exit(1);
  }

  const probe = new net.Socket();
  probe.setTimeout(1000);

  probe.connect(TOR_CTRL_PORT, '127.0.0.1', () => {
    probe.destroy();
    log('✔', c.green, 'Tor is ready — creating hidden service…');
    console.log('');
    createOnionService();
  });

  probe.on('error', () => {
    probe.destroy();
    setTimeout(() => pollControlPort(attempts + 1), 2000);
  });

  probe.on('timeout', () => {
    probe.destroy();
    setTimeout(() => pollControlPort(attempts + 1), 2000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL MODE: spawn `tor` binary, watch for bootstrap, then create service
// ═══════════════════════════════════════════════════════════════════════════════
function startLocalTor() {
  const dataDir   = path.join(os.tmpdir(), 'tor-hello-data');
  const torrcPath = path.join(os.tmpdir(), 'tor-hello.torrc');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(torrcPath, [
    `ControlPort ${TOR_CTRL_PORT}`,
    'CookieAuthentication 0',
    `DataDirectory ${dataDir}`,
    'Log notice stdout',
    'SocksPort 0',
  ].join('\n'));

  log('⏳', c.yellow, 'Spawning Tor… (first run takes ~20 seconds)');
  console.log('');

  const torProc = spawn(TOR_BINARY, ['-f', torrcPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  torProc.on('error', () => {
    log('✖', c.red, '`tor` binary not found on PATH.');
    console.log('');
    info('Windows: download Tor Expert Bundle (not Tor Browser):');
    info('  https://www.torproject.org/download/tor/');
    info('  Extract and either:');
    info('    a) Add the folder to your PATH, or');
    info('    b) Add to .env:  TOR_PATH=C:\\tor\\tor\\tor.exe');
    console.log('');
    info('Linux  →  sudo apt install tor');
    info('macOS  →  brew install tor');
    console.log('');
    process.exit(1);
  });

  let ready = false;
  const check = (text) => {
    if (!ready && text.includes('Bootstrapped 100%')) {
      ready = true;
      log('✔', c.green, 'Tor bootstrapped!');
      console.log('');
      createOnionService();
    }
  };

  torProc.stdout.on('data', (d) => check(d.toString()));
  torProc.stderr.on('data', (d) => check(d.toString()));

  process.on('SIGINT', () => {
    console.log('');
    log('⏹', c.yellow, 'Shutting down…');
    torProc.kill();
    try { fs.unlinkSync(torrcPath); } catch {}
    log('✔', c.green, 'Done.');
    console.log('');
    process.exit(0);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: create hidden service via raw Tor control protocol
// ═══════════════════════════════════════════════════════════════════════════════
function createOnionService() {
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
          sock.write(`ADD_ONION NEW:ED25519-V3 Port=80,127.0.0.1:${APP_PORT}\r\n`);
          state = 'ADD_ONION';
        } else {
          log('✖', c.red, `Auth failed: ${line}`);
          process.exit(1);
        }

      } else if (state === 'ADD_ONION') {
        if (line.includes('ServiceID=')) {
          const id = line.split('ServiceID=')[1].trim();
          hr();
          log('🌐', c.cyan, `${c.bold}Onion link is live!${c.reset}`);
          console.log('');
          console.log(`     ${c.green}${c.bold}http://${id}.onion${c.reset}`);
          console.log('');
          info('Open in Tor Browser to visit your site.');
          info('Link is ephemeral — changes on each restart.');
          info('');
          info('Press Ctrl+C to stop.');
          hr();
          console.log('');
          state = 'DONE';
        } else if (code >= 500) {
          log('✖', c.red, `Failed: ${line}`);
          sock.destroy();
          process.exit(1);
        }
      }
    }
  });

  sock.on('error', (err) => {
    log('✖', c.red, `Control socket error: ${err.message}`);
    process.exit(1);
  });
}
