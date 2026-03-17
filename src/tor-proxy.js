/**
 * tor-proxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE command does everything:
 *
 *   npm run tor
 *
 * What it does:
 *   1. Spawns the `tor` binary as a child process (uses a temp torrc)
 *   2. Waits for Tor to fully bootstrap (100%)
 *   3. Connects to the control port via raw TCP
 *   4. Creates an ephemeral v3 hidden service
 *   5. Prints your .onion address in the terminal
 *
 * Requirements:
 *   • Express server already running:  npm start   (in another terminal)
 *   • `tor` binary on your PATH
 *       Windows  → download Tor Expert Bundle from https://www.torproject.org/download/tor/
 *                  extract and add the folder to PATH, or set TOR_PATH env var
 *       Linux    → sudo apt install tor
 *       macOS    → brew install tor
 */

require('dotenv').config();
const { spawn } = require('child_process');
const net       = require('net');
const os        = require('os');
const fs        = require('fs');
const path      = require('path');

// ─── ANSI colours (zero deps) ─────────────────────────────────────────────────
const c = {
  reset:   '\x1b[0m', bold:  '\x1b[1m', dim:   '\x1b[2m',
  green:   '\x1b[32m', cyan: '\x1b[36m', yellow:'\x1b[33m',
  red:     '\x1b[31m', magenta:'\x1b[35m',
};
const log  = (icon, col, msg) => console.log(`  ${col}${c.bold}${icon}${c.reset}  ${msg}`);
const info = (msg)             => console.log(`     ${c.dim}${msg}${c.reset}`);
const hr   = ()                => console.log(`  ${c.dim}${'─'.repeat(54)}${c.reset}`);

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_PORT      = process.env.PORT             || 3000;
const TOR_CTRL_PORT = parseInt(process.env.TOR_CONTROL_PORT || '9051', 10);
const TOR_BINARY    = process.env.TOR_PATH || 'tor';   // override if not in PATH

// ─── Write a temp torrc ───────────────────────────────────────────────────────
const dataDir = path.join(os.tmpdir(), 'tor-hello-world-data');
const torrcPath = path.join(os.tmpdir(), 'tor-hello-world.torrc');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(torrcPath, [
  `ControlPort ${TOR_CTRL_PORT}`,
  'CookieAuthentication 0',
  `DataDirectory ${dataDir}`,
  'Log notice stdout',
].join('\n'));

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log('');
hr();
log('🧅', c.magenta, `${c.bold}Tor Hidden Service${c.reset}`);
info(`App port : ${APP_PORT}`);
info(`Tor ctrl : 127.0.0.1:${TOR_CTRL_PORT}`);
hr();
console.log('');
log('⏳', c.yellow, 'Starting Tor… (this takes ~20 seconds first run)');
console.log('');

// ─── Spawn Tor ────────────────────────────────────────────────────────────────
const torProc = spawn(TOR_BINARY, ['-f', torrcPath], { stdio: ['ignore', 'pipe', 'pipe'] });

torProc.on('error', (err) => {
  log('✖', c.red, '`tor` binary not found.');
  info('');
  info('Install Tor and make sure it is on your PATH:');
  info('  Windows → https://www.torproject.org/download/tor/');
  info('            extract, then add the folder to your PATH');
  info('            or set:  TOR_PATH=C:\\path\\to\\tor.exe');
  info('  Linux   → sudo apt install tor');
  info('  macOS   → brew install tor');
  console.log('');
  process.exit(1);
});

let bootstrapped = false;

// Watch stdout for the "Bootstrapped 100%" line
torProc.stdout.on('data', (chunk) => {
  const text = chunk.toString();

  // Uncomment to see all Tor log output:
  // process.stdout.write(`  ${c.dim}[tor] ${text}${c.reset}`);

  if (!bootstrapped && text.includes('Bootstrapped 100%')) {
    bootstrapped = true;
    log('✔', c.green, 'Tor bootstrapped — connecting to control port…');
    console.log('');
    createOnionService();
  }
});

torProc.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  if (!bootstrapped && text.includes('Bootstrapped 100%')) {
    bootstrapped = true;
    log('✔', c.green, 'Tor bootstrapped — connecting to control port…');
    console.log('');
    createOnionService();
  }
});

// ─── Create the hidden service once Tor is ready ──────────────────────────────
function createOnionService() {
  const STATE = { AUTH: 'AUTH', ADD_ONION: 'ADD_ONION', DONE: 'DONE' };
  let state  = STATE.AUTH;
  let buf    = '';

  const socket = new net.Socket();

  socket.connect(TOR_CTRL_PORT, '127.0.0.1', () => {
    socket.write('AUTHENTICATE\r\n');
  });

  socket.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\r\n');
    buf = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const code = line.slice(0, 3);

      if (state === STATE.AUTH) {
        if (code === '250') {
          socket.write(`ADD_ONION NEW:ED25519-V3 Port=80,127.0.0.1:${APP_PORT}\r\n`);
          state = STATE.ADD_ONION;
        } else {
          fatal(socket, `Auth failed: ${line}`);
        }

      } else if (state === STATE.ADD_ONION) {
        if (line.includes('ServiceID=')) {
          const serviceId = line.split('ServiceID=')[1].trim();
          const onionAddr = `${serviceId}.onion`;

          hr();
          log('🌐', c.cyan, `${c.bold}Your onion link is ready!${c.reset}`);
          console.log('');
          console.log(`     ${c.green}${c.bold}http://${onionAddr}${c.reset}`);
          console.log('');
          info('Open the link above in Tor Browser.');
          info('Address is ephemeral — changes on each restart.');
          info('');
          info('Press Ctrl+C to stop.');
          hr();
          console.log('');
          state = STATE.DONE;
        } else if (parseInt(code, 10) >= 500) {
          fatal(socket, `Failed to create service: ${line}`);
        }
      }
    }
  });

  socket.on('error', (err) => {
    log('✖', c.red, `Control port error: ${err.message}`);
    process.exit(1);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fatal(socket, msg) {
  log('✖', c.red, msg);
  socket.destroy();
  cleanup();
  process.exit(1);
}

function cleanup() {
  torProc.kill();
  try { fs.unlinkSync(torrcPath); } catch {}
}

process.on('SIGINT', () => {
  console.log('');
  log('⏹', c.yellow, 'Shutting down…');
  cleanup();
  log('✔', c.green, 'Done.');
  console.log('');
  process.exit(0);
});
