# 🧅 Tor Hello World — Node.js + Render.com + Onion Link

A minimal but premium **Node.js / Express** project that:
- Serves a beautiful dark-mode **Hello World** page
- Deploys to **Render.com** with zero config
- Exposes a **Tor v3 `.onion` hidden service** for private access

---

## 📁 Project Structure

```
tor-hello-world/
├── src/
│   ├── index.js          ← Express server (main entry point)
│   └── tor-proxy.js      ← Tor hidden service controller (local dev only)
├── public/
│   ├── index.html        ← Hello World page
│   ├── style.css         ← Dark mode styles
│   └── app.js            ← Client-side JS (particles + live API panel)
├── .env.example          ← Example environment variables
├── .gitignore
├── render.yaml           ← Render.com deployment blueprint
└── package.json
```

---

## 🚀 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start the server
npm start
# → http://localhost:3000
```

### Optional: Enable Onion Link (local only)

> **Requires Tor to be installed and running on your machine.**

**Step 1 — Install Tor**
- Windows: https://www.torproject.org/download/
- Or via package manager: `choco install tor` / `winget install TorProject.TorBrowser`

**Step 2 — Enable the Control Port**

Edit your `torrc` file (usually in `C:\Users\<you>\AppData\Roaming\tor\torrc`) and add:

```
ControlPort 9051
CookieAuthentication 0
```

Restart Tor after editing.

**Step 3 — Start the onion proxy** (in a second terminal, while `npm start` is running):

```bash
npm run tor
# → Your .onion address: http://xxxxxxxxxxxx.onion
```

Keep this terminal open. The onion address is ephemeral — it changes every time `tor-proxy.js` restarts. For a **persistent** address, see the "Persistent Onion Key" section below.

---

## ☁️ Deploy to Render.com

1. Push this project to a GitHub repository.
2. Log into [Render.com](https://render.com) → **New Web Service** → Connect your repo.
3. Render auto-detects `render.yaml` — just click **Deploy**.
4. Your app is live at `https://tor-hello-world.onrender.com` (or your custom domain).

> ⚠️ **Note:** Render.com is a standard cloud host — it does **not** run Tor. The `.onion` hidden service runs **locally** only (or from your own VPS). See below for a VPS onion setup.

---

## 🌐 Persistent Onion Link (VPS Setup)

For a permanent `.onion` address, run the app on a **Linux VPS** (e.g., DigitalOcean, Linode) alongside Tor:

### 1. Install Tor on the VPS

```bash
sudo apt update && sudo apt install tor -y
```

### 2. Configure `/etc/tor/torrc`

```ini
HiddenServiceDir /var/lib/tor/hidden_service/
HiddenServicePort 80 127.0.0.1:3000
ControlPort 9051
CookieAuthentication 0
```

```bash
sudo systemctl restart tor

# Read your permanent .onion address:
sudo cat /var/lib/tor/hidden_service/hostname
```

### 3. Start the Node server

```bash
npm install
npm start
```

Your server is now reachable at `http://<your-address>.onion` — permanently.

---

## 🔌 API Endpoints

| Method | Path        | Description                                  |
|--------|-------------|----------------------------------------------|
| GET    | `/`         | Hello World HTML page                        |
| GET    | `/api/info` | JSON: message, onion address, uptime, time   |
| GET    | `/health`   | Health check — returns `{ "status": "ok" }`  |

---

## 🛠 Environment Variables

| Variable        | Default | Description                                      |
|-----------------|---------|--------------------------------------------------|
| `PORT`          | `3000`  | Port the Express server listens on               |
| `ONION_ADDRESS` | —       | Your `.onion` address (displayed in UI + `/api/info`) |

---

## 📦 Tech Stack

| Layer       | Technology           |
|-------------|----------------------|
| Runtime     | Node.js ≥ 18         |
| Framework   | Express 4            |
| Tor Control | granax               |
| Hosting     | Render.com           |
| Fonts       | Google Fonts (Outfit + JetBrains Mono) |
