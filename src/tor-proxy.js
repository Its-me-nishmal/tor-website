/**
 * tor-proxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Tor Hidden Service pointing to the local Express server.
 *
 * How it works:
 *   1. Connects to the Tor control port (9051) using granax.
 *   2. Adds an ephemeral onion service that forwards .onion:80 → localhost:3000.
 *   3. Prints the generated .onion address to the console.
 *
 * Requirements (local development only):
 *   - Tor must be installed and running with ControlPort 9051 enabled.
 *   - The Express app must already be running on port 3000.
 *
 * Usage:
 *   npm run tor          # in a second terminal after 'npm start'
 */

require('dotenv').config();

// granax is an optional dependency — only needed locally with Tor installed.
let connect;
try {
  connect = require('granax').connect;
} catch {
  console.error('\n❌  granax is not installed.');
  console.error('    Install it locally with:  npm install granax');
  console.error('    Then make sure Tor is running with ControlPort 9051 open.\n');
  process.exit(1);
}

const LOCAL_PORT = process.env.PORT || 3000;

console.log('\n🧅  Initialising Tor hidden service...');
console.log(`    Forwarding .onion:80 → localhost:${LOCAL_PORT}\n`);

const tor = connect(
  { host: '127.0.0.1', port: 9051 },
  { authOnConnect: false }
);

tor.on('error', (err) => {
  console.error('❌  Tor controller error:', err.message);
  console.error('    Make sure Tor is running with ControlPort 9051 open.');
  process.exit(1);
});

tor.on('ready', () => {
  // AddOnion creates a new ephemeral v3 hidden service
  tor.addOnion(
    [{ virtPort: 80, target: `127.0.0.1:${LOCAL_PORT}` }],
    { keyType: 'NEW', keyBlob: 'BEST' },
    (err, result) => {
      if (err) {
        console.error('❌  Failed to create onion service:', err.message);
        process.exit(1);
      }

      const onionAddress = `${result.serviceId}.onion`;
      console.log('✅  Tor hidden service is active!');
      console.log(`🌐  Your .onion address: http://${onionAddress}`);
      console.log('\n    Keep this terminal open to maintain the onion link.');
      console.log('    Press Ctrl+C to remove the ephemeral hidden service.\n');
    }
  );
});

// Clean up on exit
process.on('SIGINT', () => {
  console.log('\n🛑  Shutting down Tor hidden service...');
  tor.destroy();
  process.exit(0);
});
