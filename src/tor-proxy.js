/**
 * tor-proxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Tor v3 hidden service using the raw Tor control protocol over a
 * plain TCP socket — NO external dependencies, only Node built-ins.
 *
 * How to use
 * ──────────
 *  Option A — two terminals:
 *    Terminal 1 →  npm start
 *    Terminal 2 →  npm run tor
 *
 *  Option B — one terminal:
 *    npm run start:tor
 *
 * Tor requirements (torrc)
 * ────────────────────────
 *    ControlPort 9051
 *    CookieAuthentication 0
 */

require('dotenv').config();
const net = require('net');

// ─── ANSI colour helpers (zero external deps) ─────────────────────────────────
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
};
const log  = (icon, color, msg) => console.log(`  ${color}${c.bold}${icon}${c.reset}  ${msg}`);
const info = (msg) => console.log(`     ${c.dim}${msg}${c.reset}`);
const line = () => console.log(`  ${c.dim}${'─'.repeat(54)}${c.reset}`);

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_PORT     = process.env.PORT             || 3000;
const TOR_HOST     = process.env.TOR_HOST         || '127.0.0.1';
const TOR_CTRL_PORT = parseInt(process.env.TOR_CONTROL_PORT || '9051', 10);

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log('');
line();
log('🧅', c.magenta, `${c.bold}Tor Hidden Service${c.reset}`);
info(`Control  →  ${TOR_HOST}:${TOR_CTRL_PORT}`);
info(`Forward  →  .onion:80  ⟶  127.0.0.1:${APP_PORT}`);
line();
console.log('');

// ─── Tor Control Protocol (raw TCP) ──────────────────────────────────────────
// Simple state machine: AUTHENTICATE → ADD_ONION → DONE
const STATE = { AUTH: 'AUTH', ADD_ONION: 'ADD_ONION', DONE: 'DONE' };
let state  = STATE.AUTH;
let buffer = '';

const socket = new net.Socket();

socket.connect(TOR_CTRL_PORT, TOR_HOST, () => {
  log('✔', c.green, 'Connected to Tor control port');
  info('Authenticating…');
  socket.write('AUTHENTICATE\r\n');
});

socket.on('data', (chunk) => {
  buffer += chunk.toString();

  // Process all complete lines in the buffer
  const lines = buffer.split('\r\n');
  buffer = lines.pop(); // keep incomplete tail

  for (const line of lines) {
    if (!line.trim()) continue;
    handleLine(line.trim());
  }
});

function handleLine(line) {
  // Tor replies start with a 3-digit code: "250 OK", "250+...", "552 ..."
  const code = line.slice(0, 3);

  if (state === STATE.AUTH) {
    if (code === '250') {
      log('✔', c.green, 'Authenticated');
      info('Creating ephemeral v3 hidden service…');
      console.log('');
      // ADD_ONION: new v3 key, port 80 → local app port
      socket.write(`ADD_ONION NEW:ED25519-V3 Port=80,127.0.0.1:${APP_PORT}\r\n`);
      state = STATE.ADD_ONION;
    } else {
      fatal(`Authentication failed: ${line}`);
    }
    return;
  }

  if (state === STATE.ADD_ONION) {
    // Lines like:  250-ServiceID=abc123xyz
    if (line.startsWith('250-ServiceID=') || line.startsWith('250 ServiceID=')) {
      const serviceId = line.split('=')[1].trim();
      const onionAddr = `${serviceId}.onion`;

      line_();
      log('🌐', c.cyan, `${c.bold}Your onion link is ready!${c.reset}`);
      console.log('');
      console.log(`     ${c.green}${c.bold}http://${onionAddr}${c.reset}`);
      console.log('');
      info('Open in Tor Browser to visit your site.');
      info('Address is ephemeral — changes on each restart.');
      info('');
      info('Press Ctrl+C to shut down.');
      line_();
      console.log('');
      state = STATE.DONE;
    } else if (code === '250') {
      // "250 OK" final line — response complete without ServiceID parsed (shouldn't happen)
      // ignore
    } else if (parseInt(code, 10) >= 500) {
      fatal(`Failed to create hidden service: ${line}`);
    }
    return;
  }
}

socket.on('error', (err) => {
  console.log('');
  log('✖', c.red, 'Cannot connect to Tor control port:');
  info(err.message);
  info('');
  info('Make sure Tor is running and torrc contains:');
  info('  ControlPort 9051');
  info('  CookieAuthentication 0');
  console.log('');
  process.exit(1);
});

socket.on('close', () => {
  if (state !== STATE.DONE) {
    console.log('');
    log('✖', c.red, 'Tor control port connection closed unexpectedly.');
    process.exit(1);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function line_() { console.log(`  ${c.dim}${'─'.repeat(54)}${c.reset}`); }

function fatal(msg) {
  console.log('');
  log('✖', c.red, msg);
  socket.destroy();
  process.exit(1);
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('');
  log('⏹', c.yellow, 'Shutting down hidden service…');
  // DEL_ONION is only needed for non-detached services; just close the socket
  socket.destroy();
  log('✔', c.green, 'Done — onion address is now offline.');
  console.log('');
  process.exit(0);
});
