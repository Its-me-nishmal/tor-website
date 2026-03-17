/**
 * tor-proxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Connects to the local Tor control port and creates an ephemeral v3 hidden
 * service that forwards  .onion:80  →  localhost:<PORT>.
 *
 * Usage (separate terminals):
 *   Terminal 1 →  npm start
 *   Terminal 2 →  npm run tor
 *
 * Usage (single terminal):
 *   npm run start:tor
 *
 * Requirements:
 *   • Tor installed and running  (ControlPort 9051, CookieAuthentication 0)
 *   • granax installed           (npm install granax)
 */

require('dotenv').config();

// ─── ANSI colour helpers (zero external deps) ─────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  magenta:'\x1b[35m',
};
const log  = (icon, color, msg) => console.log(`${color}${c.bold}${icon}${c.reset}  ${msg}`);
const info = (msg) => console.log(`${c.dim}   ${msg}${c.reset}`);
const line = () => console.log(`${c.dim}${'─'.repeat(56)}${c.reset}`);

// ─── Guard: granax must be installed ─────────────────────────────────────────
let connect;
try {
  connect = require('granax').connect;
} catch {
  log('✖', c.red, `${c.bold}granax${c.reset} is not installed.`);
  info('Run:  npm install granax');
  process.exit(1);
}

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_PORT = process.env.PORT || 3000;
const TOR_HOST = process.env.TOR_HOST || '127.0.0.1';
const TOR_PORT = parseInt(process.env.TOR_CONTROL_PORT || '9051', 10);

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log('');
line();
log('🧅', c.magenta, `${c.bold}Tor Hidden Service${c.reset} — Starting up`);
info(`Control port : ${TOR_HOST}:${TOR_PORT}`);
info(`Forwarding   : .onion:80  →  127.0.0.1:${APP_PORT}`);
line();
console.log('');

// ─── Connect ──────────────────────────────────────────────────────────────────
const tor = connect(
  { host: TOR_HOST, port: TOR_PORT },
  { authOnConnect: false }
);

tor.on('error', (err) => {
  log('✖', c.red, 'Tor controller error:');
  info(err.message);
  info('');
  info('Make sure Tor is running and torrc contains:');
  info('  ControlPort 9051');
  info('  CookieAuthentication 0');
  console.log('');
  process.exit(1);
});

tor.on('ready', () => {
  log('✔', c.green, 'Connected to Tor control port');
  info('Creating ephemeral v3 hidden service…');
  console.log('');

  tor.addOnion(
    [{ virtPort: 80, target: `127.0.0.1:${APP_PORT}` }],
    { keyType: 'NEW', keyBlob: 'BEST' },
    (err, result) => {
      if (err) {
        log('✖', c.red, 'Failed to create onion service:');
        info(err.message);
        process.exit(1);
      }

      const onionAddress = `${result.serviceId}.onion`;

      line();
      log('🌐', c.cyan,  `${c.bold}Your onion link is ready!${c.reset}`);
      console.log('');
      console.log(`     ${c.green}${c.bold}http://${onionAddress}${c.reset}`);
      console.log('');
      info('Open the link above in Tor Browser to access your site.');
      info('The address is ephemeral — it changes each restart.');
      info('');
      info('Press Ctrl+C to shut down the hidden service.');
      line();
      console.log('');
    }
  );
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('');
  log('⏹', c.yellow, 'Shutting down hidden service…');
  tor.destroy();
  log('✔', c.green, 'Done. Onion address is now unreachable.');
  console.log('');
  process.exit(0);
});
